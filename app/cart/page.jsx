import { Suspense, lazy } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';
import CartSkeleton from '@/components/skeletons/CartSkeleton';

// Forcer le rendu dynamique pour cette page
export const dynamic = 'force-dynamic';

// Lazy loading du composant Cart
const Cart = lazy(() => import('@/components/cart/Cart'));

// Métadonnées enrichies pour le panier
export const metadata = {
  title: 'Votre Panier | Buy It Now',
  description:
    'Consultez et gérez les articles de votre panier sur Buy It Now.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Votre Panier | Buy It Now',
    description:
      'Consultez et gérez les articles de votre panier sur Buy It Now.',
    type: 'website',
  },
  alternates: {
    canonical: '/cart',
  },
};

const CartPage = async () => {
  try {
    const cookie = await cookies();
    // Vérification de l'authentification côté serveur
    const sessionCookie =
      cookie.get('next-auth.session-token') ||
      cookie.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      // Rediriger vers la page de connexion avec le retour à la page du panier
      redirect('/login?callbackUrl=/cart');
    }

    return (
      <div itemScope itemType="https://schema.org/ItemList">
        <meta itemProp="name" content="Shopping Cart" />
        <Suspense fallback={<CartSkeleton />}>
          <Cart />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error('Error accessing cart page:', error);

    // Capturer l'erreur dans Sentry
    captureException(error, {
      tags: {
        component: 'CartPage',
        errorType: error.name,
      },
    });

    // Rediriger vers la page d'accueil en cas d'erreur
    redirect('/');
  }
};

export default CartPage;
