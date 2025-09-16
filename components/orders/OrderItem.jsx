'use client';

import { memo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Chargement dynamique des composants
const OrderedProduct = dynamic(() => import('./OrderedProduct'), {
  loading: () => (
    <div className="h-28 bg-gray-100 rounded-md animate-pulse"></div>
  ),
  ssr: true,
});

/**
 * Composant d'affichage d'une commande individuelle
 * Version améliorée avec tous les champs du modèle Order
 */
const OrderItem = memo(({ order, deliveryPrice = 0 }) => {
  const [expanded, setExpanded] = useState(false);

  // Validation des données
  if (!order || typeof order !== 'object' || !order._id) {
    return null;
  }

  // Formatage des dates avec gestion d'erreur
  const formatDate = useCallback((dateString, format = 'full') => {
    if (!dateString) return 'Date non disponible';
    try {
      const date = new Date(dateString);

      if (format === 'short') {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }

      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      console.error('Date formatting error:', err);
      return dateString.substring(0, 10);
    }
  }, []);

  // Gestion du basculement de l'expansion des détails
  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Extraction et validation des données de la commande
  const orderNumber = order.orderNumber || `ORD-${order._id.substring(0, 8)}`;
  const updatedDate = order.updatedAt ? formatDate(order.updatedAt) : null;
  const paymentStatus = order.paymentStatus || 'unpaid';
  const orderStatus = order.orderStatus || 'Processing';
  const hasShippingInfo = !!order.shippingInfo;

  // Utilisation des montants du modèle Order
  const totalAmount = order.totalAmount || 0;
  const shippingAmount =
    order.shippingAmount || (hasShippingInfo ? deliveryPrice : 0);
  const taxAmount = order.taxAmount || 0;
  const itemsTotal = totalAmount - shippingAmount - taxAmount;

  // Calcul du nombre total d'articles
  const totalItems =
    order.orderItems?.reduce(
      (total, item) => total + (item.quantity || 0),
      0,
    ) || 0;

  // Configuration des couleurs selon le statut de paiement
  const getPaymentStatusStyle = (status) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'unpaid':
        return 'text-red-600 bg-red-100';
      case 'refunded':
        return 'text-orange-600 bg-orange-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Configuration des couleurs selon le statut de commande
  const getOrderStatusStyle = (status) => {
    switch (status) {
      case 'Delivered':
        return 'text-green-600 bg-green-100';
      case 'Shipped':
        return 'text-blue-600 bg-blue-100';
      case 'Processing':
        return 'text-yellow-600 bg-yellow-100';
      case 'Unpaid':
        return 'text-red-600 bg-red-100';
      case 'Cancelled':
        return 'text-gray-600 bg-gray-100';
      case 'Returned':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <article className="p-3 lg:p-5 mb-5 bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow">
      <header className="lg:flex justify-between mb-4">
        <div className="mb-4 lg:mb-0">
          <div className="flex items-center">
            <h3 className="font-semibold text-lg">
              Commande:{' '}
              <span className="font-mono text-gray-700">{orderNumber}</span>
            </h3>
            <button
              onClick={toggleExpanded}
              className="ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label={
                expanded ? 'Réduire les détails' : 'Voir plus de détails'
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${getPaymentStatusStyle(paymentStatus)}`}
            >
              {paymentStatus.toUpperCase()}
            </span>

            {hasShippingInfo && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${getOrderStatusStyle(orderStatus)}`}
              >
                {orderStatus.toUpperCase()}
              </span>
            )}

            {!hasShippingInfo && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                RETRAIT EN MAGASIN
              </span>
            )}

            <span className="text-gray-500 text-sm ml-2">
              {formatDate(order.createdAt, 'short')}
            </span>

            <span className="text-gray-500 text-sm">
              • {totalItems} article{totalItems > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Montant total en header */}
        <div className="text-right">
          <p className="text-sm text-gray-600">Montant total</p>
          <p className="text-2xl font-bold text-blue-600">
            ${totalAmount.toFixed(2)}
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-4">
        <div>
          <p className="text-gray-600 mb-1 font-medium text-sm">Client</p>
          <ul className="text-gray-700 text-sm space-y-1">
            <li className="font-medium">{order.user?.name || 'Client'}</li>
            {order.user?.phone && (
              <li className="text-gray-600">{order.user.phone}</li>
            )}
            <li className="text-gray-600 text-xs truncate">
              {order.user?.email || 'Email non disponible'}
            </li>
          </ul>
        </div>

        {hasShippingInfo ? (
          <div>
            <p className="text-gray-600 mb-1 font-medium text-sm">
              Adresse de livraison
            </p>
            <ul className="text-gray-700 text-sm space-y-1">
              <li>{order.shippingInfo?.street || '-'}</li>
              <li>
                {[
                  order.shippingInfo?.city,
                  order.shippingInfo?.state,
                  order.shippingInfo?.zipCode,
                ]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </li>
              <li className="font-medium">
                {order.shippingInfo?.country || '-'}
              </li>
            </ul>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-1 font-medium text-sm">
              Mode de réception
            </p>
            <div className="bg-blue-50 p-2 rounded text-sm">
              <p className="font-medium text-blue-800">Retrait en magasin</p>
              <p className="text-blue-600 text-xs mt-1">
                Aucuns frais de livraison
              </p>
            </div>
          </div>
        )}

        <div>
          <p className="text-gray-600 mb-1 font-medium text-sm">
            Détail financier
          </p>
          <ul className="text-gray-700 text-sm space-y-1">
            <li>
              <span className="text-gray-600">Articles:</span>{' '}
              <span className="font-medium">${itemsTotal.toFixed(2)}</span>
            </li>
            {taxAmount > 0 && (
              <li>
                <span className="text-gray-600">Taxes:</span>{' '}
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </li>
            )}
            <li>
              <span className="text-gray-600">Livraison:</span>{' '}
              <span className="font-medium">${shippingAmount.toFixed(2)}</span>
            </li>
            <li className="pt-1 border-t border-gray-200">
              <span className="font-semibold">Total:</span>{' '}
              <span className="font-bold text-blue-600">
                ${totalAmount.toFixed(2)}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-gray-600 mb-1 font-medium text-sm">
            Information de paiement
          </p>
          <ul className="text-gray-700 text-sm space-y-1">
            <li>
              <span className="text-gray-600">Mode:</span>{' '}
              <span className="font-medium">
                {order.paymentInfo?.typePayment || '-'}
              </span>
            </li>
            <li>
              <span className="text-gray-600">Nom:</span>{' '}
              <span className="font-medium">
                {order.paymentInfo?.paymentAccountName || '-'}
              </span>
            </li>
            <li>
              <span className="text-gray-600">Numéro:</span>{' '}
              <span className="font-medium">
                {order.paymentInfo?.paymentAccountNumber || '••••••••'}
              </span>
            </li>
            {order.paymentInfo?.amountPaid !== undefined && (
              <li>
                <span className="text-gray-600">Montant payé:</span>{' '}
                <span className="font-medium">
                  ${order.paymentInfo.amountPaid.toFixed(2)}
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {expanded && (
        <>
          <hr className="my-4" />

          {/* Timeline des dates importantes */}
          {(order.paidAt || order.deliveredAt || order.cancelledAt) && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-2 font-medium text-sm">
                Historique de la commande
              </p>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                {order.paidAt && (
                  <div>
                    <span className="font-medium text-green-600">
                      Payée le:
                    </span>
                    <p className="text-gray-700">{formatDate(order.paidAt)}</p>
                  </div>
                )}
                {order.deliveredAt && (
                  <div>
                    <span className="font-medium text-blue-600">
                      Livrée le:
                    </span>
                    <p className="text-gray-700">
                      {formatDate(order.deliveredAt)}
                    </p>
                  </div>
                )}
                {order.cancelledAt && (
                  <div>
                    <span className="font-medium text-red-600">
                      Annulée le:
                    </span>
                    <p className="text-gray-700">
                      {formatDate(order.cancelledAt)}
                    </p>
                  </div>
                )}
                {updatedDate && (
                  <div>
                    <span className="font-medium text-gray-600">
                      Dernière mise à jour:
                    </span>
                    <p className="text-gray-700">{updatedDate}</p>
                  </div>
                )}
              </div>

              {order.cancelReason && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="font-medium text-red-600 text-sm">
                    Raison d&apos;annulation:
                  </p>
                  <p className="text-red-700 text-sm mt-1">
                    {order.cancelReason}
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-gray-600 mb-3 font-medium">Articles commandés</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {order.orderItems &&
              Array.isArray(order.orderItems) &&
              order.orderItems.length > 0 ? (
                order.orderItems.map((item) => (
                  <OrderedProduct
                    key={
                      item._id ||
                      `item-${Math.random().toString(36).substring(2)}`
                    }
                    item={item}
                  />
                ))
              ) : (
                <p className="text-gray-500 italic col-span-full">
                  Aucun article dans cette commande
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="text-center mt-4">
        <button
          onClick={toggleExpanded}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
        >
          {expanded ? 'Masquer les détails' : 'Afficher les détails'}
        </button>
      </div>
    </article>
  );
});

// Ajouter un displayName pour faciliter le débogage
OrderItem.displayName = 'OrderItem';

export default OrderItem;
