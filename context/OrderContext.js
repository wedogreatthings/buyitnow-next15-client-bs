'use client';

import { useRouter } from 'next/navigation';
import { createContext, useState } from 'react';

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
  const saveOnCheckout = ({ cart, amount, tax = 0, totalAmount }) => {
    const validAmount = parseFloat(amount) || 0;
    const validTax = parseFloat(tax) || 0;
    const validTotal = parseFloat(totalAmount) || validAmount + validTax;

    setCheckoutInfo({
      amount: validAmount,
      tax: validTax,
      totalAmount: validTotal,
      items: cart,
      timestamp: Date.now(),
    });
  };

  const addOrder = async (orderInfo) => {
    try {
      setError(null);
      setUpdated(true);
      setLowStockProducts(null);

      // Validation basique
      if (!orderInfo) {
        setError('Données de commande manquantes');
        setUpdated(false);
        return;
      }

      if (!orderInfo.orderItems || orderInfo.orderItems.length === 0) {
        setError('Votre panier est vide');
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
        switch (res.status) {
          case 400:
            setError(data.message || 'Données de commande invalides');
            break;
          case 401:
            setError('Session expirée. Veuillez vous reconnecter.');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 404:
            setError('Utilisateur non trouvé');
            setTimeout(() => router.push('/login'), 2000);
            break;
          case 409:
            // Produits indisponibles
            if (data.unavailableProducts) {
              setLowStockProducts(data.unavailableProducts);
              router.push('/error');
            } else {
              setError('Certains produits ne sont plus disponibles');
            }
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(
              data.message || 'Erreur lors du traitement de la commande',
            );
        }
        setUpdated(false);
        return;
      }

      // Succès
      if (data.success && data.id) {
        setOrderId(data.id);
        setError(null);

        console.log('Order created:', data.orderNumber);
        router.push('/confirmation');
      } else {
        setError('Erreur lors de la création de la commande');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps. Veuillez réessayer.');
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
      }
      console.error('Order creation error:', error.message);
    } finally {
      setUpdated(false);
    }
  };

  const clearErrors = () => {
    setError(null);
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
        setPaymentTypes,
        setAddresses,
        setShippingInfo,
        setShippingStatus,
        setDeliveryPrice,
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
