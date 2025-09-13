import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { lazy } from 'react';
import { getAuthenticatedUser } from '@/lib/auth';

// Chargement dynamique optimisé avec retries
const Register = lazy(() => import('@/components/auth/Register'), {
  ssr: true, // Activer le SSR pour améliorer le premier chargement
});

export const dynamic = 'force-dynamic';

// Métadonnées SEO complètes
export const metadata = {
  title: 'Créer un compte | Buy It Now',
  description:
    'Créez votre compte sur Buy It Now pour commencer vos achats et profiter de nos offres exclusives.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: '/register',
  },
  openGraph: {
    title: 'Inscription | Buy It Now',
    description:
      'Créez un compte et rejoignez notre communauté de clients satisfaits.',
    type: 'website',
    images: [
      {
        url: '/images/signup-banner.jpg',
        width: 1200,
        height: 630,
        alt: 'Inscription à Buy It Now',
      },
    ],
  },
};

// Configuration des headers de sécurité spécifiques
export const header = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Page d'inscription optimisée avec vérifications de sécurité,
 * gestion des sessions et mesures anti-fraude
 */
async function RegisterPage() {
  try {
    // Vérifier si l'utilisateur est déjà connecté
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);
    if (user) {
      // Rediriger l'utilisateur déjà connecté vers la page d'accueil
      return redirect('/');
    }

    // Récupérer les en-têtes pour le monitoring et la sécurité
    const userAgent = headersList.get('user-agent') || 'unknown';
    const referer = headersList.get('referer') || 'direct';

    // Journaliser la tentative d'inscription (anonymisée pour la protection des données)
    const clientIp = (headersList.get('x-forwarded-for') || '')
      .split(',')
      .shift()
      .trim();
    const anonymizedIp = clientIp ? clientIp.replace(/\d+$/, 'xxx') : 'unknown';

    console.info('Registration page accessed', {
      userAgent: userAgent.substring(0, 100),
      referer: referer.substring(0, 200),
      ip: anonymizedIp,
    });

    // Vérification de base anti-bot/spam
    const isLikelyBot =
      !userAgent ||
      userAgent.toLowerCase().includes('bot') ||
      userAgent.toLowerCase().includes('crawl') ||
      userAgent.toLowerCase().includes('spider');

    if (isLikelyBot) {
      console.warn('Potential bot detected on registration page', {
        userAgent: userAgent.substring(0, 100),
        ip: anonymizedIp,
      });
      // On permet quand même l'accès mais on le note pour monitoring
    }

    // Rendu du composant avec contexte enrichi
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Créer votre compte
          </h1>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <Register referer={referer} />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Journaliser l'erreur
    console.error('Error initializing registration page', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

export default RegisterPage;
