import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';

import logger from '@/utils/logger';
import { getCookieName } from '@/helpers/helpers';
import { getAuthenticatedUser } from '@/lib/auth';

// Chargement dynamique avec fallback
const ListOrders = dynamic(() => import('@/components/orders/ListOrders'), {
  loading: () => <OrdersPageSkeleton />,
  ssr: true, // Activer le SSR pour améliorer la première charge
});

/**
 * Récupère l'historique des commandes de l'utilisateur connecté
 * Version simplifiée et optimisée pour ~500 visiteurs/jour
 *
 * @param {Object} searchParams - Paramètres de recherche (page)
 * @returns {Promise<Object>} Données des commandes ou erreur
 */
const getAllOrders = async (searchParams) => {
  // Identifiant unique pour la traçabilité
  const requestId = `orderspage-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // AJOUTER : Première vérification d'authentification avec getAuthenticatedUser
  const headersList = await headers();
  const user = await getAuthenticatedUser(headersList);

  if (!user) {
    logger.warn(
      'Unauthenticated access to orders page (getAuthenticatedUser)',
      {
        requestId,
        action: 'unauthenticated_access_primary',
      },
    );
    return redirect('/login?callbackUrl=/me/orders');
  }

  logger.info('Orders page accessed', {
    requestId,
    page: searchParams?.page || 1,
    userId: user._id
      ? `${user._id.substring(0, 2)}...${user._id.slice(-2)}`
      : 'unknown',
    action: 'orders_page_access',
  });

  try {
    // 1. Obtenir le cookie d'authentification
    const nextCookies = await cookies();
    const cookieName = getCookieName();
    const authToken = nextCookies.get(cookieName);

    // 2. Vérifier l'authentification
    if (!authToken) {
      console.warn('No authentication token found');
      return {
        success: false,
        message: 'Authentification requise',
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          deliveryPrice: [],
        },
      };
    }

    // 3. Valider et construire les paramètres de pagination
    const urlParams = {};

    if (searchParams?.page) {
      const parsedPage = parseInt(searchParams.page, 10);
      // Validation simple : page entre 1 et 100
      if (!isNaN(parsedPage) && parsedPage > 0 && parsedPage <= 100) {
        urlParams.page = parsedPage;
      } else {
        console.warn('Invalid page parameter:', searchParams.page);
        urlParams.page = 1;
      }
    }

    // 4. Construire l'URL de l'API
    const searchQuery = new URLSearchParams(urlParams).toString();
    const apiUrl = `${
      process.env.API_URL || 'https://buyitnow-next15-client-bs.vercel.app'
    }/api/orders/me${searchQuery ? `?${searchQuery}` : ''}`;

    console.log('Fetching orders from:', apiUrl); // Log pour debug

    // 5. Faire l'appel API avec timeout (8 secondes - un peu plus pour les commandes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Cookie: `${authToken.name}=${authToken.value}`,
      },
      next: {
        revalidate: 0, // Pas de cache pour les données utilisateur
        tags: ['user-orders'],
      },
    });

    clearTimeout(timeoutId);

    // 6. Vérifier le statut HTTP
    if (!res.ok) {
      // Gestion simple des erreurs principales
      if (res.status === 401) {
        return {
          success: false,
          message: 'Authentification requise',
          data: {
            orders: [],
            totalPages: 0,
            currentPage: 1,
            count: 0,
            deliveryPrice: [],
          },
        };
      }

      if (res.status === 404) {
        // Utilisateur non trouvé ou pas de commandes
        return {
          success: true,
          message: 'Aucune commande trouvée',
          data: {
            orders: [],
            totalPages: 0,
            currentPage: urlParams.page || 1,
            count: 0,
            deliveryPrice: [],
          },
        };
      }

      // Erreur serveur générique
      console.error(`API Error: ${res.status} - ${res.statusText}`);
      return {
        success: false,
        message: 'Erreur lors de la récupération des commandes',
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          deliveryPrice: [],
        },
      };
    }

    // 7. Parser la réponse JSON
    const responseBody = await res.json();

    // 8. Vérifier la structure de la réponse
    if (!responseBody.success || !responseBody.data) {
      console.error('Invalid API response structure:', responseBody);
      return {
        success: false,
        message: responseBody.message || 'Réponse API invalide',
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          deliveryPrice: [],
        },
      };
    }

    // 9. Masquer les informations sensibles de paiement
    const sanitizedOrders = (responseBody.data.orders || []).map((order) => ({
      ...order,
      // Masquer le numéro de compte de paiement
      paymentInfo: order.paymentInfo
        ? {
            ...order.paymentInfo,
            paymentAccountNumber:
              order.paymentInfo.paymentAccountNumber?.includes('••••••')
                ? order.paymentInfo.paymentAccountNumber
                : '••••••' +
                  (order.paymentInfo.paymentAccountNumber?.slice(-4) || ''),
          }
        : order.paymentInfo,
    }));

    // 10. Retourner les données avec succès
    return {
      success: true,
      message:
        responseBody.data.count > 0
          ? 'Commandes récupérées avec succès'
          : 'Aucune commande trouvée',
      data: {
        orders: sanitizedOrders,
        totalPages: responseBody.data.totalPages || 0,
        currentPage: responseBody.data.currentPage || urlParams.page || 1,
        count: responseBody.data.count || 0,
        perPage: responseBody.data.perPage || 10,
        deliveryPrice: responseBody.data.deliveryPrice || [],
        paidCount: responseBody.data.paidCount || 0,
        unpaidCount: responseBody.data.unpaidCount || 0,
        totalAmountOrders: responseBody.data.totalAmountOrders || 0,
      },
    };
  } catch (error) {
    // 11. Gestion des erreurs réseau/timeout
    if (error.name === 'AbortError') {
      console.error('Request timeout after 8 seconds');
      return {
        success: false,
        message: 'La requête a pris trop de temps',
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          deliveryPrice: [],
        },
      };
    }

    // Erreur réseau générique
    console.error('Network error:', error.message);
    return {
      success: false,
      message: 'Problème de connexion réseau',
      data: {
        orders: [],
        totalPages: 0,
        currentPage: 1,
        count: 0,
        deliveryPrice: [],
      },
    };
  }
};

// Composant de chargement dédié pour une meilleure expérience utilisateur
const OrdersPageSkeleton = () => (
  <div className="animate-pulse p-4">
    <div className="h-7 bg-gray-200 rounded w-48 mb-6"></div>
    {[...Array(3)].map((_, i) => (
      <div key={i} className="mb-6">
        <div className="h-64 bg-gray-200 rounded-md mb-3"></div>
      </div>
    ))}
  </div>
);

// Métadonnées enrichies pour SEO
export const metadata = {
  title: 'Historique de commandes | Buy It Now',
  description: "Consultez l'historique de vos commandes sur Buy It Now",
  robots: {
    index: false, // Page privée, ne pas indexer
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: '/me/orders',
  },
};

/**
 * Récupère et affiche l'historique des commandes d'un utilisateur
 * Server Component avec traitement d'erreurs et vérification d'authentification
 */
const MyOrdersPage = async ({ searchParams }) => {
  // Identifiant unique pour la traçabilité
  const requestId = `orderspage-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  logger.info('Orders page accessed', {
    requestId,
    page: searchParams?.page || 1,
    action: 'orders_page_access',
  });

  try {
    // Vérification de l'authentification côté serveur
    const nextCookies = await cookies();
    const cookieName = getCookieName();
    const sessionCookie = nextCookies.get(cookieName);

    // Rediriger si non authentifié
    if (!sessionCookie) {
      logger.warn('Unauthenticated access to orders page', {
        requestId,
        action: 'unauthenticated_access',
      });
      return redirect('/login?callbackUrl=/me/orders');
    }

    // Récupérer les commandes avec gestion d'erreurs
    const sanitizedSearchParams = {
      page: searchParams?.page || 1,
      // Autres paramètres de filtrage potentiels
    };

    // Utiliser Suspense pour mieux gérer le chargement
    const ordersPromise = await getAllOrders(sanitizedSearchParams);

    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">Mes commandes</h1>
        <Suspense fallback={<OrdersPageSkeleton />}>
          <OrdersData ordersPromise={ordersPromise} />
        </Suspense>
      </div>
    );
  } catch (error) {
    // Capture et journalisation de l'erreur
    logger.error('Error loading orders page', {
      requestId,
      error: error.message,
      stack: error.stack,
      action: 'orders_page_error',
    });

    captureException(error, {
      tags: { component: 'MyOrdersPage', action: 'page_load' },
      extra: { requestId, searchParams },
    });

    // Afficher un message d'erreur convivial
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Impossible de charger vos commandes
          </h2>
          <p className="text-red-600">
            Nous rencontrons actuellement des difficultés pour récupérer votre
            historique de commandes. Veuillez réessayer ultérieurement ou
            contacter notre service client.
          </p>
        </div>
      </div>
    );
  }
};

// Composant pour gérer le chargement async des données
const OrdersData = async ({ ordersPromise }) => {
  try {
    const orders = await ordersPromise;
    return <ListOrders orders={orders.data} />;
  } catch (error) {
    captureException(error, {
      tags: { component: 'OrdersData', action: 'data_fetch' },
    });

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">
          Une erreur est survenue lors du chargement de vos commandes. Veuillez
          réessayer.
        </p>
      </div>
    );
  }
};

export default MyOrdersPage;
