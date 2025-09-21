// components/cart/Confirmation.jsx
'use client';

import Link from 'next/link';

const Confirmation = ({ orderNumber }) => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8">
          {/* Icône de succès */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-500" /* ... */ />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Commande confirmée !
            </h1>

            <p className="text-gray-600">
              Numéro de commande :{' '}
              <span className="font-mono font-semibold">{orderNumber}</span>
            </p>
          </div>

          {/* Détails de la commande */}
          <div className="border-t border-gray-200 pt-6">
            {/* Afficher les détails de manière sécurisée */}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              href="/me/orders"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center"
            >
              Voir mes commandes
            </Link>

            <Link
              href="/"
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-center"
            >
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;
