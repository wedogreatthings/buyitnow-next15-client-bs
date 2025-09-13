// app/product/[id]/loading.jsx

export default function ProductLoading() {
  return (
    <div
      className="container mx-auto py-8 px-4"
      aria-busy="true"
      aria-label="Chargement du produit"
    >
      <div className="max-w-7xl mx-auto">
        {/* En-tête du produit avec breadcrumb animé */}
        <div className="animate-pulse mb-6">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-1/2"></div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Image principale du produit */}
          <div className="md:w-1/2">
            <div className="aspect-w-1 aspect-h-1 w-full rounded-lg bg-gray-200 animate-pulse overflow-hidden"></div>

            {/* Miniatures des images */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-w-1 aspect-h-1 rounded bg-gray-200 animate-pulse"
                ></div>
              ))}
            </div>
          </div>

          {/* Détails du produit */}
          <div className="md:w-1/2 flex flex-col space-y-4">
            {/* Prix et disponibilité */}
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>

            {/* Description courte */}
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>

            {/* Options du produit */}
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="flex space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full bg-gray-200"
                  ></div>
                ))}
              </div>
            </div>

            {/* Quantité et bouton d'ajout au panier */}
            <div className="animate-pulse space-y-4 pt-4">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="flex space-x-2">
                <div className="h-12 bg-gray-200 rounded w-1/5"></div>
                <div className="h-12 bg-gray-300 rounded w-4/5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Onglets de description et détails */}
        <div className="mt-12 animate-pulse">
          <div className="flex space-x-4 border-b border-gray-200 mb-4">
            <div className="h-8 bg-gray-300 rounded w-24"></div>
            <div className="h-8 bg-gray-200 rounded w-24"></div>
            <div className="h-8 bg-gray-200 rounded w-24"></div>
          </div>

          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>

        {/* Produits similaires */}
        <div className="mt-16 animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/3 mb-6"></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-w-1 aspect-h-1 rounded bg-gray-200"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-5 bg-gray-300 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
