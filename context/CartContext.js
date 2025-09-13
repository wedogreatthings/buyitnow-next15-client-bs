'use client';

import { createContext, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { DECREASE, INCREASE } from '@/helpers/constants';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);
  const [error, setError] = useState(null);

  // Récupérer le panier - SIMPLIFIÉ (30 lignes max)
  const setCartToState = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s comme AuthContext

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
        credentials: 'include',
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        switch (res.status) {
          case 401:
            setError('Session expirée. Veuillez vous reconnecter');
            break;
          case 429:
            setError('Trop de tentatives. Réessayez plus tard.');
            break;
          default:
            setError(
              data.message || 'Erreur lors de la récupération du panier',
            );
        }
        return;
      }

      if (data.success) {
        remoteDataInState(data);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('La requête a pris trop de temps');
      } else {
        setError('Problème de connexion. Vérifiez votre connexion.');
      }
      console.error('Cart retrieval error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ajouter au panier - SIMPLIFIÉ (40 lignes max)
  const addItemToCart = async ({ product, quantity = 1 }) => {
    try {
      if (!product) {
        toast.error('Produit invalide');
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          productId: product,
          quantity: parseInt(quantity, 10),
        }),
        signal: controller.signal,
        credentials: 'include',
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        switch (res.status) {
          case 400:
            toast.error(data.message || 'Stock insuffisant');
            break;
          case 401:
            toast.error('Veuillez vous connecter');
            break;
          case 409:
            toast.info('Produit déjà dans le panier');
            break;
          default:
            toast.error(data.message || "Erreur lors de l'ajout");
        }
        return;
      }

      if (data.success) {
        await setCartToState();
        toast.success('Produit ajouté au panier');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        toast.error('La connexion est trop lente');
      } else {
        toast.error('Problème de connexion');
      }
      console.error('Add to cart error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour quantité - SIMPLIFIÉ (40 lignes max)
  const updateCart = async (product, action) => {
    try {
      if (!product?.id || ![INCREASE, DECREASE].includes(action)) {
        toast.error('Données invalides');
        return;
      }

      if (action === DECREASE && product.quantity === 1) {
        toast.info('Utilisez le bouton Supprimer pour retirer cet article');
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          product,
          value: action,
        }),
        signal: controller.signal,
        credentials: 'include',
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Erreur de mise à jour');
        return;
      }

      if (data.success) {
        await setCartToState();
        toast.success(
          action === INCREASE ? 'Quantité augmentée' : 'Quantité diminuée',
        );
      }
    } catch (error) {
      toast.error('Problème de connexion');
      console.error('Update cart error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer du panier - SIMPLIFIÉ (30 lignes max)
  const deleteItemFromCart = async (id) => {
    try {
      if (!id) {
        toast.error('ID invalide');
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cart/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: controller.signal,
          credentials: 'include',
        },
      );

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Erreur de suppression');
        return;
      }

      if (data.success) {
        await setCartToState();
        toast.success('Article supprimé');
      }
    } catch (error) {
      toast.error('Problème de connexion');
      console.error('Delete cart item error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Méthodes simples déjà OK
  const saveOnCheckout = ({ amount, tax = 0, totalAmount }) => {
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

  const clearError = () => {
    setError(null);
  };

  const clearCartOnLogout = () => {
    setCart([]);
    setLoading(false);
    setCartCount(0);
    setCartTotal(0);
  };

  const remoteDataInState = (response) => {
    const normalizedCart =
      response.data.cart?.map((item) => ({
        ...item,
        quantity: parseInt(item.quantity, 10) || 1,
      })) || [];

    setCart(normalizedCart);
    setCartCount(response.data.cartCount || 0);
    setCartTotal(response.data.cartTotal || 0);
  };

  // Valeur du contexte avec mémorisation
  const contextValue = useMemo(
    () => ({
      loading,
      cart,
      cartCount,
      cartTotal,
      checkoutInfo,
      orderInfo,
      error,
      setCartToState,
      setOrderInfo,
      addItemToCart,
      updateCart,
      saveOnCheckout,
      deleteItemFromCart,
      clearError,
      clearCartOnLogout,
    }),
    [loading, cart, cartCount, cartTotal, checkoutInfo, orderInfo, error],
  );

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
};

export default CartContext;
