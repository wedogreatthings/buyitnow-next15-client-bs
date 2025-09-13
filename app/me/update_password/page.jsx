import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';
import UpdatePassword from '@/components/auth/UpdatePassword';
import { getAuthenticatedUser } from '@/lib/auth';

// Force dynamic rendering pour garantir l'état d'authentification à jour
export const dynamic = 'force-dynamic';

// Métadonnées enrichies pour SEO et sécurité
export const metadata = {
  title: 'Modification du mot de passe | Buy It Now',
  description:
    'Modifiez votre mot de passe pour sécuriser votre compte Buy It Now',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: '/me/update_password',
  },
};

/**
 * Server component pour la page de modification de mot de passe
 * Effectue les vérifications d'authentification et de sécurité
 * avant de rendre le composant client
 */
async function PasswordPage() {
  try {
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);
    if (!user) {
      console.log('User not authenticated, redirecting to login');
      return redirect('/login?callbackUrl=/me/update_password');
    }

    const userAgent = headersList.get('user-agent') || 'unknown';
    const referer = headersList.get('referer') || 'direct';

    // Journal d'accès anonymisé pour la sécurité
    const clientIp = (headersList.get('x-forwarded-for') || '')
      .split(',')
      .shift()
      .trim();
    const anonymizedIp = clientIp ? clientIp.replace(/\d+$/, 'xxx') : 'unknown';

    console.info('Password update page accessed', {
      userAgent: userAgent?.substring(0, 100),
      referer: referer?.substring(0, 200),
      ip: anonymizedIp,
      userId: user._id
        ? `${user._id.substring(0, 2)}...${user._id.slice(-2)}`
        : 'unknown',
    });

    // Détection basique d'activité potentiellement suspecte
    const isLikelyBot =
      !userAgent ||
      userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawl') ||
      userAgent.toLowerCase().includes('spider');

    if (isLikelyBot) {
      console.warn('Potential bot detected on password update page', {
        userAgent: userAgent?.substring(0, 100),
        ip: anonymizedIp,
      });
      // On autorise l'accès mais on le note pour monitoring
    }

    // Détection des visites multiples qui peuvent indiquer une tentative de force brute
    // Cette logique pourrait être déplacée vers un middleware de rate limiting

    // Rendu du composant avec gestion des erreurs
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-lg">
          <div className="text-center mb-8">
            <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Modifier votre mot de passe
            </h1>
            <p className="mt-2 text-center text-sm text-gray-600">
              Choisissez un mot de passe fort pour sécuriser votre compte
            </p>
          </div>

          <div className="bg-white py-8 px-4 sm:px-8 shadow sm:rounded-lg">
            <Suspense>
              <UpdatePassword userId={user._id} referer={referer} />
            </Suspense>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Journalisation détaillée de l'erreur
    console.error('Error initializing password update page', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Capture d'exception pour Sentry avec contexte enrichi
    captureException(error, {
      tags: {
        component: 'PasswordUpdatePage',
        errorType: error.name,
      },
      extra: {
        message: error.message,
      },
    });

    // Lancer une erreur propre pour le boundary d'erreur
    throw new Error(
      'Impossible de charger la page de modification du mot de passe',
      {
        cause: error,
      },
    );
  }
}

export default PasswordPage;
