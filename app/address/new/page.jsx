import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';
import NewAddressSkeleton from '@/components/skeletons/NewAddressSkeleton';
import NewAddress from '@/components/user/NewAddress';
import { getAuthenticatedUser } from '@/lib/auth';

// Force dynamic rendering to ensure fresh auth state
export const dynamic = 'force-dynamic';

// Enhanced metadata for SEO
export const metadata = {
  title: 'Ajouter une adresse | Buy It Now',
  description:
    'Ajoutez une nouvelle adresse de livraison à votre compte Buy It Now',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: '/address/new',
  },
};

/**
 * Server component for the new address page that performs authorization checks
 * and prepares necessary data for the client component
 */
async function NewAddressPage() {
  try {
    // Check if user is authenticated
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);
    if (!user) {
      console.log('User not authenticated, redirecting to login');
      return redirect('/login?callbackUrl=/address/new');
    }

    // Get headers for logging and security
    const userAgent = headersList.get('user-agent') || 'unknown';
    const referer = headersList.get('referer') || 'direct';

    // Log page access (anonymized)
    const clientIp = (headersList.get('x-forwarded-for') || '')
      .split(',')
      .shift()
      .trim();
    const anonymizedIp = clientIp ? clientIp.replace(/\d+$/, 'xxx') : 'unknown';

    console.info('Address page accessed', {
      userAgent: userAgent?.substring(0, 100),
      referer: referer?.substring(0, 200),
      ip: anonymizedIp,
      userId: user._id
        ? `${user._id.substring(0, 2)}...${user._id.slice(-2)}`
        : 'unknown',
    });

    // Basic anti-bot verification
    const isLikelyBot =
      !userAgent ||
      userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawl') ||
      userAgent.toLowerCase().includes('spider');

    if (isLikelyBot) {
      console.warn('Potential bot detected on address page', {
        userAgent: userAgent?.substring(0, 100),
        ip: anonymizedIp,
      });
      // Allow access but note for monitoring
    }

    // Render the page with proper error boundaries - MODIFIED LAYOUT HERE
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-2xl">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Ajouter une nouvelle adresse
          </h1>

          <div className="mt-8">
            <div className="bg-white py-8 px-4 sm:px-8 shadow sm:rounded-lg">
              <Suspense fallback={<NewAddressSkeleton />}>
                <NewAddress userId={user._id} referer={referer} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Log error with context
    console.error('Error initializing new address page', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Capture exception for Sentry with enriched context
    captureException(error, {
      tags: {
        component: 'NewAddressPage',
        errorType: error.name,
      },
      extra: {
        message: error.message,
      },
    });

    // Throw a cleaner error for the error boundary
    throw new Error("Impossible de charger la page d'ajout d'adresse", {
      cause: error,
    });
  }
}

export default NewAddressPage;
