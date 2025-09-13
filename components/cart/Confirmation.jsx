'use client';

import { useContext, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import OrderContext from '@/context/OrderContext';
import CartContext from '@/context/CartContext';
import { isArrayEmpty } from '@/helpers/helpers';
import { captureException } from '@/monitoring/sentry';
import { toast } from 'react-toastify';
const BreadCrumbs = dynamic(() => import('@/components/layouts/BreadCrumbs'));

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
        captureException(error, {
          tags: { component: 'Cart', action: 'initialLoad' },
        });
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
    <div>
      <BreadCrumbs breadCrumbs={breadCrumbs} />
      <section className="py-10 bg-gray-50">
        <div className="container max-w-(--breakpoint-xl) mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 lg:gap-8">
            <main className="md:w-2/3">
              <article className="border border-gray-200 bg-white shadow-xs rounded-sm p-4 lg:p-6 mb-5">
                <h2 className="text-xl font-semibold mb-5">
                  Commande Enregsitrée
                </h2>

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  Code secret :{' '}
                  <span className="font-bold">{orderId && orderId}</span>
                </div>
              </article>
            </main>
            <aside className="md:w-1/3">
              <article className="text-gray-600" style={{ maxWidth: '350px' }}>
                <h2 className="text-xl text-black font-semibold mb-4">
                  Nos Comptes
                </h2>
                {isArrayEmpty(paymentTypes) ? (
                  <div className="w-full">
                    <p className="font-bold text-xl text-center">
                      Something Happened While Fetching Payment Types!
                    </p>
                  </div>
                ) : (
                  paymentTypes?.map((payment) => {
                    return (
                      <div className="mb-4" key={payment?._id}>
                        <h5 className="text-black">
                          {payment?.paymentName} :{' '}
                        </h5>
                        <p>{payment?.paymentNumber}</p>
                      </div>
                    );
                  })
                )}
              </article>

              <div className="flex justify-end space-x-2 mt-10">
                <Link
                  className="px-5 py-2 inline-block text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 cursor-pointer"
                  href="/"
                >
                  Retour à l&apos;accueil
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Confirmation;
