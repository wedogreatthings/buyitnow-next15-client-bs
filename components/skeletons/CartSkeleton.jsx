// components/skeletons/CartSkeleton.jsx
'use client';

import CartItemSkeleton from './CartItemSkeleton';

const CartHeaderSkeleton = () => (
  <section className="py-5 sm:py-7 bg-gradient-to-r from-blue-50 to-indigo-50">
    <div className="container max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
        <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse"></div>
      </div>
    </div>
  </section>
);

const CartSummarySkeleton = () => (
  <aside className="md:w-1/4">
    <div className="border border-gray-200 bg-white shadow rounded-lg mb-5 p-4 lg:p-6 sticky top-24 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32 mb-4 pb-4 border-b border-gray-200"></div>

      <div className="mb-5 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-4 bg-gray-200 rounded w-10"></div>
        </div>

        <div className="border-t mt-3 pt-4 flex justify-between">
          <div className="h-6 bg-gray-200 rounded w-16"></div>
          <div className="h-6 bg-gray-200 rounded w-24"></div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-12 bg-gray-200 rounded w-full"></div>
        <div className="h-12 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  </aside>
);

const CartItemsListSkeleton = () => (
  <main className="md:w-3/4">
    <div className="bg-white shadow rounded-lg mb-5 p-4 lg:p-6">
      {[...Array(3)].map((_, index) => (
        <CartItemSkeleton key={index} />
      ))}
    </div>
  </main>
);

const CartSkeleton = () => {
  return (
    <>
      {/* En-tête du panier */}
      <CartHeaderSkeleton />

      {/* Contenu du panier */}
      <section className="py-8 md:py-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Liste des articles */}
            <CartItemsListSkeleton />

            {/* Résumé du panier */}
            <CartSummarySkeleton />
          </div>
        </div>
      </section>
    </>
  );
};

export default CartSkeleton;
