// components/cart/Confirmation.jsx
'use client';

import CartContext from '@/context/CartContext';
import OrderContext from '@/context/OrderContext';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useContext, useEffect } from 'react';
import { toast } from 'react-toastify';
import BreadCrumbs from '../layouts/BreadCrumbs';
import { CircleCheckBig } from 'lucide-react';

const Confirmation = () => {
  const { orderId, paymentTypes } = useContext(OrderContext);
  const { setCartToState } = useContext(CartContext);

  useEffect(() => {
    // Chargement initial du panier - OPTIMISÉ
    const loadCart = async () => {
      try {
        await setCartToState();
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
        toast.error('Impossible de charger votre panier. Veuillez réessayer.');
      }
    };

    loadCart();
  }, []);

  if (orderId === undefined || orderId === null) {
    return notFound();
  }

  const breadCrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Confirmation', url: '' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <BreadCrumbs breadCrumbs={breadCrumbs} />
      <div className="container max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8">
          {/* Icône de succès */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CircleCheckBig size={72} strokeWidth={1.5} />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Commande confirmée !
            </h1>

            <p className="text-gray-600">
              Numéro de commande :{' '}
              <span className="font-mono font-semibold">{orderId}</span>
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
