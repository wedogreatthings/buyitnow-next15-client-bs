// app/forgot-password/page.jsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import ForgotPassword from '@/components/auth/ForgotPassword';

export const dynamic = 'force-dynamic';

// Métadonnées pour SEO et sécurité
export const metadata = {
  title: 'Mot de passe oublié | Buy It Now',
  description: 'Réinitialisez votre mot de passe Buy It Now en toute sécurité.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: '/forgot-password',
  },
  openGraph: {
    title: 'Mot de passe oublié | Buy It Now',
    description: 'Réinitialisez votre mot de passe Buy It Now',
    type: 'website',
  },
};

/**
 * Page de demande de réinitialisation de mot de passe
 * Server Component qui vérifie l'authentification
 */
export default async function ForgotPasswordPage() {
  try {
    // Vérifier si l'utilisateur est déjà connecté
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);

    if (user) {
      console.log('User already logged in, redirecting from forgot-password:', {
        userId: user._id?.substring(0, 8) + '...',
        email: user.email?.substring(0, 3) + '***',
      });
      // Rediriger vers le tableau de bord si déjà connecté
      return redirect('/me');
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

    console.info('Forgot password page accessed', {
      userAgent: userAgent?.substring(0, 100),
      referer: referer?.substring(0, 200),
      ip: anonymizedIp,
      timestamp: new Date().toISOString(),
    });

    // Détection basique d'activité potentiellement suspecte
    const isLikelyBot =
      !userAgent ||
      userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawl') ||
      userAgent.toLowerCase().includes('spider');

    if (isLikelyBot) {
      console.warn('Potential bot detected on forgot password page', {
        userAgent: userAgent?.substring(0, 100),
        ip: anonymizedIp,
      });
    }

    // Rendu du composant client avec les props nécessaires
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Mot de passe oublié ?
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Nous vous enverrons un lien pour réinitialiser votre mot de passe
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <ForgotPassword referer={referer} />
          </div>
        </div>

        {/* Instructions de sécurité */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Informations importantes
                </h3>
                <div className="mt-2 text-xs text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Le lien de réinitialisation expire après 1 heure</li>
                    <li>
                      Vérifiez votre dossier spam si vous ne recevez pas
                      l&apos;email
                    </li>
                    <li>
                      N&apos;utilisez jamais un lien de réinitialisation
                      provenant d&apos;un email suspect
                    </li>
                    <li>
                      Assurez-vous que l&apos;URL commence par{' '}
                      {process.env.NEXT_PUBLIC_APP_URL ||
                        'https://buyitnow.com'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Journaliser l'erreur
    console.error('Error initializing forgot password page', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Rediriger vers la page de connexion en cas d'erreur
    redirect('/login');
  }
}
