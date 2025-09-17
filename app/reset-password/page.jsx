// app/reset-password/page.jsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/auth';
import ResetPassword from '@/components/auth/ResetPassword';

export const dynamic = 'force-dynamic';

// Métadonnées pour SEO et sécurité
export const metadata = {
  title: 'Réinitialiser votre mot de passe | Buy It Now',
  description:
    'Créez un nouveau mot de passe sécurisé pour votre compte Buy It Now.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  openGraph: {
    title: 'Réinitialiser votre mot de passe | Buy It Now',
    description: 'Créez un nouveau mot de passe sécurisé',
    type: 'website',
  },
};

/**
 * Composant de contenu de la page de réinitialisation
 */
async function ResetPasswordContent({ searchParams }) {
  try {
    // Récupérer le token depuis les paramètres d'URL
    const token = await searchParams?.token;

    // Vérifier la présence du token
    if (!token) {
      console.warn('Reset password page accessed without token', {
        timestamp: new Date().toISOString(),
      });

      // Rediriger vers forgot-password si pas de token
      redirect('/forgot-password?error=missing_token');
    }

    // Validation basique du format du token
    if (token.length < 10 || token.length > 200) {
      console.warn('Invalid token format on reset password page', {
        tokenLength: token.length,
        timestamp: new Date().toISOString(),
      });

      redirect('/forgot-password?error=invalid_token');
    }

    // Vérifier si l'utilisateur est déjà connecté
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);

    if (user) {
      console.log('User already logged in, redirecting from reset-password:', {
        userId: user._id?.substring(0, 8) + '...',
        email: user.email?.substring(0, 3) + '***',
      });
      // Si connecté, rediriger vers la page de changement de mot de passe normale
      return redirect('/me/update_password');
    }

    // Récupérer les en-têtes pour le logging et la sécurité
    const userAgent = headersList.get('user-agent') || 'unknown';
    const referer = headersList.get('referer') || 'direct';

    // Journaliser l'accès à la page (anonymisé)
    const clientIp = (headersList.get('x-forwarded-for') || '')
      .split(',')
      .shift()
      .trim();
    const anonymizedIp = clientIp ? clientIp.replace(/\d+$/, 'xxx') : 'unknown';

    console.info('Reset password page accessed', {
      userAgent: userAgent?.substring(0, 100),
      referer: referer?.substring(0, 200),
      ip: anonymizedIp,
      hasToken: !!token,
      tokenLength: token?.length,
      timestamp: new Date().toISOString(),
    });

    // Détection basique d'activité potentiellement suspecte
    const isLikelyBot =
      !userAgent ||
      userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawl') ||
      userAgent.toLowerCase().includes('spider');

    if (isLikelyBot) {
      console.warn('Potential bot detected on reset password page', {
        userAgent: userAgent?.substring(0, 100),
        ip: anonymizedIp,
      });
    }

    // Rendu du composant client
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Créez votre nouveau mot de passe
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Choisissez un mot de passe fort et sécurisé
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <ResetPassword token={token} referer={referer} />
          </div>
        </div>

        {/* Conseils de sécurité */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Conseils pour un mot de passe sécurisé
                </h3>
                <div className="mt-2 text-xs text-green-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Utilisez au moins 8 caractères</li>
                    <li>
                      Incluez majuscules, minuscules, chiffres et symboles
                    </li>
                    <li>Évitez les informations personnelles</li>
                    <li>N&apos;utilisez pas de mots du dictionnaire</li>
                    <li>Utilisez un mot de passe unique pour ce site</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in reset password page:', error);

    // En cas d'erreur, rediriger vers la page d'erreur
    redirect(
      '/auth/error?error=server_error&message=Erreur lors du chargement de la page de réinitialisation',
    );
  }
}

/**
 * Page de réinitialisation de mot de passe - Server Component
 */
export default function ResetPasswordPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
