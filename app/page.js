import { Suspense, lazy } from 'react';
import ListProductsSkeleton from '@/components/skeletons/ListProductsSkeleton';
import { parseProductSearchParams } from '@/utils/inputSanitizer';

// Utilisation de lazy au lieu de dynamic pour éviter le conflit de nom
const ListProducts = lazy(() => import('@/components/products/ListProducts'));

// STRATÉGIE DE RENDU : ISR (Incremental Static Regeneration)
// Parfait pour un e-commerce avec ~500 visiteurs/jour
export const revalidate = 3600; // Revalidation toutes les heures (3600 secondes)

export const metadata = {
  title: 'Buy It Now - Votre boutique en ligne',
  description:
    'Découvrez notre sélection de produits de qualité à des prix attractifs',
  openGraph: {
    title: 'Buy It Now - Votre boutique en ligne',
    description:
      'Découvrez notre sélection de produits de qualité à des prix attractifs',
    type: 'website',
    image: '/og-image.jpg', // Cohérent avec head.js
  },
};

/**
 * Récupère tous les produits depuis l'API
 * Version optimisée avec ISR pour ~500 visiteurs/jour
 *
 * @param {Object} searchParams - Paramètres de recherche (objet JavaScript)
 * @returns {Promise<Object>} Données des produits ou erreur
 */
const getAllProducts = async (searchParams) => {
  try {
    // 1. Convertir l'objet searchParams en URLSearchParams
    const urlSearchParams = new URLSearchParams();

    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          urlSearchParams.set(key, String(value));
        }
      });
    }

    // 2. Parser et nettoyer les paramètres de recherche
    const cleanParams = parseProductSearchParams(urlSearchParams);

    // 3. Construire la query string
    const searchQuery = new URLSearchParams(cleanParams).toString();

    // 4. Construire l'URL complète de l'API
    const apiUrl = `${
      process.env.API_URL || 'https://buyitnow-next15-client-bs.vercel.app'
    }/api/products${searchQuery ? `?${searchQuery}` : ''}`;

    console.log('Fetching products from:', apiUrl);

    // 5. Faire l'appel API avec timeout (5 secondes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      next: {
        revalidate: 300, // Cache Next.js de 5 minutes pour les produits
        tags: ['products'],
      },
    });

    clearTimeout(timeoutId);

    // 6. Vérifier le statut HTTP
    if (!res.ok) {
      if (res.status === 400) {
        console.error('Bad request - Invalid parameters');
        return {
          success: false,
          message: 'Paramètres de requête invalides',
          data: { products: [], totalPages: 0 },
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          message: 'Aucun produit trouvé',
          data: { products: [], totalPages: 0 },
        };
      }

      console.error(`API Error: ${res.status} - ${res.statusText}`);
      return {
        success: false,
        message: 'Erreur lors de la récupération des produits',
        data: { products: [], totalPages: 0 },
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
        data: { products: [], totalPages: 0 },
      };
    }

    // 9. Retourner les données avec succès
    return {
      success: true,
      message: 'Produits récupérés avec succès',
      data: {
        products: responseBody.data.products || [],
        totalPages: responseBody.data.totalPages || 0,
        totalProducts: responseBody.data.totalProducts || 0,
      },
    };
  } catch (error) {
    // 10. Gestion des erreurs réseau/timeout
    if (error.name === 'AbortError') {
      console.error('Request timeout after 5 seconds');
      return {
        success: false,
        message: 'La requête a pris trop de temps',
        data: { products: [], totalPages: 0 },
      };
    }

    console.error('Network error:', error.message);
    return {
      success: false,
      message: 'Problème de connexion réseau',
      data: { products: [], totalPages: 0 },
    };
  }
};

/**
 * Récupère toutes les catégories depuis l'API
 * Version optimisée avec cache long (les catégories changent rarement)
 *
 * @returns {Promise<Object>} Données des catégories ou erreur
 */
const getCategories = async () => {
  try {
    const apiUrl = `${process.env.API_URL || ''}/api/category`;

    console.log('Fetching categories from:', apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      next: {
        revalidate: 1800, // Cache Next.js de 30 minutes (catégories stables)
        tags: ['categories'],
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`API Error: ${res.status} - ${res.statusText}`);

      if (res.status === 404) {
        return {
          success: true,
          message: 'Aucune catégorie disponible',
          categories: [],
          count: 0,
        };
      }

      return {
        success: false,
        message: 'Erreur lors de la récupération des catégories',
        categories: [],
        count: 0,
      };
    }

    const responseBody = await res.json();

    if (!responseBody.success || !responseBody.data) {
      console.error('Invalid API response structure:', responseBody);
      return {
        success: false,
        message: responseBody.message || 'Réponse API invalide',
        categories: [],
        count: 0,
      };
    }

    const categories = responseBody.data.categories || [];

    console.log('Retrieved categories:', categories);

    return {
      success: true,
      message: 'Catégories récupérées avec succès',
      categories: categories,
      count: responseBody.data.count || categories.length,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timeout after 5 seconds');
      return {
        success: false,
        message: 'La requête a pris trop de temps',
        categories: [],
        count: 0,
      };
    }

    console.error('Network error:', error.message);
    return {
      success: false,
      message: 'Problème de connexion réseau',
      categories: [],
      count: 0,
    };
  }
};

const HomePage = async ({ searchParams }) => {
  // Récupération des données avec fallback en cas d'erreur
  const productsData = await getAllProducts(searchParams).catch(() => ({
    data: { products: [], totalPages: 0 },
  }));

  const categories = await getCategories().catch(() => ({
    categories: [],
  }));

  console.log('Categories data in HomePage:', categories);

  return (
    <Suspense fallback={<ListProductsSkeleton />}>
      <main>
        <ListProducts
          data={productsData?.data}
          categories={categories.categories}
        />
      </main>
    </Suspense>
  );
};

export default HomePage;
