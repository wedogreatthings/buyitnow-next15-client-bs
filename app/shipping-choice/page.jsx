import { Suspense, lazy } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { captureException } from '@/monitoring/sentry';
import { getCookieName } from '@/helpers/helpers';

// Lazy loading du composant ShippingChoice
const ShippingChoice = lazy(() => import('@/components/cart/ShippingChoice'));

// Forcer le rendu dynamique pour cette page
export const dynamic = 'force-dynamic';

/**
 * Récupère toutes les adresses d'un utilisateur
 * Version simplifiée et optimisée pour ~500 visiteurs/jour
 *
 * @param {string} page - Contexte de la page ('profile' ou 'shipping')
 * @returns {Promise<Object>} Données des adresses ou erreur
 */
const getAllAddresses = async (page = 'shipping') => {
  try {
    // 1. Valider le paramètre page
    if (page && !['profile', 'shipping'].includes(page)) {
      console.warn('Invalid page parameter, using default:', page);
      page = 'shipping';
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
        data:
          page === 'profile'
            ? { addresses: [] }
            : { addresses: [], paymentTypes: [], deliveryPrice: [] },
      };
    }

    // 4. Construire l'URL de l'API avec le contexte
    const apiUrl = `${
      process.env.API_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
    }/api/address?context=${page}`;

    console.log('Fetching addresses from:', apiUrl); // Log pour debug

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
        tags: ['user-addresses'],
      },
    });

    clearTimeout(timeoutId);

    // 6. Vérifier le statut HTTP
    if (!res.ok) {
      // Gestion simple des erreurs principales
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
          success: true, // Succès mais liste vide
          message: 'Aucune adresse trouvée',
          data:
            page === 'profile'
              ? { addresses: [] }
              : { addresses: [], paymentTypes: [], deliveryPrice: [] },
        };
      }

      // Erreur serveur générique
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

    // 7. Parser la réponse JSON
    const responseBody = await res.json();

    // 8. Vérifier la structure de la réponse
    if (!responseBody.success || !responseBody.data) {
      console.error('Invalid API response structure:', responseBody);
      return {
        success: false,
        message: responseBody.message || 'Réponse API invalide',
        data:
          page === 'profile'
            ? { addresses: [] }
            : { addresses: [], paymentTypes: [], deliveryPrice: [] },
      };
    }

    // 9. Formater les données selon le contexte
    let responseData = { ...responseBody.data };

    // Si on est sur la page profil, on n'a pas besoin des données de paiement
    if (page === 'profile') {
      responseData = {
        addresses: responseData.addresses || [],
      };
    } else {
      // Page shipping : on garde tout
      responseData = {
        addresses: responseData.addresses || [],
        paymentTypes: responseData.paymentTypes || [],
        deliveryPrice: responseData.deliveryPrice || [],
      };
    }

    // 10. Retourner les données avec succès
    return {
      success: true,
      message: 'Adresses récupérées avec succès',
      data: responseData,
    };
  } catch (error) {
    // 11. Gestion des erreurs réseau/timeout
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

    // Erreur réseau générique
    console.error('Network error:', error.message);
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

// Métadonnées enrichies pour le SEO
export const metadata = {
  title: 'Choisir votre mode de livraison | Buy It Now',
  description:
    'Choisissez si vous souhaitez une livraison à domicile ou un retrait en point relais',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Choisir votre mode de livraison | Buy It Now',
    description:
      'Choisissez si vous souhaitez une livraison à domicile ou un retrait en point relais',
    type: 'website',
  },
  alternates: {
    canonical: '/shipping-choice',
  },
};

/**
 * Page de choix de livraison - Server Component
 * Vérifie l'authentification et charge les données nécessaires pour le composant client
 */
const ShippingChoicePage = async () => {
  try {
    // Vérification de l'authentification côté serveur
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get('next-auth.session-token') ||
      cookieStore.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      // Rediriger vers la page de connexion avec retour après authentification
      return redirect('/login?callbackUrl=/shipping-choice');
    }

    // Récupération des données avec gestion d'erreur
    const data = await getAllAddresses('shipping').catch((error) => {
      console.error('Error fetching shipping data:', error);
      captureException(error, {
        tags: { component: 'ShippingChoicePage', action: 'getAllAddresses' },
      });
      return {
        addresses: [],
        paymentTypes: [],
        deliveryPrice: [{ deliveryPrice: 0 }],
      };
    });

    // Vérification des données reçues avec valeurs par défaut sécurisées
    const addresses = Array.isArray(data?.data?.addresses)
      ? data.data.addresses
      : [];
    const payments = Array.isArray(data?.data?.paymentTypes)
      ? data.data.paymentTypes
      : [];
    const deliveryPrice = Array.isArray(data?.data?.deliveryPrice)
      ? data.data.deliveryPrice
      : [{ deliveryPrice: 0 }];

    return (
      <div
        className="shipping-choice-page"
        itemScope
        itemType="https://schema.org/WebPage"
      >
        <meta itemProp="name" content="Choix de livraison" />
        <Suspense>
          <ShippingChoice
            addresses={addresses}
            payments={payments}
            deliveryPrice={deliveryPrice}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    // Capture et journalisation de l'erreur
    console.error('Error in shipping choice page:', error);
    captureException(error, {
      tags: { component: 'ShippingChoicePage' },
    });

    // Redirection en cas d'erreur fatale
    redirect('/cart?error=shipping-choice-error');
  }
};

export default ShippingChoicePage;
