import { memo } from 'react';
import Link from 'next/link';

// Composant pour l'état vide du panier
const EmptyCart = memo(() => {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center px-4 transition-all duration-300 transform translate-y-0 opacity-100">
      <div className="bg-gray-100 rounded-full p-6 mb-6">
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold mb-3 text-gray-800">
        Votre panier est vide
      </h2>
      <p className="text-gray-600 mb-6 max-w-md">
        Il semble que vous n&apos;ayez pas encore ajouté d&apos;articles à votre
        panier.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Découvrir nos produits
      </Link>
    </div>
  );
});

EmptyCart.displayName = 'EmptyCart';

export default EmptyCart;
