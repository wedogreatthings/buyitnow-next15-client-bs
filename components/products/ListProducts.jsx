'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isArrayEmpty } from '@/helpers/helpers';
import { captureException } from '@/monitoring/sentry';
import {
  FiltersSkeleton,
  ProductItemSkeleton,
} from '../skeletons/ListProductsSkeleton';
import { SearchX } from 'lucide-react';

// Import dynamique des composants
const CustomPagination = dynamic(
  () => import('@/components/layouts/CustomPagination'),
  { ssr: true },
);

const Filters = dynamic(() => import('../layouts/Filters'), {
  loading: () => <FiltersSkeleton />,
  ssr: true,
});

const ProductItem = dynamic(() => import('./ProductItem'), {
  loading: () => <ProductItemSkeleton />,
  ssr: true,
});

const ListProducts = ({ data, categories }) => {
  // États locaux
  const [localLoading, setLocalLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Récupérer les paramètres de recherche pour les afficher
  const keyword = searchParams?.get('keyword');
  const category = searchParams?.get('category');
  const minPrice = searchParams?.get('min');
  const maxPrice = searchParams?.get('max');
  const page = searchParams?.get('page');

  // Construire un message récapitulatif des filtres appliqués
  const getFilterSummary = useCallback(() => {
    try {
      let summary = [];

      if (keyword) summary.push(`Recherche: "${keyword}"`);
      if (category) {
        const categoryName = categories?.find(
          (c) => c._id === category,
        )?.categoryName;
        if (categoryName) summary.push(`Catégorie: ${categoryName}`);
      }
      if (minPrice && maxPrice)
        summary.push(`Prix: ${minPrice}€ - ${maxPrice}€`);
      else if (minPrice) summary.push(`Prix min: ${minPrice}€`);
      else if (maxPrice) summary.push(`Prix max: ${maxPrice}€`);

      if (page) summary.push(`Page: ${page || 1}`);

      return summary.length > 0 ? summary.join(' | ') : null;
    } catch (err) {
      // Capture silencieuse d'erreur pour éviter de planter le composant
      captureException(err, {
        tags: { component: 'ListProducts', function: 'getFilterSummary' },
      });
      return null;
    }
  }, [keyword, category, minPrice, maxPrice, page, categories]);

  // Utiliser useMemo pour éviter les recalculs inutiles
  const filterSummary = useMemo(() => getFilterSummary(), [getFilterSummary]);

  // Vérifier la validité des données pour éviter les erreurs
  const hasValidData = data && typeof data === 'object';
  const hasValidCategories = categories && Array.isArray(categories);

  // Handler pour réinitialiser les filtres
  const handleResetFilters = useCallback(() => {
    try {
      setLocalLoading(true);
      router.push('/');
    } catch (err) {
      // Supprimer cette ligne : setError(err);
      // Au lieu de cela, laisser l'erreur se propager vers Error Boundary
      console.error(err);
      throw err; // Optionnel, mais permet de propager l'erreur vers error.jsx
    }
  }, []);

  useEffect(() => {
    // Seulement pour l'initial render, pas pour les changements de filtres
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }

    if (localLoading) {
      setLocalLoading(false);
    }
  }, [data]);

  // Afficher un avertissement si les données ne sont pas valides
  if (!hasValidData) {
    return (
      <div
        className="p-4 bg-yellow-50 border border-yellow-200 rounded-md my-4"
        role="alert"
      >
        <p className="font-medium text-yellow-700">
          Les données des produits ne sont pas disponibles pour le moment.
        </p>
      </div>
    );
  }

  return (
    <section className="py-8">
      <div className="container max-w-[1440px] mx-auto px-4">
        <div className="flex flex-col md:flex-row -mx-4">
          {hasValidCategories ? (
            <Filters
              categories={categories}
              setLocalLoading={setLocalLoading}
            />
          ) : (
            <div className="md:w-1/3 lg:w-1/4 px-4">
              <div className="p-4 bg-gray-100 rounded-md">
                <p>Chargement des filtres...</p>
              </div>
            </div>
          )}

          <main
            className="md:w-2/3 lg:w-3/4 px-3"
            aria-label="Liste des produits"
          >
            {/* Affichage du récapitulatif des filtres et du nombre de résultats */}
            {filterSummary && (
              <div
                className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100"
                aria-live="polite"
                aria-label="Filtres appliqués"
              >
                <p className="font-medium">{filterSummary}</p>
              </div>
            )}

            <div className="mb-4 flex justify-between items-center">
              <h1
                className="text-xl font-bold text-gray-800"
                aria-live="polite"
              >
                {data?.products?.length > 0
                  ? `${data.products.length} produit${data.products.length > 1 ? 's' : ''} trouvé${data.products.length > 1 ? 's' : ''}`
                  : 'Produits'}
              </h1>
            </div>

            {localLoading ? (
              <div
                className="space-y-4"
                aria-busy="true"
                aria-label="Chargement des produits"
              >
                {[...Array(3)].map((_, index) => (
                  <ProductItemSkeleton key={index} />
                ))}
              </div>
            ) : isArrayEmpty(data?.products) ? (
              <div
                className="flex flex-col items-center justify-center py-10 text-center"
                aria-live="assertive"
                role="status"
              >
                <div className="mb-4 text-5xl text-gray-300">
                  <SearchX />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Aucun produit trouvé
                </h2>
                <p className="text-gray-600 max-w-md">
                  {keyword
                    ? `Aucun résultat pour "${keyword}". Essayez d'autres termes de recherche.`
                    : 'Aucun produit ne correspond aux filtres sélectionnés. Essayez de modifier vos critères.'}
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  aria-label="Voir tous les produits disponibles"
                >
                  Voir tous les produits
                </button>
              </div>
            ) : (
              <>
                <div
                  className="space-y-4"
                  aria-busy={false}
                  aria-label="Liste des produits chargés"
                >
                  {data?.products?.map((product) => (
                    <Suspense
                      key={product?._id || `product-${Math.random()}`}
                      fallback={<ProductItemSkeleton />}
                    >
                      <ProductItem product={product} />
                    </Suspense>
                  ))}
                </div>

                {data?.totalPages > 1 && (
                  <div className="mt-8">
                    <CustomPagination totalPages={data?.totalPages} />
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </section>
  );
};

export default ListProducts;
