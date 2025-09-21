import { Suspense, lazy } from 'react';
import { cookies } from 'next/headers';
import { captureException } from '@/monitoring/sentry';
import PaymentPageSkeleton from '@/components/skeletons/PaymentPageSkeleton';
import { redirect } from 'next/navigation';

// Forcer le rendu dynamique pour cette page
export const dynamic = 'force-dynamic';

// Lazy loading du composant Payment
const Payment = lazy(() => import('@/components/cart/Payment'));

// Métadonnées enrichies pour le SEO
export const metadata = {
  title: 'Paiement de votre commande | Buy It Now',
  description:
    'Finalisez votre commande en choisissant votre méthode de paiement préférée',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Paiement de votre commande | Buy It Now',
    description:
      'Finalisez votre commande en choisissant votre méthode de paiement préférée',
    type: 'website',
  },
  alternates: {
    canonical: '/payment',
  },
};

/**
 * Page de paiement - Server Component
 * Vérifie l'authentification et charge le composant de paiement
 */
const PaymentPage = async () => {
  try {
    // Vérification de l'authentification côté serveur
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get('next-auth.session-token') ||
      cookieStore.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      // Rediriger vers la page de connexion avec retour après authentification
      return redirect('/login?callbackUrl=/payment');
    }

    return (
      <div
        className="payment-page"
        itemScope
        itemType="https://schema.org/WebPage"
      >
        <meta itemProp="name" content="Paiement" />
        <Suspense fallback={<PaymentPageSkeleton />}>
          <Payment />
        </Suspense>
      </div>
    );
  } catch (error) {
    // Capture et journalisation de l'erreur
    console.error('Error in payment page:', error);
    captureException(error, {
      tags: { component: 'PaymentPage' },
    });
  }
};

export default PaymentPage;
