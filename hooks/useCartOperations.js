// hooks/useCartOperations.js
import { useState, useContext, useMemo, useCallback } from 'react';
import { captureException } from '@/monitoring/sentry';
import CartContext from '@/context/CartContext';
import { DECREASE, INCREASE } from '@/helpers/constants';
import { throttle } from '@/utils/performance';
import OrderContext from '@/context/OrderContext';

const useCartOperations = () => {
  const { updateCart, deleteItemFromCart, cartTotal } = useContext(CartContext);
  const { saveOnCheckout } = useContext(OrderContext);

  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [itemBeingRemoved, setItemBeingRemoved] = useState(null);

  // Fonction de base pour augmenter (non throttlée)
  const increaseQtyBase = useCallback(
    async (cartItem) => {
      try {
        await updateCart(cartItem, INCREASE);
      } catch (error) {
        console.error("Erreur lors de l'augmentation de la quantité:", error);
        captureException(error, {
          tags: { component: 'Cart', action: 'increaseQty' },
          extra: { cartItem },
        });
      }
    },
    [updateCart],
  );

  // Fonction de base pour diminuer (non throttlée)
  const decreaseQtyBase = useCallback(
    async (cartItem) => {
      try {
        await updateCart(cartItem, DECREASE);
      } catch (error) {
        console.error('Erreur lors de la diminution de la quantité:', error);
        captureException(error, {
          tags: { component: 'Cart', action: 'decreaseQty' },
          extra: { cartItem },
        });
      }
    },
    [updateCart],
  );

  // Versions throttlées - mémorisées pour éviter de recréer à chaque render
  const increaseQty = useMemo(
    () => throttle(increaseQtyBase, 500), // 500ms entre chaque clic
    [increaseQtyBase],
  );

  const decreaseQty = useMemo(
    () => throttle(decreaseQtyBase, 500), // 500ms entre chaque clic
    [decreaseQtyBase],
  );

  // Fonction de base pour supprimer (non throttlée)
  const handleDeleteItemBase = useCallback(
    async (itemId) => {
      // Protection supplémentaire contre les clics multiples
      if (deleteInProgress || itemBeingRemoved === itemId) {
        return;
      }

      try {
        setDeleteInProgress(true);
        setItemBeingRemoved(itemId);
        await deleteItemFromCart(itemId);
      } catch (error) {
        console.error("Erreur lors de la suppression d'un article:", error);
        captureException(error, {
          tags: { component: 'Cart', action: 'deleteItem' },
          extra: { itemId },
        });
      } finally {
        setDeleteInProgress(false);
        // Petit délai avant de réinitialiser pour l'animation
        setTimeout(() => setItemBeingRemoved(null), 300);
      }
    },
    [deleteItemFromCart, deleteInProgress, itemBeingRemoved],
  );

  // Version throttlée de la suppression
  const handleDeleteItem = useMemo(
    () => throttle(handleDeleteItemBase, 1000), // 1 seconde entre suppressions
    [handleDeleteItemBase],
  );

  // Préparation au paiement - pas besoin de throttle ici
  const checkoutHandler = useCallback(() => {
    const checkoutData = {
      amount: cartTotal.toFixed(2),
      tax: 0,
      totalAmount: cartTotal.toFixed(2),
    };

    saveOnCheckout(checkoutData);
  }, [cartTotal, saveOnCheckout]);

  return {
    deleteInProgress,
    itemBeingRemoved,
    increaseQty, // Déjà throttlée
    decreaseQty, // Déjà throttlée
    handleDeleteItem, // Déjà throttlée
    checkoutHandler,
  };
};

export default useCartOperations;
