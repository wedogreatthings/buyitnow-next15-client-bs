import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import Order from '@/backend/models/order';
import User from '@/backend/models/user';
import Product from '@/backend/models/product';
import Category from '@/backend/models/category';
import Cart from '@/backend/models/cart';
import { captureException } from '@/monitoring/sentry';

/**
 * POST /api/orders/webhook
 * Crée une commande après paiement confirmé
 * Adapté pour ~500 visiteurs/jour
 */
export async function POST(req) {
  try {
    // 1. Authentification
    await isAuthenticatedUser(req, NextResponse);

    // 2. Connexion DB
    await dbConnect();

    // 3. Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email })
      .select('_id')
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );
    }

    // 4. Parser et valider les données de commande
    let orderData;
    try {
      orderData = await req.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Validation basique des champs requis
    if (
      !orderData?.orderItems?.length ||
      !orderData.paymentInfo ||
      !orderData.totalAmount
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing required order information' },
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

    // Validation du montant
    const totalAmount = parseFloat(orderData.totalAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid order amount' },
        { status: 400 },
      );
    }

    // 5. Vérifier le stock et traiter la commande en transaction
    const session = await Order.startSession();

    try {
      await session.withTransaction(async () => {
        // Extraire les IDs de produits et quantités
        const productOrders = orderData.orderItems.map((item) => ({
          productId: item.product,
          quantity: item.quantity,
          cartId: item.cartId,
        }));

        // Vérifier et mettre à jour le stock pour chaque produit
        const unavailableProducts = [];

        for (const item of productOrders) {
          const product = await Product.findById(item.productId)
            .select('name stock price category')
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

          // Mettre à jour le stock
          await Product.findByIdAndUpdate(
            product._id,
            {
              $inc: {
                stock: -item.quantity,
                sold: item.quantity,
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

        // Créer la commande
        orderData.user = user._id;
        const order = await Order.create([orderData], { session });

        // Supprimer les articles du panier
        const cartIds = productOrders
          .filter((item) => item.cartId)
          .map((item) => item.cartId);

        if (cartIds.length > 0) {
          await Cart.deleteMany(
            { _id: { $in: cartIds }, user: user._id },
            { session },
          );
        }

        // La transaction sera automatiquement commitée si tout réussit
        return order[0];
      });

      // Transaction réussie
      const order = await Order.findOne({ user: user._id })
        .sort({ createdAt: -1 })
        .select('_id orderNumber')
        .lean();

      console.log(
        `Order created: ${order.orderNumber} for user: ${req.user.email}`,
      );

      return NextResponse.json(
        {
          success: true,
          id: order._id,
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
          return NextResponse.json(
            {
              success: false,
              message: 'Some products are unavailable',
              unavailableProducts: errorData.products,
            },
            { status: 409 },
          );
        } catch {
          // Fallback si le parsing échoue
        }
      }

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
      !error.message?.includes('STOCK_ERROR')
    ) {
      captureException(error, {
        tags: {
          component: 'api',
          route: 'orders/webhook/POST',
          user: req.user?.email,
        },
      });
    }

    // Réponse d'erreur simple
    if (error.message?.includes('authentication')) {
      return NextResponse.json(
        { success: false, message: 'Authentication failed' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process order. Please try again.',
      },
      { status: 500 },
    );
  }
}
