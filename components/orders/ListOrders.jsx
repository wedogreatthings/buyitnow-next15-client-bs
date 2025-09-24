'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingBag } from 'lucide-react'; // Icône pour panier vide
import captureClientError from '@/monitoring/sentry';

// Chargement dynamique des composants
const OrderItem = dynamic(() => import('./OrderItem'), {
  loading: () => <OrderItemSkeleton />,
  ssr: true,
});

const CustomPagination = dynamic(
  () => import('@/components/layouts/CustomPagination'),
  { ssr: true },
);

// Composant squelette pour le chargement
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
 * Version améliorée avec tous les champs du modèle
 */
const ListOrders = ({ orders }) => {
  console.log('Orders data:', orders); // Debugging
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');

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

  // Filtrage et tri des commandes
  const filteredAndSortedOrders = useMemo(() => {
    try {
      if (!hasOrders) return [];

      let filtered = [...orders.orders];

      // Filtrage par statut
      if (filterStatus !== 'all') {
        filtered = filtered.filter((order) => {
          if (filterStatus === 'paid') return order.paymentStatus === 'paid';
          if (filterStatus === 'unpaid')
            return order.paymentStatus === 'unpaid';
          if (filterStatus === 'refunded')
            return order.paymentStatus === 'refunded';
          if (filterStatus === 'cancelled')
            return order.paymentStatus === 'cancelled';
          if (filterStatus === 'delivered')
            return order.orderStatus === 'Delivered';
          if (filterStatus === 'processing')
            return order.orderStatus === 'Processing';
          if (filterStatus === 'shipped')
            return order.orderStatus === 'Shipped';
          return true;
        });
      }

      // Tri par date
      filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });

      return filtered;
    } catch (error) {
      // Monitoring : Erreur de traitement des données de commandes
      captureClientError(error, 'ListOrders', 'filterAndSort', true, {
        filterStatus,
        sortOrder,
        ordersCount: orders?.orders?.length || 0,
        hasValidOrders: hasOrders,
      });

      // Fallback sur un tableau vide
      return [];
    }
  }, [hasOrders, orders?.orders, filterStatus, sortOrder]);

  // Dans le useMemo pour orderStats
  const orderStats = useMemo(() => {
    try {
      if (!hasOrders)
        return { total: 0, paid: 0, unpaid: 0, delivered: 0, totalAmount: 0 };

      return orders.orders.reduce(
        (stats, order) => {
          stats.total++;
          if (order.paymentStatus === 'paid') {
            stats.paid++;
            stats.totalAmount += order.totalAmount || 0;
          }
          if (order.paymentStatus === 'unpaid') stats.unpaid++;
          if (order.orderStatus === 'Delivered') stats.delivered++;
          return stats;
        },
        { total: 0, paid: 0, unpaid: 0, delivered: 0, totalAmount: 0 },
      );
    } catch (error) {
      // Monitoring : Erreur de calcul des statistiques
      captureClientError(error, 'ListOrders', 'calculateStats', true, {
        ordersCount: orders?.orders?.length || 0,
        hasValidOrders: hasOrders,
      });

      // Fallback sur des stats vides
      return { total: 0, paid: 0, unpaid: 0, delivered: 0, totalAmount: 0 };
    }
  }, [hasOrders, orders?.orders]);

  // Dans handlePageChange
  const handlePageChange = useCallback(
    (pageNumber) => {
      try {
        // Validation des paramètres
        if (!pageNumber || pageNumber < 1 || pageNumber > totalPages) {
          const validationError = new Error(`Page invalide: ${pageNumber}`);
          captureClientError(
            validationError,
            'ListOrders',
            'pageValidation',
            false,
            {
              requestedPage: pageNumber,
              totalPages,
              currentPage,
            },
          );
          setError('Numéro de page invalide');
          return;
        }

        setIsLoading(true);
        router.push(`/me/orders?page=${pageNumber}`);
      } catch (err) {
        // Monitoring : Erreur de navigation critique
        captureClientError(err, 'ListOrders', 'navigationError', true, {
          requestedPage: pageNumber,
          currentPage,
          totalPages,
          errorMessage: err.message,
        });

        setError('Erreur lors du changement de page');
        console.error('Error changing page:', err);
      }
    },
    [router, currentPage, totalPages],
  );

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-semibold mb-4 sm:mb-0">
          Historique de vos commandes
        </h2>

        {/* Filtres et tri */}
        {hasOrders && (
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="paid">Payées</option>
              <option value="unpaid">Non payées</option>
              <option value="refunded">Remboursées</option>
              <option value="cancelled">Annulées</option>
              <option value="delivered">Livrées</option>
              <option value="processing">En traitement</option>
              <option value="shipped">Expédiées</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Plus récentes</option>
              <option value="asc">Plus anciennes</option>
            </select>
          </div>
        )}
      </div>

      {/* Statistiques */}
      {hasOrders && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Total commandes</p>
            <p className="text-xl font-bold text-gray-900">
              {orderStats.total}
            </p>
          </div>
          <div className="bg-green-50 p-3 rounded-md">
            <p className="text-sm text-green-600">Payées</p>
            <p className="text-xl font-bold text-green-900">
              {orderStats.paid}
            </p>
          </div>
          <div className="bg-red-50 p-3 rounded-md">
            <p className="text-sm text-red-600">Non payées</p>
            <p className="text-xl font-bold text-red-900">
              {orderStats.unpaid}
            </p>
          </div>
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm text-blue-600">Livrées</p>
            <p className="text-xl font-bold text-blue-900">
              {orderStats.delivered}
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-md">
            <p className="text-sm text-purple-600">Montant total</p>
            <p className="text-xl font-bold text-purple-900">
              ${orderStats.totalAmount.toFixed(2)}
            </p>
          </div>
        </div>
      )}

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
            <ShoppingBag />
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
          {filteredAndSortedOrders.length === 0 ? (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-md text-center">
              <p className="text-yellow-800">
                Aucune commande ne correspond à vos filtres.
              </p>
              <button
                onClick={() => setFilterStatus('all')}
                className="mt-3 text-blue-600 hover:text-blue-800 underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4" aria-label="Liste de vos commandes">
                {filteredAndSortedOrders.map((order) => (
                  <OrderItem
                    key={order._id}
                    order={order}
                    deliveryPrice={orders?.deliveryPrice?.[0]?.deliveryPrice}
                  />
                ))}
              </div>

              {totalPages > 1 && filterStatus === 'all' && (
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
        </>
      )}
    </div>
  );
};

export default ListOrders;
