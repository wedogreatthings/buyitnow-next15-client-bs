import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';

import UpdateAddressSkeleton from '@/components/skeletons/UpdateAddressSkeleton';
import { getCookieName } from '@/helpers/helpers';
import UpdateAddress from '@/components/user/UpdateAddress';
import { getAuthenticatedUser } from '@/lib/auth';

// Force dynamic rendering to ensure fresh auth and data
export const dynamic = 'force-dynamic';

/**
 * Récupère une adresse spécifique par son ID
 * Version simplifiée et optimisée pour ~500 visiteurs/jour
 *
 * @param {string} id - L'ID MongoDB de l'adresse
 * @returns {Promise<Object>} Détails de l'adresse ou erreur
 */
const getSingleAddress = async (id) => {
  try {
    // 1. Validation simple de l'ID MongoDB (24 caractères hexadécimaux)
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error('Invalid address ID format:', id);
      return {
        success: false,
        message: "Format d'identifiant d'adresse invalide",
        notFound: true,
      };
    }

    // 2. Obtenir le cookie d'authentification
    const nextCookies = await cookies();
    const cookieName = getCookieName();
    const authToken = nextCookies.get(cookieName);

    // 3. Vérifier l'authentification
    if (!authToken) {
      console.warn('No authentication token found');
      return {
        success: false,
        message: 'Authentification requise',
        notFound: false,
      };
    }

    // 4. Construire l'URL de l'API
    const apiUrl = `${process.env.API_URL || 'https://buyitnow-client-n15-prv1.vercel.app'}/api/address/${id}`;

    console.log('Fetching address from:', apiUrl); // Log pour debug

    // 5. Faire l'appel API avec timeout (5 secondes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Cookie: `${authToken.name}=${authToken.value}`,
      },
      next: {
        revalidate: 0, // Pas de cache pour les données utilisateur
        tags: [`address-${id}`],
      },
    });

    clearTimeout(timeoutId);

    // 6. Vérifier le statut HTTP
    if (!res.ok) {
      // Gestion simple des erreurs principales
      if (res.status === 400) {
        return {
          success: false,
          message: "Format d'identifiant invalide",
          notFound: true,
        };
      }

      if (res.status === 401) {
        return {
          success: false,
          message: 'Authentification requise',
          notFound: false,
        };
      }

      if (res.status === 403) {
        return {
          success: false,
          message: 'Accès interdit à cette adresse',
          notFound: false,
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          message: 'Adresse non trouvée',
          notFound: true,
        };
      }

      // Erreur serveur générique
      console.error(`API Error: ${res.status} - ${res.statusText}`);
      return {
        success: false,
        message: "Erreur lors de la récupération de l'adresse",
        notFound: false,
      };
    }

    // 7. Parser la réponse JSON
    const responseBody = await res.json();

    // 8. Vérifier la structure de la réponse
    if (!responseBody.success || !responseBody.data?.address) {
      console.error('Invalid API response structure:', responseBody);
      return {
        success: false,
        message: responseBody.message || "Données d'adresse manquantes",
        notFound: true,
      };
    }

    // 9. Retourner les données avec succès
    return {
      success: true,
      address: responseBody.data.address,
      message: 'Adresse récupérée avec succès',
    };
  } catch (error) {
    // 10. Gestion des erreurs réseau/timeout
    if (error.name === 'AbortError') {
      console.error('Request timeout after 5 seconds');
      return {
        success: false,
        message: 'La requête a pris trop de temps',
        notFound: false,
      };
    }

    // Erreur réseau générique
    console.error('Network error:', error.message);
    return {
      success: false,
      message: 'Problème de connexion réseau',
      notFound: false,
    };
  }
};

// Métadonnées enrichies pour SEO
export const metadata = {
  title: 'Modifier une adresse | Buy It Now',
  description:
    'Modifiez une adresse de livraison existante sur votre compte Buy It Now',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: '/address/[id]',
  },
};

/**
 * Classe pour gérer les erreurs spécifiques aux adresses
 */
class AddressError extends Error {
  constructor(message, statusCode = 500, code = 'ADDRESS_ERROR') {
    super(message);
    this.name = 'AddressError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Server component for the update address page that performs authorization checks
 * and prepares necessary data for the client component
 */
async function UpdateAddressPage({ params }) {
  try {
    // Validation basique de l'ID
    const addressId = params?.id;
    if (!addressId || typeof addressId !== 'string') {
      throw new AddressError(
        "Identifiant d'adresse invalide",
        400,
        'INVALID_ID',
      );
    }

    // Vérifier si l'utilisateur est authentifié
    const headersList = await headers();
    const user = await getAuthenticatedUser(headersList);
    if (!user) {
      console.log('User not authenticated, redirecting to login');
      return redirect(`/login?callbackUrl=/address/${addressId}`);
    }

    // Récupérer les en-têtes pour le logging et la sécurité
    const userAgent = headersList.get('user-agent') || 'unknown';
    const referer = headersList.get('referer') || 'direct';

    // Journal d'accès anonymisé
    const clientIp = (headersList.get('x-forwarded-for') || '')
      .split(',')
      .shift()
      .trim();
    const anonymizedIp = clientIp ? clientIp.replace(/\d+$/, 'xxx') : 'unknown';

    console.info('Address update page accessed', {
      userAgent: userAgent?.substring(0, 100),
      referer: referer?.substring(0, 200),
      ip: anonymizedIp,
      userId: user._id
        ? `${user._id.substring(0, 2)}...${user._id.slice(-2)}`
        : 'unknown',
      addressId: addressId.substring(0, 4) + '...',
    });

    // Récupérer les données de l'adresse avec gestion des erreurs
    const address = await getSingleAddress(addressId).catch((error) => {
      console.error(`Failed to fetch address ${addressId}:`, error);

      // Capture avec Sentry pour monitoring
      captureException(error, {
        tags: {
          component: 'UpdateAddressPage',
          action: 'getSingleAddress',
          addressId,
        },
      });

      throw new AddressError(
        "Impossible de récupérer les détails de l'adresse",
        error.statusCode || 500,
        error.code || 'FETCH_ERROR',
      );
    });

    // Vérifier si l'adresse existe
    if (!address) {
      console.warn(`Address not found: ${addressId}`);
      throw new AddressError('Adresse introuvable', 404, 'NOT_FOUND');
    }

    // Vérifier que l'adresse appartient bien à l'utilisateur connecté
    if (address.user && address.user.toString() !== user._id.toString()) {
      console.warn(`Unauthorized access attempt to address ${addressId}`);
      throw new AddressError(
        "Vous n'êtes pas autorisé à modifier cette adresse",
        403,
        'UNAUTHORIZED',
      );
    }

    // Render the page with proper error boundaries
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-2xl">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Modifier votre adresse
          </h1>

          <div className="mt-8">
            <div className="bg-white py-8 px-4 sm:px-8 shadow sm:rounded-lg">
              <Suspense fallback={<UpdateAddressSkeleton />}>
                <UpdateAddress
                  id={addressId}
                  address={address.address}
                  userId={user._id}
                  referer={referer}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Gestion des erreurs spécifiques
    console.error('Error in update address page:', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Capture pour Sentry avec contexte enrichi
    captureException(error, {
      tags: {
        component: 'UpdateAddressPage',
        errorType: error.name,
        statusCode: error.statusCode,
        code: error.code,
      },
      extra: {
        message: error.message,
        addressId: params?.id,
      },
    });

    // Redirection appropriée selon le type d'erreur
    if (error.statusCode === 404 || error.code === 'NOT_FOUND') {
      return notFound();
    }

    if (error.statusCode === 403 || error.code === 'UNAUTHORIZED') {
      return redirect('/');
    }

    // Lancer une erreur générique pour le boundary d'erreur global
    throw new Error("Impossible de charger la page de modification d'adresse", {
      cause: error,
    });
  }
}

export default UpdateAddressPage;
