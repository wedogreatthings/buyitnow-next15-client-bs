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
      .select('_id name email phone isActive verified')
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
    const limit = parseInt(searchParams.get('limit') || '10', 10);

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

    // Limiter le nombre d'éléments par page pour éviter les abus
    const resPerPage = Math.min(Math.max(limit, 1), 50); // Entre 1 et 50

    // Récupérer les filtres optionnels
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Construire le filtre de requête
    let filter = { user: user._id };

    // Ajouter le filtre de statut si présent
    if (status) {
      const validStatuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
      if (validStatuses.includes(status)) {
        filter.orderStatus = status;
      }
    }

    // Ajouter le filtre de date si présent
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          filter.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          // Ajouter 23:59:59 à la date de fin pour inclure toute la journée
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    // Compter le total de commandes avec les filtres
    const ordersCount = await Order.countDocuments(filter);

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
            filters: {
              status: status || null,
              dateRange: {
                start: startDate || null,
                end: endDate || null,
              },
            },
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
      Order.find(filter),
      searchParams,
    ).pagination(resPerPage);

    // Récupérer les commandes avec pagination et données enrichies
    const orders = await apiFilters.query
      .select(
        'orderNumber orderStatus paymentInfo paymentStatus totalAmount createdAt updatedAt orderItems deliveredAt',
      )
      .populate({
        path: 'shippingInfo',
        select: 'street city state zipCode country additionalInfo',
        model: 'Address',
      })
      .sort({ createdAt: -1 })
      .lean();

    // Récupérer les prix de livraison actuels (pour référence)
    const deliveryPrice = await DeliveryPrice.find({ isActive: true })
      .select('zone price estimatedDays')
      .lean()
      .catch(() => []);

    // Calculer le nombre de pages
    const totalPages = Math.ceil(ordersCount / resPerPage);

    // Calculer des statistiques sur les commandes
    const statistics = {
      totalOrders: ordersCount,
      totalSpent: 0,
      averageOrderValue: 0,
      statusBreakdown: {},
    };

    // Calculer les statistiques si l'utilisateur a des commandes
    if (ordersCount > 0) {
      const allUserOrders = await Order.find({ user: user._id })
        .select('totalAmount orderStatus')
        .lean();

      statistics.totalSpent = allUserOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0,
      );
      statistics.averageOrderValue = statistics.totalSpent / ordersCount;

      // Compter les commandes par statut
      allUserOrders.forEach((order) => {
        statistics.statusBreakdown[order.orderStatus] =
          (statistics.statusBreakdown[order.orderStatus] || 0) + 1;
      });
    }

    // Formater les commandes avec données utilisateur et protection des données sensibles
    const formattedOrders = orders.map((order) => {
      // Masquer partiellement le numéro de compte de paiement
      const maskedPaymentInfo = order.paymentInfo
        ? {
            ...order.paymentInfo,
            paymentAccountNumber: order.paymentInfo.paymentAccountNumber
              ? `****${order.paymentInfo.paymentAccountNumber.slice(-4)}`
              : null,
          }
        : null;

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentInfo: maskedPaymentInfo,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        itemCount: order.orderItems?.length || 0,
        shippingInfo: order.shippingInfo,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveredAt: order.deliveredAt,
        // Résumé simplifié des articles
        orderSummary: order.orderItems?.map((item) => ({
          product: item.product,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        meta: {
          daysAgo: Math.floor(
            (Date.now() - new Date(order.createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
          isRecent:
            Date.now() - new Date(order.createdAt).getTime() <
            7 * 24 * 60 * 60 * 1000, // < 7 jours
        },
      };
    });

    // Log pour audit (sans données sensibles)
    console.log('Order history accessed:', {
      userId: user._id,
      userEmail: user.email,
      ordersRetrieved: orders.length,
      page,
      filters: {
        status: status || 'all',
        dateRange:
          startDate || endDate ? { start: startDate, end: endDate } : null,
      },
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
        message:
          ordersCount > 0 ? 'Orders retrieved successfully' : 'No orders found',
        data: {
          orders: formattedOrders,
          deliveryPrice,
          pagination: {
            totalPages,
            currentPage: page,
            totalCount: ordersCount,
            perPage: resPerPage,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
          },
          statistics,
          filters: {
            status: status || null,
            dateRange: {
              start: startDate || null,
              end: endDate || null,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(), // Pour traçabilité
          },
        },
      },
      {
        status: 200,
        // Pas de headers manuels - gérés par next.config.mjs
      },
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
