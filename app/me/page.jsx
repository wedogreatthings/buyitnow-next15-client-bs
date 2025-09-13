import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCookieName } from '@/helpers/helpers';

const ProfileSkeleton = () => (
  <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
    <div className="h-10 bg-gray-200 rounded w-1/4 mb-6"></div>
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2.5"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2.5"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
    </div>
    <span className="sr-only">Loading profile data...</span>
  </div>
);

const Profile = dynamic(
  () => import('@/components/auth/Profile').then((mod) => mod.default),
  {
    loading: () => <ProfileSkeleton />,
    ssr: true,
  },
);

// MODIFICATION: Fonction avec cache et meilleure gestion d'erreurs
const getAllAddresses = async (page = 'shipping') => {
  try {
    // Valider le paramètre page
    if (page && !['profile', 'shipping'].includes(page)) {
      console.warn('Invalid page parameter, using default:', { page });
      page = 'shipping';
    }

    // Obtenir le cookie d'authentification
    const nextCookies = await cookies();
    const cookieName = getCookieName();
    const authToken = nextCookies.get(cookieName);

    // Vérifier l'authentification
    if (!authToken) {
      console.warn('No authentication token found for address fetch');
      return {
        success: false,
        message: 'Authentification requise',
        data:
          page === 'profile'
            ? { addresses: [] }
            : { addresses: [], paymentTypes: [], deliveryPrice: [] },
      };
    }

    // MODIFICATION: Utiliser une variable d'environnement validée
    const apiUrl =
      process.env.API_URL || 'https://buyitnow-client-n15-prv1.vercel.app';
    if (!apiUrl) {
      throw new Error('API_URL not configured');
    }

    const fullUrl = `${apiUrl}/api/address?context=${page}`;

    // MODIFICATION: Log conditionnel
    console.debug('Fetching addresses', { url: fullUrl, page });

    // Faire l'appel API avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        Cookie: `${authToken.name}=${authToken.value}`,
      },
      next: {
        revalidate: 0,
        tags: ['user-addresses'],
      },
    });

    clearTimeout(timeoutId);

    // Vérifier le statut HTTP
    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          message: 'Authentification requise',
          data:
            page === 'profile'
              ? { addresses: [] }
              : { addresses: [], paymentTypes: [], deliveryPrice: [] },
        };
      }

      if (res.status === 404) {
        return {
          success: true,
          message: 'Aucune adresse trouvée',
          data:
            page === 'profile'
              ? { addresses: [] }
              : { addresses: [], paymentTypes: [], deliveryPrice: [] },
        };
      }

      console.error(`API Error: ${res.status} - ${res.statusText}`);
      return {
        success: false,
        message: 'Erreur lors de la récupération des adresses',
        data:
          page === 'profile'
            ? { addresses: [] }
            : { addresses: [], paymentTypes: [], deliveryPrice: [] },
      };
    }

    const responseBody = await res.json();

    if (!responseBody.success || !responseBody.data) {
      console.error('Invalid API response structure', { responseBody });
      return {
        success: false,
        message: responseBody.message || 'Réponse API invalide',
        data:
          page === 'profile'
            ? { addresses: [] }
            : { addresses: [], paymentTypes: [], deliveryPrice: [] },
      };
    }

    // Formater les données selon le contexte
    let responseData = { ...responseBody.data };

    if (page === 'profile') {
      responseData = {
        addresses: responseData.addresses || [],
      };
    } else {
      responseData = {
        addresses: responseData.addresses || [],
        paymentTypes: responseData.paymentTypes || [],
        deliveryPrice: responseData.deliveryPrice || [],
      };
    }

    return {
      success: true,
      message: 'Adresses récupérées avec succès',
      data: responseData,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timeout after 5 seconds');
      return {
        success: false,
        message: 'La requête a pris trop de temps',
        data:
          page === 'profile'
            ? { addresses: [] }
            : { addresses: [], paymentTypes: [], deliveryPrice: [] },
      };
    }

    console.error('Network error:', { error: error.message });
    return {
      success: false,
      message: 'Problème de connexion réseau',
      data:
        page === 'profile'
          ? { addresses: [] }
          : { addresses: [], paymentTypes: [], deliveryPrice: [] },
    };
  }
};

export const metadata = {
  title: 'Buy It Now - Your Profile',
  description: 'Manage your account settings and addresses',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  // MODIFICATION: Utiliser la version cachée
  const data = await getAllAddresses('profile');

  if (!data) {
    return notFound();
  }

  // Security: Sanitize address data
  const sanitizedAddresses =
    data?.data?.addresses?.map((address) => ({
      ...address,
      street: String(address.street || '').trim(),
      city: String(address.city || '').trim(),
      state: String(address.state || '').trim(),
      zipCode: String(address.zipCode || '').trim(),
      country: String(address.country || '').trim(),
    })) || [];

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile addresses={sanitizedAddresses} />
    </Suspense>
  );
}
