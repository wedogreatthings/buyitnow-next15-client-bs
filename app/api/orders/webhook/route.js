import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import Order from '@/backend/models/order';
import User from '@/backend/models/user';
import Product from '@/backend/models/product';
import Category from '@/backend/models/category';
import Cart from '@/backend/models/cart';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * POST /api/orders/webhook
 * Crée une commande après paiement confirmé
 * Rate limit: 5 commandes par 10 minutes (protection anti-abus strict)
 * Adapté pour ~500 visiteurs/jour
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/orders/* :
 * - Cache-Control: private, no-cache, no-store, must-revalidate
 * - Pragma: no-cache
 * - X-Content-Type-Options: nosniff
 * - X-Robots-Tag: noindex, nofollow
 * - X-Download-Options: noopen
 *
 * Headers globaux de sécurité (toutes routes) :
 * - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
 * - X-Frame-Options: SAMEORIGIN
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: [configuration restrictive]
 * - Content-Security-Policy: [configuration complète]
 *
 * Note: Cette route est critique pour le business et utilise des transactions
 * MongoDB pour garantir la cohérence des données (stock, panier, commande)
 */
export const POST = withApiRateLimit(
  async function (req) {
    try {
      // 1. Authentification
      await isAuthenticatedUser(req, NextResponse);

      // 2. Connexion DB
      await dbConnect();

      // 3. Récupérer l'utilisateur avec validation améliorée
      const user = await User.findOne({ email: req.user.email })
        .select('_id name email isActive')
        .lean();

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // Vérifier si le compte est actif
      if (!user.isActive) {
        console.warn('Inactive user attempting to place order:', user.email);
        return NextResponse.json(
          {
            success: false,
            message: 'Account suspended. Cannot place orders',
            code: 'ACCOUNT_SUSPENDED',
          },
          { status: 403 },
        );
      }

      // 4. Parser et valider les données de commande
      let orderData;
      try {
        orderData = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid request body',
            code: 'INVALID_BODY',
          },
          { status: 400 },
        );
      }

      // Validation basique des champs requis
      if (!orderData?.orderItems?.length) {
        return NextResponse.json(
          {
            success: false,
            message: 'Order must contain at least one item',
            code: 'EMPTY_ORDER',
          },
          { status: 400 },
        );
      }

      if (!orderData.paymentInfo) {
        return NextResponse.json(
          {
            success: false,
            message: 'Payment information is required',
            code: 'MISSING_PAYMENT_INFO',
          },
          { status: 400 },
        );
      }

      if (!orderData.totalAmount) {
        return NextResponse.json(
          {
            success: false,
            message: 'Missing required order information',
            code: 'INCOMPLETE_ORDER',
          },
          { status: 400 },
        );
      }

      // Validation du paiement
      const {
        amountPaid,
        typePayment,
        paymentAccountNumber,
        paymentAccountName,
      } = orderData.paymentInfo || {};
      if (
        !amountPaid ||
        !typePayment ||
        !paymentAccountNumber ||
        !paymentAccountName
      ) {
        return NextResponse.json(
          { success: false, message: 'Incomplete payment information' },
          { status: 400 },
        );
      }

      // Validation du montant avec précision
      const totalAmount = parseFloat(orderData.totalAmount);

      if (isNaN(totalAmount) || totalAmount <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid order amount',
            code: 'INVALID_AMOUNT',
            data: { providedAmount: orderData.totalAmount },
          },
          { status: 400 },
        );
      }

      // 5. Vérifier le stock et traiter la commande en transaction
      const session = await Order.startSession();

      try {
        let createdOrder;

        await session.withTransaction(async () => {
          // Extraire les IDs de produits et quantités
          const productOrders = orderData.orderItems.map((item) => ({
            productId: item.product,
            quantity: parseInt(item.quantity, 10),
            cartId: item.cartId,
            price: parseFloat(item.price),
          }));

          // Vérifier et mettre à jour le stock pour chaque produit
          const unavailableProducts = [];
          const processedItems = [];

          for (const item of productOrders) {
            const product = await Product.findById(item.productId)
              .select('name stock price category isActive')
              .populate('category', 'categoryName')
              .session(session);

            if (!product) {
              unavailableProducts.push({
                id: item.productId,
                name: 'Product not found',
                reason: 'not_found',
              });
              continue;
            }

            // Vérifier si le produit est actif
            if (!product.isActive) {
              unavailableProducts.push({
                id: product._id,
                name: product.name,
                reason: 'product_inactive',
              });
              continue;
            }

            // Vérifier le stock
            if (product.stock < item.quantity) {
              unavailableProducts.push({
                id: product._id,
                name: product.name,
                stock: product.stock,
                requested: item.quantity,
                reason: 'insufficient_stock',
              });
              continue;
            }

            // Vérifier le prix (protection contre la manipulation)
            if (Math.abs(product.price - item.price) > 0.01) {
              console.warn('Price mismatch detected:', {
                productId: product._id,
                expectedPrice: product.price,
                providedPrice: item.price,
                userId: user._id,
              });

              unavailableProducts.push({
                id: product._id,
                name: product.name,
                reason: 'price_mismatch',
                expected: product.price,
                provided: item.price,
              });
              continue;
            }

            // Mettre à jour le stock
            await Product.findByIdAndUpdate(
              product._id,
              {
                $inc: {
                  stock: -item.quantity,
                  sold: item.quantity, // Incrémenter les ventes
                },
              },
              { session },
            );

            // Ajouter la catégorie à l'item de commande
            const orderItem = orderData.orderItems.find(
              (oi) => oi.product.toString() === product._id.toString(),
            );
            if (orderItem && product.category) {
              orderItem.category = product.category.categoryName;
            }

            processedItems.push({
              productId: product._id,
              productName: product.name,
              quantity: item.quantity,
              price: product.price,
            });
          }

          // Si des produits ne sont pas disponibles, annuler la transaction
          if (unavailableProducts.length > 0) {
            throw new Error(
              JSON.stringify({
                type: 'STOCK_ERROR',
                products: unavailableProducts,
              }),
            );
          }

          // Nettoyer les champs non nécessaires
          orderData.orderItems.forEach((item) => {
            delete item.cartId;
          });

          // Ajouter des métadonnées à la commande
          orderData.user = user._id;

          // Créer la commande
          const order = await Order.create([orderData], { session });

          // Supprimer les articles du panier
          const cartIds = productOrders
            .filter((item) => item.cartId)
            .map((item) => item.cartId);

          if (cartIds.length > 0) {
            const deleteResult = await Cart.deleteMany(
              { _id: { $in: cartIds }, user: user._id },
              { session },
            );

            console.log(
              `Cleared ${deleteResult.deletedCount} items from cart for user ${user._id}`,
            );
          }

          // La transaction sera automatiquement commitée si tout réussit
          return order[0];
        });

        // Transaction réussie - Récupérer la commande complète
        const order = await Order.findById(order._id)
          .sort({ createdAt: -1 })
          .select('_id orderNumber')
          .lean();

        // Log de sécurité pour audit
        console.log('🔒 Security event - Order created:', {
          userId: user._id,
          userEmail: user.email,
          orderId: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paymentType: typePayment,
          itemCount: orderData.orderItems.length,
          timestamp: new Date().toISOString(),
          ip:
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            'unknown',
        });

        // ============================================
        // NOUVELLE IMPLÉMENTATION : Headers de sécurité
        //
        // Les headers sont maintenant gérés de manière centralisée
        // par next.config.mjs pour garantir la cohérence et la sécurité
        //
        // Pour /api/orders/* sont appliqués automatiquement :
        // - Cache privé uniquement (données sensibles de commande)
        // - Pas de cache navigateur (no-store, no-cache)
        // - Protection contre l'indexation (X-Robots-Tag)
        // - Protection téléchargements (X-Download-Options)
        // - Protection MIME (X-Content-Type-Options)
        //
        // Ces headers garantissent que les données de commande
        // ne sont jamais mises en cache publiquement ou indexées
        // ============================================

        return NextResponse.json(
          {
            success: true,
            id: order.orderNumber,
            orderNumber: order.orderNumber,
            message: 'Order placed successfully',
          },
          { status: 201 },
        );
      } catch (transactionError) {
        // Gérer les erreurs de transaction
        if (transactionError.message?.includes('STOCK_ERROR')) {
          try {
            const errorData = JSON.parse(transactionError.message);

            // Log pour analyse
            console.warn('Order failed due to stock issues:', {
              userId: user._id,
              unavailableProducts: errorData.products,
              timestamp: new Date().toISOString(),
            });

            return NextResponse.json(
              {
                success: false,
                message: 'Some products are unavailable',
                code: 'STOCK_ERROR',
                unavailableProducts: errorData.products,
              },
              { status: 409 },
            );
          } catch {
            // Fallback si le parsing échoue
          }
        }

        // Log de l'erreur de transaction
        console.error('Transaction failed:', {
          userId: user._id,
          error: transactionError.message,
          timestamp: new Date().toISOString(),
        });

        // Autre erreur de transaction
        throw transactionError;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error('Order webhook error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (
        !error.message?.includes('authentication') &&
        !error.message?.includes('STOCK_ERROR') &&
        !error.message?.includes('PAYMENT_')
      ) {
        captureException(error, {
          tags: {
            component: 'api',
            route: 'orders/webhook/POST',
            user: req.user?.email,
            critical: true, // Erreur critique car c'est une commande
          },
          level: 'error',
        });
      }

      // Gestion détaillée des erreurs
      let status = 500;
      let message = 'Failed to process order. Please try again.';
      let code = 'INTERNAL_ERROR';

      if (error.message?.includes('authentication')) {
        status = 401;
        message = 'Authentication failed';
        code = 'AUTH_FAILED';
      } else if (error.message?.includes('MongoNetwork')) {
        status = 503;
        message = 'Database connection error. Please try again';
        code = 'DB_CONNECTION_ERROR';
      } else if (error.message?.includes('timeout')) {
        status = 504;
        message = 'Request timeout. Please try again';
        code = 'TIMEOUT';
      } else if (error.message?.includes('Transaction')) {
        status = 500;
        message = 'Transaction failed. No charges were made';
        code = 'TRANSACTION_FAILED';
      }

      return NextResponse.json(
        {
          success: false,
          message,
          code,
          ...(process.env.NODE_ENV === 'development' && {
            error: error.message,
            stack: error.stack,
          }),
        },
        { status },
      );
    }
  },
  {
    customLimit: {
      points: 5, // 5 commandes maximum
      duration: 600000, // par période de 10 minutes
      blockDuration: 1800000, // blocage de 30 minutes en cas de dépassement
    },
  },
);
