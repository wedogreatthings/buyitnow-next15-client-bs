import { memo } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

// Composant pour l'état vide du panier
const EmptyCart = memo(() => {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center px-4 transition-all duration-300 transform translate-y-0 opacity-100">
      <div className="bg-gray-100 rounded-full p-6 mb-6">
        <ShoppingCart size={72} strokeWidth={1.5} />
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
