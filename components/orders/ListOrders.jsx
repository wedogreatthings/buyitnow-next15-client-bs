'use client';

import { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';

import OrderContext from '@/context/OrderContext';

// Chargement dynamique des composants
const OrderItem = dynamic(() => import('@/components/orders/OrderItem'), {
  loading: () => <OrderItemSkeleton />,
  ssr: true,
});

const CustomPagination = dynamic(
  () => import('@/components/layouts/CustomPagination'),
  { ssr: true },
);

// Composant squelette pour le chargement des commandes
const OrderItemSkeleton = () => (
  <div
    className="p-3 lg:p-5 mb-5 bg-white border border-gray-200 rounded-md animate-pulse"
    aria-hidden="true"
  >
    <div className="flex justify-between mb-4">
      <div className="w-1/3">
        <div className="h-5 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </div>
    </div>
    <div className="grid md:grid-cols-4 gap-1">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="mb-3">
          <div className="h-4 bg-gray-200 rounded mb-2 w-24"></div>
          <div className="h-3 bg-gray-200 rounded mb-1 w-full"></div>
          <div className="h-3 bg-gray-200 rounded mb-1 w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Composant d'affichage de la liste des commandes
 * Gère l'état, le contexte et l'affichage conditionnel
 */
const ListOrders = ({ orders }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setDeliveryPrice } = useContext(OrderContext);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Obtenir la page courante depuis l'URL
  const currentPage = useMemo(() => {
    const page = searchParams?.get('page');
    return page ? parseInt(page, 10) : 1;
  }, [searchParams]);

  // Vérification et utilisation sûre des données
  const hasOrders = useMemo(() => {
    return (
      orders?.orders && Array.isArray(orders.orders) && orders.orders.length > 0
    );
  }, [orders]);

  const totalPages = useMemo(() => {
    return orders?.totalPages && !isNaN(parseInt(orders.totalPages))
      ? parseInt(orders.totalPages)
      : 1;
  }, [orders]);

  // Mise à jour du prix de livraison dans le contexte
  useEffect(() => {
    try {
      // Vérifier que les données sont valides avant mise à jour
      if (
        orders?.deliveryPrice &&
        Array.isArray(orders.deliveryPrice) &&
        orders.deliveryPrice[0]?.deliveryPrice
      ) {
        setDeliveryPrice(orders.deliveryPrice[0].deliveryPrice);
      }
    } catch (err) {
      console.error('Error setting delivery price:', err);
      captureException(err, {
        tags: { component: 'ListOrders', action: 'setDeliveryPrice' },
      });
    }
  }, [orders]);

  // Naviguer vers une page spécifique
  const handlePageChange = useCallback((pageNumber) => {
    try {
      setIsLoading(true);
      router.push(`/me/orders?page=${pageNumber}`);
    } catch (err) {
      setError('Erreur lors du changement de page');
      captureException(err, {
        tags: { component: 'ListOrders', action: 'pageChange' },
      });
    }
  }, []);

  // Réinitialiser les états lors du changement de données
  useEffect(() => {
    if (isLoading) setIsLoading(false);
    if (error) setError(null);
  }, [orders]);

  // Gérer les erreurs
  if (error) {
    return (
      <div
        className="p-4 bg-red-50 border border-red-200 rounded-md"
        role="alert"
      >
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <h2 className="text-xl font-semibold mb-5">
        Historique de vos commandes
      </h2>

      {isLoading ? (
        // État de chargement
        <div aria-live="polite" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <OrderItemSkeleton key={i} />
          ))}
        </div>
      ) : !hasOrders ? (
        // Aucune commande
        <div className="flex flex-col items-center p-8 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">Aucune commande</h3>
          <p className="text-gray-600 text-center mb-4">
            Vous n&apos;avez pas encore effectué de commande.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Découvrir nos produits
          </button>
        </div>
      ) : (
        // Liste des commandes
        <>
          <div className="space-y-4" aria-label="Liste de vos commandes">
            {orders.orders.map((order) => (
              <OrderItem key={order._id} order={order} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8">
              <CustomPagination
                totalPages={totalPages}
                currentPage={currentPage}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ListOrders;
