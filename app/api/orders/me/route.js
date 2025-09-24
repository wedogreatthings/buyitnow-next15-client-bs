import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import Order from '@/backend/models/order';
import User from '@/backend/models/user';
import DeliveryPrice from '@/backend/models/deliveryPrice';
import Address from '@/backend/models/address';
import APIFilters from '@/backend/utils/APIFilters';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/orders/me
 * Récupère l'historique des commandes de l'utilisateur connecté
 * Rate limit: 120 req/min (authenticated) - Limite généreuse pour navigation de l'historique
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
 * Note: L'historique des commandes contient des données sensibles
 * (montants, adresses, statuts de paiement) et ne doit jamais être caché publiquement
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Récupérer l'utilisateur avec validation améliorée
    const user = await User.findOne({ email: req.user.email })
      .select('_id name email phone isActive')
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
      console.warn(
        'Inactive user attempting to access order history:',
        user.email,
      );
      return NextResponse.json(
        {
          success: false,
          message: 'Account suspended. Cannot access order history',
          code: 'ACCOUNT_SUSPENDED',
        },
        { status: 403 },
      );
    }

    // Récupérer et valider les paramètres de pagination
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const resPerPage = 2; // 2 commandes par page

    // Validation des paramètres de pagination
    if (page < 1 || page > 1000) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid page number. Must be between 1 and 1000',
          code: 'INVALID_PAGINATION',
          data: { page },
        },
        { status: 400 },
      );
    }

    // Compter le total de commandes avec les filtres
    const ordersCount = await Order.countDocuments({ user: user._id });

    // Si aucune commande trouvée
    if (ordersCount === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No orders found',
          data: {
            orders: [],
            deliveryPrice: [],
            totalPages: 0,
            currentPage: page,
            count: 0,
            perPage: resPerPage,
            meta: {
              hasOrders: false,
              timestamp: new Date().toISOString(),
            },
          },
        },
        { status: 200 },
      );
    }

    // Utiliser APIFilters pour la pagination
    const apiFilters = new APIFilters(
      Order.find({ user: user._id }),
      searchParams,
    ).pagination(resPerPage);

    // Récupérer les commandes avec pagination
    const orders = await apiFilters.query
      .select(
        'orderNumber orderStatus paymentInfo paymentStatus totalAmount createdAt orderItems',
      )
      .populate('shippingInfo', 'street city state zipCode country')
      .sort({ createdAt: -1 })
      .lean();

    // Récupérer les prix de livraison (optionnel)
    const deliveryPrice = await DeliveryPrice.find()
      .lean()
      .catch(() => []);

    // Calculer le nombre de pages
    const totalPages = Math.ceil(ordersCount / resPerPage);

    // Formater la réponse
    const formattedOrders = orders.map((order) => ({
      ...order,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    }));

    // Log pour audit (sans données sensibles)
    console.log('Order history accessed:', {
      userId: user._id,
      userEmail: user.email,
      ordersRetrieved: orders.length,
      page,
      timestamp: new Date().toISOString(),
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
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
    // Ces headers garantissent que l'historique des commandes
    // ne sera jamais mis en cache publiquement ou indexé
    // ============================================

    return NextResponse.json(
      {
        success: true,
        data: {
          orders: formattedOrders,
          deliveryPrice,
          totalPages,
          currentPage: page,
          count: ordersCount,
          perPage: resPerPage,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Orders fetch error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (!error.message?.includes('authentication')) {
      captureException(error, {
        tags: {
          component: 'api',
          route: 'orders/me/GET',
          user: req.user?.email,
        },
        extra: {
          page: req.nextUrl.searchParams.get('page'),
          filters: {
            status: req.nextUrl.searchParams.get('status'),
            startDate: req.nextUrl.searchParams.get('startDate'),
            endDate: req.nextUrl.searchParams.get('endDate'),
          },
        },
      });
    }

    // Gestion détaillée des erreurs
    let status = 500;
    let message = 'Failed to fetch orders history';
    let code = 'INTERNAL_ERROR';

    if (error.message?.includes('authentication')) {
      status = 401;
      message = 'Authentication failed';
      code = 'AUTH_FAILED';
    } else if (error.name === 'CastError') {
      status = 400;
      message = 'Invalid request parameters';
      code = 'INVALID_PARAMS';
    } else if (error.message?.includes('connection')) {
      status = 503;
      message = 'Database connection error';
      code = 'DB_CONNECTION_ERROR';
    }

    return NextResponse.json(
      {
        success: false,
        message,
        code,
        ...(process.env.NODE_ENV === 'development' && {
          error: error.message,
        }),
      },
      { status },
    );
  }
});
