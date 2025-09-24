'use client';

import { useRouter } from 'next/navigation';
import { createContext, useState } from 'react';
import captureClientError from '@/monitoring/sentry';

const OrderContext = createContext();

export const OrderProvider = ({ children }) => {
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState(null);

  // États pour les autres parties de l'app (shipping, etc.)
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [shippingInfo, setShippingInfo] = useState(null);
  const [shippingStatus, setShippingStatus] = useState(true);
  const [deliveryPrice, setDeliveryPrice] = useState(0);

  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);

  const router = useRouter();

  // Méthodes simples déjà OK
  const saveOnCheckout = ({ cart, cartTotal, tax = 0 }) => {
    try {
      if (!cart || !Array.isArray(cart) || cart.length === 0) {
        console.log('Panier vide ou invalide dans saveOnCheckout');
        return;
      }

      // Validation basique des montants
      if (cartTotal < 0 || cartTotal < 0) {
        console.log('Montants négatifs détectés dans saveOnCheckout');
        return;
      }

      const validAmount = parseFloat(cartTotal.toFixed(2)) || 0;
      const validTotal = validAmount + tax || 0;

      setCheckoutInfo({
        amount: validAmount,
        tax,
        totalAmount: validTotal,
        items: cart,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Monitoring pour erreurs inattendues lors de la sauvegarde checkout
      captureClientError(error, 'OrderContext', 'saveOnCheckout', true);
      console.error('Error in saveOnCheckout:', error.message);
    }
  };

  const addOrder = async (orderInfo) => {
    try {
      setError(null);
      setUpdated(true);
      setLowStockProducts(null);

      // Validation basique
      if (!orderInfo) {
        const validationError = new Error('Données de commande manquantes');
        captureClientError(validationError, 'OrderContext', 'addOrder', false);
        setError('Données de commande manquantes');
        setUpdated(false);
        return;
      }

      if (!orderInfo.orderItems || orderInfo.orderItems.length === 0) {
        const validationError = new Error(
          'Panier vide lors de la création de commande',
        );
        captureClientError(validationError, 'OrderContext', 'addOrder', false);
        setError('Votre panier est vide');
        setUpdated(false);
        return;
      }

      // Validation des montants
      if (!orderInfo.totalAmount || orderInfo.totalAmount <= 0) {
        const validationError = new Error(
          'Montant total invalide pour la commande',
        );
        captureClientError(validationError, 'OrderContext', 'addOrder', false);
        setError('Montant de commande invalide');
        setUpdated(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s pour une commande

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/orders/webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(orderInfo),
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = '';
        switch (res.status) {
          case 400:
            errorMessage = data.message || 'Données de commande invalides';
            break;
          case 401:
            errorMessage = 'Session expirée. Veuillez vous reconnecter.';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 404:
            errorMessage = 'Utilisateur non trouvé';
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 409:
            // Produits indisponibles - Cas spécial critique pour l'e-commerce
            if (data.unavailableProducts) {
              setLowStockProducts(data.unavailableProducts);
              errorMessage = 'Produits indisponibles détectés';
              router.push('/error');
            } else {
              errorMessage = 'Certains produits ne sont plus disponibles';
            }
            break;
          case 429:
            errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            break;
          default:
            errorMessage =
              data.message || 'Erreur lors du traitement de la commande';
        }

        // Monitoring pour erreurs HTTP - Critique pour session/utilisateur/stock
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 404, 409].includes(res.status);
        captureClientError(httpError, 'OrderContext', 'addOrder', isCritical);

        setError(errorMessage);
        setUpdated(false);
        return;
      }

      // Succès - Validation de la réponse
      if (data.success && data.id) {
        setOrderId(data.id);
        setError(null);

        console.log('Order created:', data.orderNumber);
        router.push('/confirmation');
      } else {
        // Succès partiel ou réponse malformée - Critique pour l'e-commerce
        const responseError = new Error(
          'Réponse API malformée lors de la création de commande',
        );
        captureClientError(responseError, 'OrderContext', 'addOrder', true);
        setError('Erreur lors de la création de la commande');
      }
    } catch (error) {
      // Erreurs réseau/système
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps. Veuillez réessayer.');
        captureClientError(error, 'OrderContext', 'addOrder', true); // Critique : timeout sur commande
      } else if (
        error.name === 'TypeError' &&
        error.message.includes('fetch')
      ) {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'OrderContext', 'addOrder', true); // Critique : erreur réseau sur commande
      } else if (error instanceof SyntaxError) {
        // Erreur de parsing JSON - Critique
        setError('Réponse serveur invalide.');
        captureClientError(error, 'OrderContext', 'addOrder', true);
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
        captureClientError(error, 'OrderContext', 'addOrder', true); // Toute autre erreur est critique pour une commande
      }
      console.error('Order creation error:', error.message);
    } finally {
      setUpdated(false);
    }
  };

  const clearErrors = () => {
    setError(null);
  };

  // Wrapper pour setters avec monitoring des erreurs critiques
  const safeSetPaymentTypes = (types) => {
    try {
      if (!Array.isArray(types)) {
        const validationError = new Error(
          'Types de paiement invalides (non-array)',
        );
        captureClientError(
          validationError,
          'OrderContext',
          'setPaymentTypes',
          false,
        );
        setPaymentTypes([]);
        return;
      }
      setPaymentTypes(types);
    } catch (error) {
      captureClientError(error, 'OrderContext', 'setPaymentTypes', true);
      setPaymentTypes([]);
    }
  };

  const safeSetAddresses = (addresses) => {
    try {
      if (!Array.isArray(addresses)) {
        const validationError = new Error('Adresses invalides (non-array)');
        captureClientError(
          validationError,
          'OrderContext',
          'setAddresses',
          false,
        );
        setAddresses([]);
        return;
      }
      setAddresses(addresses);
    } catch (error) {
      captureClientError(error, 'OrderContext', 'setAddresses', true);
      setAddresses([]);
    }
  };

  const safeSetDeliveryPrice = (price) => {
    try {
      const validPrice = parseFloat(price) || 0;
      if (validPrice < 0) {
        console.log('Prix de livraison négatif détecté');
        setDeliveryPrice(0);
        return;
      }
      setDeliveryPrice(validPrice);
    } catch (error) {
      captureClientError(error, 'OrderContext', 'setDeliveryPrice', true);
      setDeliveryPrice(0);
    }
  };

  return (
    <OrderContext.Provider
      value={{
        error,
        updated,
        orderId,
        lowStockProducts,
        paymentTypes,
        addresses,
        shippingInfo,
        shippingStatus,
        deliveryPrice,
        checkoutInfo,
        orderInfo,
        setPaymentTypes: safeSetPaymentTypes,
        setAddresses: safeSetAddresses,
        setShippingInfo,
        setShippingStatus,
        setDeliveryPrice: safeSetDeliveryPrice,
        setOrderInfo,
        saveOnCheckout,
        addOrder,
        setUpdated,
        clearErrors,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export default OrderContext;
