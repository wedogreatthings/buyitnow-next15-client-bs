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
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email })
      .select('_id name email phone')
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );
    }

    // Récupérer les paramètres de pagination
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
    const resPerPage = 2; // 10 commandes par page

    // Compter le total de commandes
    const ordersCount = await Order.countDocuments({ user: user._id });

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
        tags: { component: 'api', route: 'orders/me/GET' },
      });
    }

    // Gestion des erreurs d'authentification
    let status = 500;
    let message = 'Failed to fetch orders history';

    if (error.message?.includes('authentication')) {
      status = 401;
      message = 'Authentication failed';
    }

    return NextResponse.json({ success: false, message }, { status });
  }
});
