// components/skeletons/ListProductsSkeleton.jsx
'use client';

export const ProductItemSkeleton = () => (
  <div className="border border-gray-200 overflow-hidden bg-white rounded-sm mb-5 animate-pulse">
    <div className="flex flex-col md:flex-row">
      {/* Image */}
      <div className="md:w-1/4 flex p-3">
        <div className="relative w-full aspect-square bg-gray-200 rounded-md"></div>
      </div>

      {/* Info centrale */}
      <div className="md:w-2/4">
        <div className="p-4">
          {/* Titre */}
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>

          {/* Détails */}
          <div className="mt-4 space-y-3">
            <div className="flex">
              <div className="h-4 bg-gray-200 rounded w-20 mr-3"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="flex">
              <div className="h-4 bg-gray-200 rounded w-20 mr-3"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="flex">
              <div className="h-4 bg-gray-200 rounded w-20 mr-3"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Prix et bouton */}
      <div className="md:w-1/4 border-t lg:border-t-0 lg:border-l border-gray-200">
        <div className="p-5 flex flex-col items-center md:items-start">
          <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    </div>
  </div>
);

export const FiltersSkeleton = () => (
  <aside className="md:w-1/3 lg:w-1/4 px-4">
    <div className="sticky top-20">
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 bg-gray-200 rounded w-20 hidden md:block"></div>
      </div>

      <div className="space-y-4">
        {/* Prix */}
        <div className="p-4 border border-gray-200 bg-white rounded-lg shadow-sm animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-20 mb-4"></div>
          <div className="grid grid-cols-2 gap-x-2 mb-3">
            <div>
              <div className="h-4 bg-gray-200 rounded w-10 mb-1"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-10 mb-1"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>

        {/* Catégories */}
        <div className="p-4 border border-gray-200 bg-white rounded-lg shadow-sm animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-24 mb-4"></div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-8 bg-gray-200 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </aside>
);

const ListProductsSkeleton = () => {
  return (
    <section className="py-8">
      <div className="container max-w-[1440px] mx-auto px-4">
        <div className="flex flex-col md:flex-row -mx-4">
          {/* Filtres */}
          <FiltersSkeleton />

          {/* Produits */}
          <main className="md:w-2/3 lg:w-3/4 px-3">
            {/* Titre */}
            <div className="mb-4 flex justify-between items-center">
              <div className="h-6 bg-gray-200 rounded w-40 animate-pulse"></div>
            </div>

            {/* Liste des produits */}
            <div
              className="space-y-4"
              aria-busy="true"
              aria-label="Chargement des produits"
            >
              {[...Array(3)].map((_, index) => (
                <ProductItemSkeleton key={index} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex justify-center">
              <div className="flex space-x-2 animate-pulse">
                {[...Array(5)].map((_, index) => (
                  <div
                    key={index}
                    className="h-10 w-10 bg-gray-200 rounded"
                  ></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
};

export default ListProductsSkeleton;
