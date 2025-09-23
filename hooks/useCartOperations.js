// hooks/useCartOperations.js
import { useState, useContext, useMemo, useCallback } from 'react';
import captureClientError from '@/monitoring/sentry'; // ✅ Méthode CLIENT
import CartContext from '@/context/CartContext';
import { DECREASE, INCREASE } from '@/helpers/constants';
import { throttle } from '@/utils/performance';
import OrderContext from '@/context/OrderContext';

const useCartOperations = () => {
  const { updateCart, deleteItemFromCart } = useContext(CartContext);
  const { saveOnCheckout } = useContext(OrderContext);

  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [itemBeingRemoved, setItemBeingRemoved] = useState(null);

  // Fonction de base pour augmenter (non throttlée)
  const increaseQtyBase = useCallback(
    async (cartItem) => {
      try {
        // Validation côté client
        if (!cartItem || !cartItem.id) {
          const validationError = new Error(
            'Article invalide pour augmentation quantité',
          );
          captureClientError(
            validationError,
            'useCartOperations',
            'increaseQty',
            false,
          );
          return;
        }

        if (cartItem.quantity >= cartItem.stock) {
          const stockError = new Error(
            `Stock insuffisant: ${cartItem.stock} disponible`,
          );
          captureClientError(
            stockError,
            'useCartOperations',
            'increaseQty',
            false,
          );
          return;
        }

        await updateCart(cartItem, INCREASE);
      } catch (error) {
        console.error("Erreur lors de l'augmentation de la quantité:", error);

        // Monitoring client avec contexte riche
        captureClientError(error, 'useCartOperations', 'increaseQty', true, {
          cartItemId: cartItem?.id,
          currentQuantity: cartItem?.quantity,
          availableStock: cartItem?.stock,
          productName: cartItem?.productName,
        });
      }
    },
    [updateCart],
  );

  // Fonction de base pour diminuer (non throttlée)
  const decreaseQtyBase = useCallback(
    async (cartItem) => {
      try {
        // Validation côté client
        if (!cartItem || !cartItem.id) {
          const validationError = new Error(
            'Article invalide pour diminution quantité',
          );
          captureClientError(
            validationError,
            'useCartOperations',
            'decreaseQty',
            false,
          );
          return;
        }

        if (cartItem.quantity <= 1) {
          const limitError = new Error(
            'Quantité minimum atteinte (utilisez supprimer)',
          );
          captureClientError(
            limitError,
            'useCartOperations',
            'decreaseQty',
            false,
          );
          return;
        }

        await updateCart(cartItem, DECREASE);
      } catch (error) {
        console.error('Erreur lors de la diminution de la quantité:', error);

        // Monitoring client avec contexte
        captureClientError(error, 'useCartOperations', 'decreaseQty', true, {
          cartItemId: cartItem?.id,
          currentQuantity: cartItem?.quantity,
          productName: cartItem?.productName,
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
        const concurrencyError = new Error(
          'Opération de suppression déjà en cours',
        );
        captureClientError(
          concurrencyError,
          'useCartOperations',
          'handleDeleteItem',
          false,
        );
        return;
      }

      try {
        // Validation côté client
        if (!itemId) {
          const validationError = new Error(
            'ID article manquant pour suppression',
          );
          captureClientError(
            validationError,
            'useCartOperations',
            'handleDeleteItem',
            false,
          );
          return;
        }

        setDeleteInProgress(true);
        setItemBeingRemoved(itemId);
        await deleteItemFromCart(itemId);

        // Log succès pour le monitoring (non-critique)
        captureClientError(
          new Error('Article supprimé avec succès'),
          'useCartOperations',
          'handleDeleteItem',
          false,
          { itemId, action: 'success' },
        );
      } catch (error) {
        console.error("Erreur lors de la suppression d'un article:", error);

        // Monitoring critique pour échec de suppression
        captureClientError(
          error,
          'useCartOperations',
          'handleDeleteItem',
          true,
          {
            itemId,
            deleteInProgress,
            itemBeingRemoved,
          },
        );
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
  const checkoutHandler = useCallback(
    (cart, cartTotal) => {
      try {
        // Validation du panier avant checkout
        if (!cartTotal || cartTotal <= 0) {
          console.log('Panier vide ou montant invalide pour checkout');
          return false;
        }

        const checkoutData = {
          amount: cartTotal.toFixed(2),
          tax: 0,
          totalAmount: cartTotal.toFixed(2),
        };

        saveOnCheckout(
          cart,
          checkoutData.amount,
          checkoutData.tax,
          checkoutData.totalAmount,
        );

        return true;
      } catch (error) {
        console.error('Erreur lors du checkout:', error);

        // Monitoring critique pour échec checkout
        captureClientError(
          error,
          'useCartOperations',
          'checkoutHandler',
          true,
          {
            cartTotal,
          },
        );

        return false;
      }
    },
    [saveOnCheckout],
  );

  return {
    deleteInProgress,
    itemBeingRemoved,
    increaseQty, // Déjà throttlée + monitoring
    decreaseQty, // Déjà throttlée + monitoring
    handleDeleteItem, // Déjà throttlée + monitoring
    checkoutHandler, // Avec monitoring
  };
};

export default useCartOperations;
