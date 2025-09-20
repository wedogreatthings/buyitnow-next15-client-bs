import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// AJOUTER CET IMPORT
import { getAuthenticatedUser } from '@/lib/auth';
import VerifyEmail from '@/components/auth/VerifyEmail';

// Métadonnées pour SEO
export const metadata = {
  title: 'Vérification de votre email | BuyItNow',
  description:
    'Vérifiez votre adresse email pour accéder à toutes les fonctionnalités de BuyItNow.',
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Composant de contenu de la page de vérification
 */
async function VerifyEmailContent() {
  try {
    // PAR CECI :
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);

    // Rediriger si l'utilisateur n'est pas connecté
    if (!user) {
      console.log('User not authenticated, redirecting to login');
      redirect('/login?callbackUrl=/auth/verify');
    }

    // Vérifier si l'utilisateur est déjà vérifié
    const isAlreadyVerified =
      user.verified === true || user.isVerified === true;

    if (isAlreadyVerified) {
      console.log('User already verified, redirecting to home');
      redirect('/?message=already_verified');
    }

    const userAgent = headersList.get('user-agent') || 'unknown';
    const referer = headersList.get('referer') || 'direct';

    // Log de l'accès à la page de vérification
    console.log('Verification page accessed:', {
      userId: user._id?.substring(0, 8) + '...',
      email: user.email?.substring(0, 3) + '***',
      verified: user.verified || user.isVerified,
      userAgent: userAgent.substring(0, 100),
      referer: referer.substring(0, 200),
    });

    // Calculer le temps depuis l'inscription pour l'affichage
    let memberSince = null;
    if (user.createdAt || user.memberSince) {
      const createdDate = new Date(user.createdAt || user.memberSince);
      const now = new Date();
      const diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      memberSince = diffDays;
    }

    // Préparer les données pour le composant client
    const userData = {
      name: user.name || 'Utilisateur',
      email: user.email,
      verified: user.verified || user.isVerified || false,
      memberSince,
      avatar: user.avatar,
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Vérification de votre email
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Finalisez votre inscription pour accéder à toutes les
            fonctionnalités
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <VerifyEmail user={userData} referer={referer} />
          </div>
        </div>

        {/* Footer informatif */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-2">
              Vous ne recevez pas l&apos;email de vérification ?
            </p>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">
                • Vérifiez votre dossier spam/courrier indésirable
              </p>
              <p className="text-xs text-gray-400">
                • L&apos;email peut prendre quelques minutes à arriver
              </p>
              <p className="text-xs text-gray-400">
                • Contactez-nous si le problème persiste
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in verify page:', error);

    // En cas d'erreur, rediriger vers la page d'erreur
    redirect(
      '/auth/error?error=server_error&message=Erreur lors du chargement de la page de vérification',
    );
  }
}

/**
 * Page de vérification email - Server Component
 */
export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
