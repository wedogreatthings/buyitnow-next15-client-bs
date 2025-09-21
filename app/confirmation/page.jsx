// app/confirmation/page.jsx
import { lazy, Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic';

// Lazy loading avec skeleton
const Confirmation = lazy(() => import('@/components/cart/Confirmation'), {
  loading: () => <ConfirmationSkeleton />,
  ssr: false, // Client-only pour données sensibles
});

export const metadata = {
  title: 'Confirmation de commande | Buy It Now',
  description: 'Votre commande a été confirmée avec succès',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    title: 'Commande confirmée | Buy It Now',
    description: 'Merci pour votre commande',
    type: 'website',
  },
};

const ConfirmationPage = async () => {
  try {
    // 1. Vérification d'authentification OBLIGATOIRE
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get('next-auth.session-token') ||
      cookieStore.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      redirect('/login');
    }

    return (
      <div
        className="confirmation-page"
        itemScope
        itemType="https://schema.org/OrderStatus"
      >
        <meta itemProp="name" content="Order Confirmed" />
        <meta itemProp="orderStatus" content="OrderDelivered" />

        <Suspense fallback={<ConfirmationSkeleton />}>
          <Confirmation />
        </Suspense>
      </div>
    );
  } catch (error) {
    captureException(error, {
      tags: { component: 'ConfirmationPage' },
      level: 'error',
    });

    // En cas d'erreur, rediriger vers une page d'erreur
    redirect('/error?type=order-confirmation');
  }
};

// Skeleton de chargement
const ConfirmationSkeleton = () => (
  <div className="min-h-screen bg-gray-50 py-12">
    <div className="container max-w-2xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow p-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  </div>
);

export default ConfirmationPage;
