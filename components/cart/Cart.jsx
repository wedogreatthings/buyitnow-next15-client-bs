'use client';

import { useContext, useEffect, useState, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import CartContext from '@/context/CartContext';
import dynamic from 'next/dynamic';
import { captureException } from '@/monitoring/sentry';
import CartItemSkeleton from '../skeletons/CartItemSkeleton';

// Chargement dynamique du composant ItemCart
const ItemCart = dynamic(() => import('./components/ItemCart'), {
  loading: () => <CartItemSkeleton />,
  ssr: true,
});

// Composants et hooks extraits pour meilleure organisation
import EmptyCart from './components/EmptyCart';
import CartSummary from './components/CartSummary';
import useCartOperations from '../../hooks/useCartOperations';
import CartSkeleton from '../skeletons/CartSkeleton';

const Cart = () => {
  const {
    loading,
    cart,
    cartCount,
    setCartToState,
    cartTotal,
    error,
    clearError,
  } = useContext(CartContext);

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const router = useRouter();

  // Hooks personnalisé pour les opérations de panier
  const {
    deleteInProgress,
    itemBeingRemoved,
    increaseQty,
    decreaseQty,
    handleDeleteItem,
    checkoutHandler,
  } = useCartOperations();

  // Ajoutons un useRef pour suivre si une requête de chargement est en cours
  const isLoadingCart = useRef(false);

  useEffect(() => {
    // Nettoyage de l'erreur si elle existe
    if (error) {
      clearError();
      toast.error('Une erreur est survenue lors du chargement du panier.');
    }
  }, [error, clearError]);

  // Précharger la page de livraison
  useEffect(() => {
    router.prefetch('/shipping-choice');

    // Chargement initial du panier - OPTIMISÉ
    const loadCart = async () => {
      // Vérifier si on est déjà en train de charger le panier
      if (isLoadingCart.current) return;

      try {
        // Marquer comme en cours de chargement
        isLoadingCart.current = true;

        await setCartToState();
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
        captureException(error, {
          tags: { component: 'Cart', action: 'initialLoad' },
        });
        toast.error('Impossible de charger votre panier. Veuillez réessayer.');
      } finally {
        // Important: marquer comme terminé même en cas d'erreur
        isLoadingCart.current = false;
        setInitialLoadComplete(true);
      }
    };

    // Ne charger qu'une seule fois au montage du composant
    if (!initialLoadComplete && !isLoadingCart.current) {
      loadCart();
    }
  }, [router, setCartToState, initialLoadComplete]);

  // Afficher un écran de chargement pendant le chargement initial
  if (!initialLoadComplete) {
    return <CartSkeleton />;
  }

  return (
    <>
      {/* En-tête du panier */}
      <CartHeader cartCount={cartCount} />

      {/* Contenu du panier */}
      <section className="py-8 md:py-10">
        <div className="container max-w-6xl mx-auto px-4">
          {!loading && cart?.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Liste des articles */}
              <CartItemsList
                cart={cart}
                loading={loading}
                handleDeleteItem={handleDeleteItem}
                decreaseQty={decreaseQty}
                increaseQty={increaseQty}
                deleteInProgress={deleteInProgress}
                itemBeingRemoved={itemBeingRemoved}
              />

              {/* Résumé du panier */}
              {cart?.length > 0 && (
                <CartSummary
                  cartItems={cart}
                  amount={cartTotal}
                  onCheckout={checkoutHandler}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

// Composants extraits pour une meilleure organisation

const CartHeader = memo(({ cartCount }) => (
  <section className="py-5 sm:py-7 bg-gradient-to-r from-blue-50 to-indigo-50">
    <div className="container max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">
          Mon Panier
        </h1>
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
          {cartCount || 0} produit{cartCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  </section>
));

CartHeader.displayName = 'CartHeader';

const CartItemsList = memo(
  ({
    cart,
    loading,
    handleDeleteItem,
    decreaseQty,
    increaseQty,
    deleteInProgress,
    itemBeingRemoved,
  }) => (
    <main className="md:w-3/4">
      <div className="bg-white shadow rounded-lg mb-5 p-4 lg:p-6 transition-all duration-300 ease-in-out transform translate-y-0 opacity-100">
        {loading && (
          <>
            {[...Array(3)].map((_, index) => (
              <CartItemSkeleton key={index} />
            ))}
          </>
        )}
        {!loading &&
          cart?.map((cartItem) => (
            <div
              key={cartItem.id}
              className={`transition-all duration-300 ease-in-out transform ${
                itemBeingRemoved === cartItem.id
                  ? 'opacity-0 -translate-x-3 h-0 overflow-hidden'
                  : 'opacity-100 translate-x-0'
              }`}
            >
              <ItemCart
                cartItem={cartItem}
                deleteItemFromCart={handleDeleteItem}
                decreaseQty={decreaseQty}
                increaseQty={increaseQty}
                deleteInProgress={deleteInProgress}
              />
            </div>
          ))}
      </div>
    </main>
  ),
);

CartItemsList.displayName = 'CartItemsList';

export default Cart;
