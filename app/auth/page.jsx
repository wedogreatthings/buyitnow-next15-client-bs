import AuthSuccessContent from '@/components/auth/AuthSuccessContent';
import { Suspense } from 'next';

// Métadonnées pour SEO
export const metadata = {
  title: 'Email vérifié avec succès | BuyItNow',
  description:
    'Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant vous connecter à votre compte.',
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Page de succès d'authentification
 */
export default async function AuthSuccessPage({ searchParams }) {
  const message = await searchParams?.message;
  const email = await searchParams?.email;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <AuthSuccessContent message={message} email={email} />
    </Suspense>
  );
}
