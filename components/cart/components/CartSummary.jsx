'use client';

import { memo } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/helpers/helpers';

const CartSummary = memo(({ cartItems, amount, onCheckout }) => {
  const totalUnits = cartItems.reduce((acc, item) => acc + item?.quantity, 0);

  return (
    <aside className="md:w-1/4">
      <div className="border border-gray-200 bg-white shadow rounded-lg mb-5 p-4 lg:p-6 sticky top-24 transition-all duration-300 ease-in-out transform translate-y-0 opacity-100">
        <h3 className="font-semibold text-lg mb-4 pb-4 border-b border-gray-200">
          Récapitulatif
        </h3>
        <ul className="mb-5 space-y-3">
          <li
            className="flex justify-between text-gray-600"
            title="Nombre total d'articles"
          >
            <span>Nombre d&apos;articles:</span>
            <span className="font-medium">{totalUnits}</span>
          </li>

          <li
            className="text-lg font-bold border-t flex justify-between mt-3 pt-4"
            title="Prix total"
          >
            <span>Total:</span>
            <span className="text-blue-600">{formatPrice(amount)}</span>
          </li>
        </ul>

        <div className="space-y-3">
          <Link
            href="/shipping-choice"
            onClick={onCheckout}
            className="px-4 py-3 inline-block text-sm font-medium w-full text-center text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm"
            title="Continuer vers la livraison"
          >
            Continuer vers la livraison
          </Link>

          <Link
            href="/"
            title="Continuer mes achats"
            className="px-4 py-3 inline-block text-sm w-full text-center font-medium text-blue-600 bg-white shadow-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Continuer mes achats
          </Link>
        </div>
      </div>
    </aside>
  );
});

CartSummary.displayName = 'CartSummary';

export default CartSummary;
