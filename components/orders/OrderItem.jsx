'use client';

import { memo, useState, useContext, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { captureException } from '@/monitoring/sentry';
import { formatPrice } from '@/helpers/helpers';

import OrderContext from '@/context/OrderContext';

// Chargement dynamique des composants
const OrderedProduct = dynamic(() => import('./OrderedProduct'), {
  loading: () => (
    <div className="h-28 bg-gray-100 rounded-md animate-pulse"></div>
  ),
  ssr: true,
});

/**
 * Composant d'affichage d'une commande individuelle
 * Optimisé avec mémoïsation et gestion d'erreurs
 */
const OrderItem = memo(({ order }) => {
  const [expanded, setExpanded] = useState(false);
  const { deliveryPrice } = useContext(OrderContext);

  // Validation des données
  if (!order || typeof order !== 'object' || !order._id) {
    return null;
  }

  // Formatage des dates
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Date non disponible';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (err) {
      captureException(err, {
        tags: { component: 'OrderItem', action: 'formatDate' },
        extra: { dateString },
      });
      return dateString.substring(0, 10);
    }
  }, []);

  // Gestion du basculement de l'expansion des détails
  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Validation et récupération sécurisée des données
  const orderNumber = order.orderNumber || order._id.substring(0, 8);
  const orderDate = formatDate(order.createdAt);
  const paymentStatus = order.paymentStatus || 'unpaid';
  const orderStatus = order.orderStatus || 'Processing';
  const hasShippingInfo = !!order.shippingInfo;

  // Calcul des montants
  const amountPaid = order.paymentInfo?.amountPaid || 0;
  const deliveryAmount = hasShippingInfo ? deliveryPrice || 0 : 0;
  const productsAmount = amountPaid - deliveryAmount;

  // Déterminer les statuts pour l'affichage
  const paymentStatusColor =
    paymentStatus === 'paid' ? 'text-green-800' : 'text-red-800';
  const orderStatusColor =
    orderStatus === 'Processing' ? 'text-red-500' : 'text-green-500';

  return (
    <article className="p-3 lg:p-5 mb-5 bg-white border border-blue-600 rounded-md shadow-sm hover:shadow-md transition-shadow">
      <header className="lg:flex justify-between mb-4">
        <div className="mb-4 lg:mb-0">
          <div className="flex items-center">
            <h3 className="font-semibold text-lg">
              Commande: <span className="font-mono">{orderNumber}</span>
            </h3>
            <button
              onClick={toggleExpanded}
              className="ml-2 p-1 rounded-full hover:bg-gray-100"
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
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span
              className={`font-semibold rounded-full px-2 py-0.5 text-xs ${paymentStatusColor} bg-opacity-10 ${paymentStatus === 'paid' ? 'bg-green-100' : 'bg-red-100'}`}
            >
              {paymentStatus.toUpperCase()}
            </span>

            {hasShippingInfo && (
              <span
                className={`font-semibold rounded-full px-2 py-0.5 text-xs ${orderStatusColor} bg-opacity-10 ${orderStatus === 'Processing' ? 'bg-red-100' : 'bg-green-100'}`}
              >
                {orderStatus.toUpperCase()}
              </span>
            )}

            <span className="text-gray-500 text-sm ml-2">{orderDate}</span>
          </div>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-4">
        <div>
          <p className="text-blue-700 mb-1 font-medium text-sm">Client</p>
          <ul className="text-gray-600 text-sm">
            <li>{order.user?.name || 'Client'}</li>
            <li>{order.user?.phone || '-'}</li>
            <li className="text-gray-500 text-xs truncate">
              {order.user?.email || '-'}
            </li>
          </ul>
        </div>

        {hasShippingInfo && (
          <div>
            <p className="text-blue-700 mb-1 font-medium text-sm">
              Adresse de livraison
            </p>
            <ul className="text-gray-600 text-sm">
              <li>{order.shippingInfo?.street || '-'}</li>
              <li>
                {[
                  order.shippingInfo?.city,
                  order.shippingInfo?.state,
                  order.shippingInfo?.zipCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </li>
              <li>{order.shippingInfo?.country || '-'}</li>
            </ul>
          </div>
        )}

        <div>
          <p className="text-blue-700 mb-1 font-medium text-sm">Montant payé</p>
          <ul className="text-gray-600 text-sm">
            <li>
              <span className="font-semibold">Produits:</span>{' '}
              {formatPrice(productsAmount)}
            </li>
            <li>
              <span className="font-semibold">Livraison:</span>{' '}
              {formatPrice(deliveryAmount)}
            </li>
            <li className="font-medium text-gray-800">
              <span className="font-semibold">Total:</span>{' '}
              {formatPrice(amountPaid)}
            </li>
          </ul>
        </div>

        <div>
          <p className="text-blue-700 mb-1 font-medium text-sm">Paiement</p>
          <ul className="text-gray-600 text-sm">
            <li>
              <span className="font-semibold">Mode:</span>{' '}
              {order.paymentInfo?.typePayment || '-'}
            </li>
            <li>
              <span className="font-semibold">Nom:</span>{' '}
              {order.paymentInfo?.paymentAccountName || '-'}
            </li>
            <li>
              <span className="font-semibold">Numéro:</span>{' '}
              {order.paymentInfo?.paymentAccountNumber || '-'}
            </li>
          </ul>
        </div>
      </div>

      {expanded && (
        <>
          <hr className="my-4" />
          <div>
            <p className="text-blue-700 mb-3 font-medium">Articles commandés</p>
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
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
