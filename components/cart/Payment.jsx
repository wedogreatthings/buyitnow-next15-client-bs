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
import PaymentPageSkeleton from '../skeletons/PaymentPageSkeleton';
import { validateDjiboutiPayment } from '@/helpers/validation';

// Chargement dynamique des composants
const BreadCrumbs = dynamic(() => import('@/components/layouts/BreadCrumbs'), {
  loading: () => <div className="h-12 animate-pulse bg-gray-200 rounded"></div>,
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
 * Composant de paiement
 * Permet à l'utilisateur de sélectionner un moyen de paiement local et finaliser sa commande
 */
const Payment = () => {
  // États locaux
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState(null);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [dataInitialized, setDataInitialized] = useState(false);

  // Référence pour limiter les soumissions multiples
  const submitAttempts = useRef(0);

  // Contextes
  const { cart } = useContext(CartContext);

  const {
    checkoutInfo,
    orderInfo,
    setOrderInfo,
    addOrder,
    paymentTypes,
    shippingInfo,
    deliveryPrice,
    shippingStatus,
    error,
    clearErrors,
  } = useContext(OrderContext);

  const router = useRouter();

  // Calcul du montant total
  const totalAmount = useMemo(() => {
    const baseAmount = Number(safeValue(checkoutInfo?.amount, 0));
    const shipping = shippingStatus ? Number(safeValue(deliveryPrice, 0)) : 0;
    return (baseAmount + shipping).toFixed(2);
  }, [deliveryPrice, shippingStatus]);

  // Chemins de fil d'Ariane
  const breadCrumbs = useMemo(() => {
    const steps = [
      { name: 'Accueil', url: '/' },
      { name: 'Panier', url: '/cart' },
    ];

    // Ajouter l'étape en fonction du statut de livraison
    if (shippingStatus) {
      steps.push({ name: 'Livraison', url: '/shipping' });
    } else {
      steps.push({ name: 'Mode de livraison', url: '/shipping-choice' });
    }

    steps.push({ name: 'Paiement', url: '' });

    return steps;
  }, [shippingStatus]);

  // Initialisation des données et validation
  useEffect(() => {
    const initializePaymentPage = async () => {
      try {
        setIsLoading(true);

        // Précharger la page de confirmation
        router.prefetch('/confirmation');

        // Vérifier que les infos nécessaires sont présentes
        if (!checkoutInfo || !orderInfo || !orderInfo.orderItems) {
          toast.error('Informations de commande incomplètes', {
            position: 'bottom-right',
            autoClose: 5000,
          });
          return router.push('/cart');
        }

        // Mettre à jour les informations de commande avec l'adresse de livraison
        setOrderInfo({
          ...orderInfo,
          shippingInfo,
        });

        // Vérifier si des moyens de paiement sont disponibles
        if (isArrayEmpty(paymentTypes)) {
          toast.error("Aucun moyen de paiement n'est disponible actuellement", {
            position: 'bottom-right',
            autoClose: 5000,
          });
        }

        setDataInitialized(true);
      } catch (error) {
        console.error(
          "Erreur lors de l'initialisation de la page de paiement:",
          error,
        );
        captureException(error, {
          tags: { component: 'Payment', action: 'initializePaymentPage' },
        });

        toast.error(
          'Une erreur est survenue lors du chargement des options de paiement',
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (!dataInitialized) {
      initializePaymentPage();
    }
  }, [shippingInfo, paymentTypes, dataInitialized]);

  // Handle auth context updates
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
    }
  }, [error, clearErrors]);

  // Handlers pour les changements de champs
  const handlePaymentTypeChange = useCallback((value) => {
    setPaymentType(value);
  }, []);

  const handleAccountNameChange = useCallback((e) => {
    setAccountName(e.target.value.trim());
  }, []);

  const handleAccountNumberChange = useCallback((e) => {
    // Permettre seulement les chiffres et formater pour une meilleure lisibilité
    const rawValue = e.target.value.replace(/[^\d]/g, '');

    setAccountNumber(rawValue); // Stocke la valeur sans espaces pour le traitement
  }, []);

  // 2. Créer une fonction d'adaptation pour mapper tes champs vers le schéma existant
  const mapToPaymentSchema = (paymentType, accountName, accountNumber) => {
    return {
      paymentPlatform: paymentType?.toLowerCase().replace(/[\s-]/g, '-'), // Adapter le nom
      accountHolderName: accountName,
      phoneNumber: accountNumber, // En assumant que le numéro de compte est un téléphone
    };
  };

  // Payment.jsx - Remplacer la ligne 253-283 par :
  const validatePaymentData = async () => {
    // Validation universelle d'abord
    if (!paymentType || !accountName || !accountNumber) {
      return {
        isValid: false,
        errors: { general: 'Tous les champs sont requis' },
      };
    }

    // Validation du nom (toujours requise)
    const nameWords = accountName.trim().split(/\s+/);
    if (nameWords.length < 2 || nameWords.some((w) => w.length < 2)) {
      return {
        isValid: false,
        errors: { accountName: 'Prénom et nom complets requis' },
      };
    }

    // Validation selon le type de compte
    // Nettoyer le numéro (enlever espaces, tirets, etc.)
    const cleanNumber = accountNumber.replace(/\D/g, '');

    // Validation selon le type de numéro
    let validationPassed = false;

    // Si c'est un numéro djiboutien (77XXXXXX)
    if (cleanNumber.match(/^77[0-9]{6}$/)) {
      const paymentData = mapToPaymentSchema(
        paymentType,
        accountName,
        cleanNumber,
      );

      const validationResult = await validateDjiboutiPayment(paymentData);

      if (!validationResult.isValid) {
        const errorMessages = Object.values(validationResult.errors);
        errorMessages.forEach((msg) => {
          toast.error(msg, { position: 'bottom-right' });
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }
      validationPassed = true;
    } else {
      // Validation pour TOUS les autres types de paiement
      // Plus strict que juste vérifier la longueur

      if (cleanNumber.length < 4 || cleanNumber.length > 30) {
        toast.error(
          'Le numéro de compte doit contenir entre 4 et 30 chiffres',
          {
            position: 'bottom-right',
          },
        );
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      // Vérifier que ce n'est pas juste des zéros ou un pattern simple
      if (/^0+$/.test(cleanNumber) || /^(\d)\1+$/.test(cleanNumber)) {
        toast.error('Numéro de compte invalide', {
          position: 'bottom-right',
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      // Validation du nom (pour tous les types)
      const words = accountName.trim().split(/\s+/);
      if (words.length < 2 || words.some((w) => w.length < 2)) {
        toast.error('Veuillez saisir votre prénom et nom complets', {
          position: 'bottom-right',
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      validationPassed = true;
    }

    // Si on arrive ici, la validation est passée
    if (!validationPassed) {
      toast.error('Validation échouée', { position: 'bottom-right' });
      setIsSubmitting(false);
      submitAttempts.current = 0;
      return;
    }

    return { isValid: true, data: { accountName, accountNumber: cleanNumber } };
  };

  // Handler pour la soumission du paiement
  const handlePayment = useCallback(async () => {
    // Empêcher les soumissions multiples rapides
    submitAttempts.current += 1;
    if (submitAttempts.current > 1) {
      setTimeout(() => {
        submitAttempts.current = 0;
      }, 5000);
      return toast.info('Traitement en cours, veuillez patienter...', {
        position: 'bottom-right',
      });
    }

    try {
      setIsSubmitting(true);

      // Remplacer toute la section de validation par :
      const validationResult = await validatePaymentData();
      if (!validationResult.isValid) {
        const errorMessages = Object.values(validationResult.errors || {});
        errorMessages.forEach((msg) =>
          toast.error(msg, { position: 'bottom-right' }),
        );
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      // Création des informations de paiement
      const paymentInfo = {
        amountPaid: parseFloat(totalAmount),
        typePayment: paymentType,
        paymentAccountNumber: accountNumber,
        paymentAccountName: accountName,
        paymentDate: new Date().toISOString(),
      };

      // Préparation des données de commande
      const finalOrderInfo = {
        ...orderInfo,
        paymentInfo,
        taxAmount: checkoutInfo?.tax,
        totalAmount: checkoutInfo?.totalAmount,
        shippingAmount: shippingStatus ? deliveryPrice : 0,
      };

      // Supprimer les infos de livraison si pas de livraison
      if (!shippingStatus) {
        delete finalOrderInfo.shippingInfo;
      }

      // Effectuer la commande
      await addOrder(finalOrderInfo);

      // Réinitialiser l'état du formulaire
      setPaymentType(null);
      setAccountName('');
      setAccountNumber('');

      // Le succès est géré par le contexte qui redirige vers la confirmation
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      captureException(error, {
        tags: { component: 'Payment', action: 'handlePayment' },
        extra: {
          hasOrderInfo: !!orderInfo,
          hasPaymentType: !!paymentType,
        },
      });

      toast.error(
        error.message ||
          'Une erreur est survenue lors du traitement du paiement',
        {
          position: 'bottom-right',
          autoClose: 5000,
        },
      );
    } finally {
      setIsSubmitting(false);
      submitAttempts.current = 0;
    }
  }, [
    paymentType,
    accountName,
    accountNumber,
    shippingStatus,
    totalAmount,
    orderInfo,
    checkoutInfo,
    deliveryPrice,
    addOrder,
  ]);

  // Rendu conditionnel pour le cas de chargement
  if (isLoading) {
    return <PaymentPageSkeleton />;
  }

  // Rendu conditionnel pour le cas où le panier est vide
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="bg-blue-50 rounded-full p-6 mb-6">
            <svg
              className="w-16 h-16 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-3">Votre panier est vide</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Vous devez ajouter des produits à votre panier avant de procéder au
            paiement.
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

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadCrumbs breadCrumbs={breadCrumbs} />

      <section className="py-8 md:py-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6">
            <main className="md:w-2/3">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6 pb-2 border-b">
                  Choisissez votre moyen de paiement
                </h2>

                {isArrayEmpty(paymentTypes) ? (
                  <NoPaymentMethodsFound />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {paymentTypes?.map((payment) => (
                      <PaymentMethodCard
                        key={payment?._id}
                        payment={payment}
                        isSelected={paymentType === payment?.paymentName}
                        onSelect={handlePaymentTypeChange}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <p className="flex items-start">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Cette transaction est sécurisée. Vos informations de
                    paiement ne sont pas stockées et sont transmises de manière
                    cryptée.
                  </p>
                </div>
              </div>
            </main>

            <aside className="md:w-1/3">
              <div className="bg-white shadow rounded-lg p-6 sticky top-24">
                <h2 className="font-semibold text-lg mb-6 pb-2 border-b">
                  Finaliser votre paiement
                </h2>

                <div className="space-y-4 mb-6">
                  <div className="form-group">
                    <label className="block text-gray-700 mb-1 font-medium text-sm">
                      Nom sur le compte <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-200 focus:outline-none transition-colors ${
                        errors.accountName
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                      }`}
                      type="text"
                      placeholder="Nom complet sur le compte"
                      value={accountName}
                      onChange={handleAccountNameChange}
                      aria-invalid={errors.accountName ? 'true' : 'false'}
                      required
                    />
                    {errors.accountName && (
                      <p className="mt-1 text-red-500 text-xs">
                        {errors.accountName}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="block text-gray-700 mb-1 font-medium text-sm">
                      Numéro de compte <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-200 focus:outline-none transition-colors ${
                        errors.accountNumber
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                      }`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Numéro de compte (chiffres uniquement)"
                      value={accountNumber}
                      onChange={handleAccountNumberChange}
                      aria-invalid={errors.accountNumber ? 'true' : 'false'}
                      autoComplete="off"
                      maxLength="30"
                      required
                    />
                    {errors.accountNumber && (
                      <p className="mt-1 text-red-500 text-xs">
                        {errors.accountNumber}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-gray-500">
                      <p>
                        Saisissez uniquement les chiffres, minimum 4 caractères
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Total du panier:</span>
                    <span>
                      {formatPrice(Number(safeValue(checkoutInfo?.amount, 0)))}
                    </span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Frais de livraison:</span>
                    <span>
                      {shippingStatus ? formatPrice(deliveryPrice || 0) : 0}
                    </span>
                  </div>

                  <div className="flex justify-between text-lg font-bold border-t pt-3 mt-2">
                    <span>Total a payer:</span>
                    <span className="text-blue-600">
                      {formatPrice(totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between space-x-3">
                  <Link
                    href={shippingStatus ? '/shipping' : '/shipping-choice'}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 shadow-sm"
                  >
                    Retour
                  </Link>

                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isSubmitting}
                    className={`flex-1 px-5 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSubmitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    }`}
                    aria-live="polite"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Traitement...
                      </span>
                    ) : (
                      'Payer'
                    )}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

// Message quand aucun moyen de paiement n'est disponible
const NoPaymentMethodsFound = memo(() => (
  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12 mx-auto text-gray-400 mb-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
    <p className="font-semibold text-lg mb-2">
      Aucun moyen de paiement disponible
    </p>
    <p className="text-gray-600 mb-4 px-4">
      Nos moyens de paiement sont temporairement indisponibles. Veuillez
      réessayer plus tard.
    </p>
    <Link
      href="/cart"
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
    >
      Retour au panier
    </Link>
  </div>
));
NoPaymentMethodsFound.displayName = 'NoPaymentMethodsFound';

// Carte de méthode de paiement
const PaymentMethodCard = memo(({ payment, isSelected, onSelect }) => (
  <label
    className={`flex p-4 border rounded-lg transition-all duration-200 cursor-pointer ${
      isSelected
        ? 'bg-blue-50 border-blue-400 shadow-sm'
        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
    }`}
  >
    <span className="flex items-center">
      <input
        name="payment"
        type="radio"
        value={payment?.paymentName}
        checked={isSelected}
        onChange={() => onSelect(payment?.paymentName)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
      />
      <div className="ml-3">
        <span className="font-medium text-gray-800">
          {payment?.paymentName}
        </span>
      </div>
    </span>
  </label>
));
PaymentMethodCard.displayName = 'PaymentMethodCard';

export default Payment;
