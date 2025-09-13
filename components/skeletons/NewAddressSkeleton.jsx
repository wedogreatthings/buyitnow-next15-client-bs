// components/skeletons/NewAddressSkeleton.jsx
'use client';

const NewAddressSkeleton = () => {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row">
          <main className="md:w-2/3 lg:w-3/4 px-4 mx-auto w-full">
            <div
              className="mt-1 mb-8 p-4 md:p-7 mx-auto rounded-lg bg-white shadow-lg animate-pulse"
              style={{ maxWidth: '480px' }}
            >
              {/* Titre du formulaire */}
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-6"></div>

              {/* Champ Rue / Voie */}
              <div className="mb-4">
                <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>

              {/* Champ Complément d'adresse */}
              <div className="mb-4">
                <div className="h-5 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>

              {/* Champ Ville et Région sur la même ligne */}
              <div className="grid md:grid-cols-2 gap-x-3 mb-4">
                <div>
                  <div className="h-5 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </div>
                <div>
                  <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </div>
              </div>

              {/* Champ Code postal et Checkbox sur la même ligne */}
              <div className="grid md:grid-cols-2 gap-x-3 mb-4">
                <div>
                  <div className="h-5 bg-gray-200 rounded w-28 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </div>
                <div className="flex items-center h-full mt-6">
                  <div className="h-5 w-5 bg-gray-200 rounded"></div>
                  <div className="h-5 bg-gray-200 rounded w-32 ml-2"></div>
                </div>
              </div>

              {/* Champ Pays */}
              <div className="mb-6">
                <div className="h-5 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>

              {/* Bouton de soumission */}
              <div className="h-12 bg-gray-200 rounded w-full mt-6"></div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
};

export default NewAddressSkeleton;
