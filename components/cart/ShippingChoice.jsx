'use client';

import {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { captureException } from '@/monitoring/sentry';

// Imports optimisés
import CartContext from '@/context/CartContext';
import OrderContext from '@/context/OrderContext';
import { isArrayEmpty } from '@/helpers/helpers';

// Chargement dynamique des composants
const BreadCrumbs = dynamic(() => import('@/components/layouts/BreadCrumbs'), {
  loading: () => <div className="h-12 animate-pulse bg-gray-200 rounded"></div>,
  ssr: true,
});
const ItemShipping = dynamic(() => import('./components/ItemShipping'), {
  loading: () => <CartItemSkeleton />,
  ssr: true,
});

// Squelette pour chargement des items
const CartItemSkeleton = memo(() => (
  <div className="animate-pulse">
    <div className="flex items-center mb-4">
      <div className="w-20 h-20 rounded bg-gray-200"></div>
      <div className="ml-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
  </div>
));
CartItemSkeleton.displayName = 'CartItemSkeleton';

/**
 * Composant de choix de livraison
 *
 * @param {Object} props
 * @param {Array} props.addresses - Adresses disponibles pour la livraison
 * @param {Array} props.payments - Méthodes de paiement disponibles
 * @param {Array} props.deliveryPrice - Prix de livraison
 */
const ShippingChoice = ({ addresses, payments, deliveryPrice }) => {
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);
  const hasRedirected = useRef(false);

  const { cart } = useContext(CartContext);
  const {
    checkoutInfo,
    setOrderInfo,
    setAddresses,
    setPaymentTypes,
    setShippingStatus,
    setDeliveryPrice,
  } = useContext(OrderContext);

  const router = useRouter();

  // Chemins de fil d'Ariane
  const breadCrumbs = useMemo(
    () => [
      { name: 'Accueil', url: '/' },
      { name: 'Panier', url: '/cart' },
      { name: 'Mode de livraison', url: '' },
    ],
    [],
  );

  // Vérification et configuration des données au montage du composant
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);

        // Préchargement des pages pour navigation rapide
        router.prefetch('/payment');
        router.prefetch('/shipping');
        router.prefetch('/me');

        if (isArrayEmpty(addresses) && !hasRedirected.current) {
          hasRedirected.current = true;
          toast.error('Veuillez ajouter une adresse avant de continuer.');
          router.push('/me');
          return;
        }

        if (isArrayEmpty(payments) && !hasRedirected.current) {
          hasRedirected.current = true;
          toast.error(
            "Aucun moyen de paiement n'est disponible pour le moment. Veuillez réessayer plus tard.",
          );
          router.push('/cart');
          return;
        }

        // Stockage des données dans le contexte de commande
        setAddresses(addresses);
        setPaymentTypes(payments);

        // Récupérer le prix de livraison avec sécurité
        const price = deliveryPrice?.[0]?.deliveryPrice || 0;
        setDeliveryPrice(price);

        // Préparation des éléments de commande
        const orderItems = prepareOrderItems();
        setOrderInfo({ orderItems });
      } catch (error) {
        console.error(
          "Erreur lors de l'initialisation des données de livraison:",
          error,
        );
        captureException(error, {
          tags: { component: 'ShippingChoice', action: 'initializeData' },
        });
        toast.error(
          'Une erreur est survenue lors du chargement des options de livraison',
        );
        router.push('/cart');
      } finally {
        setIsLoading(false);
      }
    };

    if (!initialized.current) {
      initialized.current = true;
      initializeData();
    }
  }, []);

  // Fonction pour préparer les éléments de commande
  const prepareOrderItems = useCallback(() => {
    if (!Array.isArray(cart)) return [];

    return cart.map((item) => ({
      cartId: item?.id,
      product: item?.productId,
      name: item?.productName || 'Produit sans nom',
      category: 'Non catégorisé',
      quantity: item?.quantity || 1,
      price: item?.price,
      image: item?.imageUrl || '/images/default_product.png',
      subtotal: Number(item?.subtotal),
    }));
  }, [cart]);

  // Gestion des clics sur les options de livraison
  const handleYesClick = useCallback(() => {
    setShippingStatus(true);
  }, []);

  const handleNoClick = useCallback(() => {
    setShippingStatus(false);
  }, []);

  // Si en cours de chargement, afficher un indicateur
  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="shipping-choice min-h-screen bg-gray-50">
      <BreadCrumbs breadCrumbs={breadCrumbs} />

      <section className="py-8 md:py-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6">
            <main className="md:w-2/3">
              <div className="bg-white shadow rounded-lg p-6 transition-all duration-300">
                <h2 className="text-xl font-semibold text-center mb-8">
                  Souhaitez-vous être livré à domicile ?
                </h2>

                <div className="flex flex-col sm:flex-row justify-evenly gap-4 mt-8 mb-4">
                  <DeliveryOption
                    href="/shipping"
                    onClick={handleYesClick}
                    text="Oui, je souhaite être livré"
                    color="blue"
                    icon="home"
                  />

                  <DeliveryOption
                    href="/payment"
                    onClick={handleNoClick}
                    text="Non, je récupérerai mes articles en magasin"
                    color="red"
                    icon="store"
                  />
                </div>

                <p className="text-sm text-gray-500 mt-6 text-center">
                  En choisissant la livraison à domicile, des frais
                  supplémentaires peuvent s&apos;appliquer selon votre adresse.
                </p>
              </div>
            </main>

            <aside className="md:w-1/3">
              <OrderSummary checkoutInfo={checkoutInfo} cart={cart} />
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

// Composant d'option de livraison
const DeliveryOption = memo(({ href, onClick, text, color, icon }) => {
  const getColorClasses = () => {
    if (color === 'blue') {
      return {
        border: 'border-blue-300',
        hover: 'hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700',
        text: 'text-blue-800',
      };
    }
    return {
      border: 'border-red-300',
      hover: 'hover:bg-red-50 hover:border-red-400 hover:text-red-700',
      text: 'text-red-800',
    };
  };

  const colors = getColorClasses();

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-6 border-2 ${colors.border} rounded-lg ${colors.hover} transition-colors duration-200 group flex-1`}
    >
      <div className="mb-3">
        {icon === 'home' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-400 group-hover:text-blue-500 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-400 group-hover:text-red-500 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        )}
      </div>
      <p className={`font-medium ${colors.text}`}>{text}</p>
    </Link>
  );
});
DeliveryOption.displayName = 'DeliveryOption';

// Composant de résumé de commande
const OrderSummary = memo(({ checkoutInfo, cart = [] }) => {
  // Calcul du montant total formaté
  const formattedAmount = useMemo(() => {
    const amount = checkoutInfo?.amount || 0;
    return typeof amount === 'number' ? amount.toFixed(2) : '0.00';
  }, [checkoutInfo]);

  console.log('Formatted Amount:', formattedAmount);

  return (
    <div className="bg-white shadow rounded-lg p-6 sticky top-24">
      <h2 className="font-semibold text-lg mb-4 pb-4 border-b border-gray-200">
        Récapitulatif de commande
      </h2>

      <ul className="space-y-1 mb-6">
        {checkoutInfo?.tax > 0 && (
          <li className="flex justify-between text-gray-600">
            <span>Taxes:</span>
            <span>$ {Number(checkoutInfo.tax).toFixed(2)}</span>
          </li>
        )}

        <li className="flex justify-between text-lg font-bold text-gray-800 border-t pt-4 mt-3">
          <span>Total:</span>
          <span>$ {formattedAmount}</span>
        </li>
      </ul>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="font-medium text-gray-800 mb-3">
          Produits dans votre panier
        </h3>

        <div className="space-y-3 max-h-80 overflow-auto pr-2 hide-scrollbar">
          {Array.isArray(cart) && cart.length > 0 ? (
            cart.map((item) => <ItemShipping key={item.id} item={item} />)
          ) : (
            <p className="text-gray-500 text-sm italic py-2">
              Aucun produit dans votre panier
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
OrderSummary.displayName = 'OrderSummary';

export default ShippingChoice;
