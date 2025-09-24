'use client';

import {
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { captureException } from '@/monitoring/sentry';

// Imports optimisés
import CartContext from '@/context/CartContext';
import OrderContext from '@/context/OrderContext';
import { isArrayEmpty, formatPrice, safeValue } from '@/helpers/helpers';
import { validateAddressSelection } from '@/helpers/validation';
import { MapPin, Phone, Plus, ShoppingCart } from 'lucide-react';

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
 * Composant de sélection d'adresse de livraison
 * @param {Object} props - Propriétés du composant
 * @param {Object} props.initialData - Données initiales des adresses et paiements
 */
const Shipping = ({ initialData }) => {
  console.log('Rendering Shipping component with initialData:', initialData);
  // États locaux
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const initialized = useRef(false);

  // Contextes
  const { cart, cartTotal, cartCount } = useContext(CartContext);
  const {
    addresses,
    paymentTypes,
    shippingInfo,
    deliveryPrice,
    setShippingInfo,
    setAddresses,
    setPaymentTypes,
  } = useContext(OrderContext);

  const router = useRouter();

  // Chemins de fil d'Ariane
  const breadCrumbs = useMemo(
    () => [
      { name: 'Accueil', url: '/' },
      { name: 'Choix', url: '/shipping-choice' },
      { name: 'Adresse de livraison', url: '' },
    ],
    [],
  );

  // Calculer le montant total avec livraison
  const totalAmount = useMemo(() => {
    const delivery =
      typeof deliveryPrice === 'number'
        ? deliveryPrice
        : parseFloat(deliveryPrice || 0);

    return Number((cartTotal + delivery).toFixed(2));
  }, [deliveryPrice]);

  // Initialisation des données
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);

        // Préchargement de la page de paiement
        router.prefetch('/payment');

        // Utiliser les données initiales si disponibles, sinon utiliser le contexte
        const addressData = initialData?.addresses || addresses;
        const paymentData = initialData?.paymentTypes || paymentTypes;

        // Vérifier les méthodes de paiement
        if (isArrayEmpty(paymentData)) {
          toast.error(
            "Aucun moyen de paiement n'est disponible. Veuillez réessayer plus tard.",
            {
              position: 'bottom-right',
              autoClose: 5000,
            },
          );
          return router.push('/cart');
        }

        // Mettre à jour le contexte avec les données initiales
        if (initialData) {
          setAddresses(addressData);
          setPaymentTypes(paymentData);
        }

        // Restaurer l'adresse sélectionnée précédemment si elle existe
        if (shippingInfo) {
          setSelectedAddress(shippingInfo);
        }
      } catch (error) {
        console.error(
          "Erreur lors de l'initialisation des données de livraison:",
          error,
        );
        captureException(error, {
          tags: { component: 'Shipping', action: 'initializeData' },
        });
        toast.error(
          'Une erreur est survenue lors du chargement des options de livraison',
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (!initialized.current) {
      initialized.current = true;
      initializeData();
    }
  }, []);

  // 2. Remplacer la fonction handleAddressSelection par ceci :
  const handleAddressSelection = useCallback(
    async (addressId) => {
      try {
        // Utiliser la validation existante
        const { isValid, errors } = await validateAddressSelection({
          selectedAddressId: addressId,
        });

        if (isValid) {
          setSelectedAddress(addressId);
          setShippingInfo(addressId);

          // Feedback positif optionnel
          toast.success('Adresse de livraison sélectionnée', {
            position: 'bottom-right',
            autoClose: 2000,
          });
        } else {
          // Afficher l'erreur de validation
          const errorMessage =
            errors.selectedAddressId || 'Adresse de livraison invalide';
          toast.error(errorMessage, {
            position: 'bottom-right',
          });
          console.warn("Sélection d'adresse non valide:", errors);
        }
      } catch (error) {
        console.error("Erreur lors de la validation d'adresse:", error);
        captureException(error, {
          tags: { component: 'Shipping', action: 'handleAddressSelection' },
        });

        // Comportement dégradé: accepter la sélection même en cas d'erreur
        setSelectedAddress(addressId);
        setShippingInfo(addressId);

        toast.error('Erreur de validation, mais adresse sélectionnée', {
          position: 'bottom-right',
        });
      }
    },
    [setShippingInfo],
  );

  // Gérer le passage au paiement
  const handleCheckout = useCallback(() => {
    if (!selectedAddress) {
      toast.error('Veuillez sélectionner une adresse de livraison', {
        position: 'bottom-right',
      });
      return;
    }

    router.push('/payment');
  }, [selectedAddress]);

  // Rendu pour le cas où aucun panier n'existe
  if (!cart || !Array.isArray(cart) || cartCount === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="bg-blue-50 rounded-full p-6 mb-6">
            <ShoppingCart size={72} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-semibold mb-3">Votre panier est vide</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Vous devez ajouter des produits à votre panier avant de passer à la
            livraison.
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Découvrir nos produits
          </Link>
        </div>
      </div>
    );
  }

  // Afficher un indicateur de chargement
  if (isLoading) {
    return <ShippingPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadCrumbs breadCrumbs={breadCrumbs} />

      <section className="py-8 md:py-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6">
            <main className="md:w-2/3">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6 pb-2 border-b">
                  Adresse de livraison
                </h2>

                {addresses.length === 0 ? (
                  <NoAddressesFound />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {addresses.map((address) => (
                      <AddressCard
                        key={address._id}
                        address={address}
                        isSelected={selectedAddress === address._id}
                        onSelect={handleAddressSelection}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-6">
                  <Link
                    href="/address/new"
                    className="px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex items-center"
                  >
                    <Plus className="mr-2" />
                    Ajouter une nouvelle adresse
                  </Link>
                </div>

                <div className="flex justify-end space-x-3 mt-10">
                  <Link
                    href="/shipping-choice"
                    className="px-4 py-2 text-gray-700 bg-white shadow-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Retour
                  </Link>

                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={!selectedAddress}
                    className={`px-5 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      selectedAddress
                        ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                    aria-label={
                      selectedAddress
                        ? 'Continuer vers le paiement'
                        : 'Veuillez sélectionner une adresse'
                    }
                  >
                    Continuer vers le paiement
                  </button>
                </div>
              </div>
            </main>

            <aside className="md:w-1/3">
              <OrderSummary
                cart={cart}
                cartCount={cartCount}
                baseAmount={safeValue(cartTotal.toFixed(2), 0)}
                deliveryPrice={deliveryPrice}
                totalAmount={totalAmount}
              />
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

// Composant d'affichage quand aucune adresse n'est trouvée
const NoAddressesFound = memo(() => (
  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
    <MapPin className="mr-2" />
    <p className="font-semibold text-lg mb-2">Aucune adresse trouvée</p>
    <p className="text-gray-600 mb-4 px-4">
      Veuillez ajouter au moins une adresse pour continuer votre commande.
    </p>
    <Link
      href="/address/new"
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
    >
      <Plus className="mr-2" />
      Ajouter une adresse
    </Link>
  </div>
));
NoAddressesFound.displayName = 'NoAddressesFound';

// Composant carte d'adresse
const AddressCard = memo(({ address, isSelected, onSelect }) => (
  <label
    className={`flex p-4 border rounded-lg transition-all duration-200 cursor-pointer ${
      isSelected
        ? 'bg-blue-50 border-blue-400 shadow-sm'
        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
    }`}
  >
    <span className="flex items-start">
      <input
        name="shipping"
        type="radio"
        checked={isSelected}
        onChange={() => onSelect(address._id)}
        className="h-4 w-4 mt-1.5 text-blue-600 focus:ring-blue-500"
      />
      <div className="ml-3">
        <p className="font-medium text-gray-800">{address.street}</p>
        <div className="text-sm text-gray-500 mt-1">
          <p>
            {[
              address.city,
              address.state && address.zipCode
                ? `${address.state}, ${address.zipCode}`
                : address.state || address.zipCode,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p className="mt-1">{address.country}</p>
          {address.phoneNo && (
            <p className="mt-1 flex items-center">
              <Phone className="mr-2" />
              {address.phoneNo}
            </p>
          )}
        </div>
      </div>
    </span>
  </label>
));
AddressCard.displayName = 'AddressCard';

// Composant de résumé de commande
const OrderSummary = memo(
  ({
    cart = [],
    cartCount,
    baseAmount = 0,
    deliveryPrice = 0,
    totalAmount = 0,
  }) => (
    <div className="bg-white shadow rounded-lg p-6 sticky top-24">
      <h2 className="font-semibold text-lg mb-4 pb-2 border-b">
        Récapitulatif de commande
      </h2>

      <ul className="space-y-3">
        <li className="flex justify-between text-gray-600">
          <span>Total du panier:</span>
          <span>{formatPrice(baseAmount)}</span>
        </li>

        <li className="flex justify-between text-gray-600">
          <span>Frais de livraison:</span>
          <span>{formatPrice(deliveryPrice)}</span>
        </li>

        <li className="flex justify-between text-lg font-bold text-gray-800 border-t pt-3 mt-3">
          <span>Total à payer:</span>
          <span className="text-blue-600">{formatPrice(totalAmount)}</span>
        </li>
      </ul>

      <div className="border-t border-gray-200 pt-4 mt-4">
        <h3 className="font-medium text-gray-800 mb-3">
          Produits ({Array.isArray(cart) ? cartCount : 0})
        </h3>

        <div className="space-y-3 max-h-80 overflow-auto pr-2 hide-scrollbar">
          {Array.isArray(cart) && cartCount > 0 ? (
            cart.map((item) => (
              <ItemShipping key={item.id || item._id} item={item} />
            ))
          ) : (
            <p className="text-gray-500 text-sm italic py-2">
              Aucun produit dans votre panier
            </p>
          )}
        </div>
      </div>
    </div>
  ),
);
OrderSummary.displayName = 'OrderSummary';

// Squelette de chargement pour la page
const ShippingPageSkeleton = memo(() => (
  <div className="min-h-screen bg-gray-50">
    <div className="h-12 bg-gray-200 animate-pulse rounded-md mb-8"></div>

    <section className="py-8">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6">
          <main className="md:w-2/3">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="h-8 bg-gray-200 animate-pulse rounded-md w-1/3 mb-6"></div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 bg-gray-200 animate-pulse rounded-md"
                  ></div>
                ))}
              </div>

              <div className="flex justify-between mt-10">
                <div className="h-10 bg-gray-200 animate-pulse rounded-md w-32"></div>
                <div className="h-10 bg-gray-200 animate-pulse rounded-md w-48"></div>
              </div>
            </div>
          </main>

          <aside className="md:w-1/3">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="h-6 bg-gray-200 animate-pulse rounded-md w-1/2 mb-4"></div>

              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-gray-200 animate-pulse rounded-md w-1/3"></div>
                    <div className="h-4 bg-gray-200 animate-pulse rounded-md w-1/4"></div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-gray-200 my-4"></div>

              <div className="h-6 bg-gray-200 animate-pulse rounded-md w-1/3 mb-3"></div>

              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center">
                    <div className="w-16 h-16 bg-gray-200 animate-pulse rounded-md"></div>
                    <div className="ml-3 space-y-2 flex-1">
                      <div className="h-4 bg-gray-200 animate-pulse rounded-md"></div>
                      <div className="h-3 bg-gray-200 animate-pulse rounded-md w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  </div>
));
ShippingPageSkeleton.displayName = 'ShippingPageSkeleton';

export default Shipping;
