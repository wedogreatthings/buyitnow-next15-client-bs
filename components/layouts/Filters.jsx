'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { getPriceQueryParams, isArrayEmpty } from '@/helpers/helpers';
import { ChevronDown, ChevronUp } from 'lucide-react';

const Filters = ({ categories, setLocalLoading }) => {
  console.log('Filters categories prop:', categories);
  const router = useRouter();
  const searchParams = useSearchParams();

  // État local synchronisé avec les paramètres d'URL
  const [min, setMin] = useState(() => searchParams?.get('min') || '');
  const [max, setMax] = useState(() => searchParams?.get('max') || '');
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mémoiser la valeur de catégorie actuelle
  const currentCategory = useMemo(
    () => searchParams?.get('category') || '',
    [searchParams],
  );

  // Synchroniser les états avec les paramètres d'URL
  useEffect(() => {
    setMin(searchParams?.get('min') || '');
    setMax(searchParams?.get('max') || '');
  }, [searchParams]);

  // Validation des prix mémorisée
  const validatePrices = useCallback(async () => {
    if (min === '' && max === '') {
      throw new Error(
        'Veuillez renseigner au moins un des deux champs de prix',
      );
    }

    if (min !== '' && max !== '') {
      // Conversion sécurisée en nombres
      const minNum = Number(min);
      const maxNum = Number(max);

      if (isNaN(minNum) || isNaN(maxNum)) {
        throw new Error('Les valeurs de prix doivent être des nombres valides');
      }

      if (minNum > maxNum) {
        throw new Error('Le prix minimum doit être inférieur au prix maximum');
      }
    }
  }, [min, max]);

  // Gestionnaire de clic sur catégorie
  const handleCategoryClick = useCallback(
    (categoryId) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      setLocalLoading(true);

      try {
        // Création d'une nouvelle instance de URLSearchParams
        const params = new URLSearchParams(searchParams?.toString() || '');

        // Logique de basculement: si la catégorie est déjà sélectionnée, la désélectionner
        if (params.get('category') === categoryId) {
          params.delete('category');
        } else {
          params.set('category', categoryId);
        }

        // Navigation vers la nouvelle URL
        const path = `/?${params.toString()}`;
        setOpen(false);
        setIsSubmitting(false);
        setLocalLoading(false);
        router.push(path);
      } catch (error) {
        console.error('Erreur lors de la sélection de catégorie:', error);
        toast.error('Une erreur est survenue lors du filtrage par catégorie');
        setLocalLoading(false);
        setIsSubmitting(false);
      }
    },
    [searchParams],
  );

  // Gestionnaire pour appliquer les filtres de prix
  const handlePriceFilter = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLocalLoading(true);

    try {
      // Validation des prix
      await validatePrices();

      // Création des paramètres d'URL
      let params = new URLSearchParams(searchParams?.toString() || '');

      // Par celles-ci:
      params = getPriceQueryParams(params, 'min', min);
      params = getPriceQueryParams(params, 'max', max);

      // Navigation
      const path = `/?${params.toString()}`;
      setOpen(false);
      setIsSubmitting(false);
      setLocalLoading(false);
      router.push(path);
    } catch (error) {
      toast.error(
        error.message || 'Une erreur est survenue avec les filtres de prix',
      );
      setLocalLoading(false);
      setIsSubmitting(false);
    }
  }, [min, max, searchParams]);

  // Réinitialiser les filtres
  const resetFilters = useCallback(() => {
    setIsSubmitting(true);
    setLocalLoading(true);
    setMin('');
    setMax('');
    router.push('/');
    setOpen(false);
  }, []);

  // Vérifier si des filtres sont actifs
  const hasActiveFilters = useMemo(() => {
    return min || max || currentCategory;
  }, [min, max, currentCategory]);

  return (
    <aside className="md:w-1/3 lg:w-1/4 px-4">
      <div className="sticky top-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 hidden md:block">
            Filtres
          </h2>

          <button
            className="md:hidden w-full mb-4 py-2 px-4 bg-white border border-gray-200 rounded-md shadow-sm flex justify-between items-center"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="filter-panel"
          >
            <span className="font-medium text-gray-700">Filtres</span>
            {open ? (
              <ChevronUp className="text-gray-500" />
            ) : (
              <ChevronDown className="text-gray-500" />
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 hidden md:block"
              aria-label="Réinitialiser tous les filtres"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div
          id="filter-panel"
          className={`${open ? 'block' : 'hidden'} md:block space-y-4`}
        >
          {/* Prix */}
          <div className="p-4 border border-gray-200 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3 text-gray-700">Prix (€)</h3>
            <div className="grid grid-cols-2 gap-x-2 mb-3">
              <div>
                <label
                  htmlFor="min-price"
                  className="text-xs text-gray-500 mb-1 block"
                >
                  Min
                </label>
                <input
                  id="min-price"
                  name="min"
                  className="appearance-none border border-gray-200 bg-gray-100 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:border-blue-500 w-full"
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                  aria-label="Prix minimum"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label
                  htmlFor="max-price"
                  className="text-xs text-gray-500 mb-1 block"
                >
                  Max
                </label>
                <input
                  id="max-price"
                  name="max"
                  className="appearance-none border border-gray-200 bg-gray-100 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:border-blue-500 w-full"
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  aria-label="Prix maximum"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              className={`w-full py-2 px-4 ${
                isSubmitting
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white cursor-pointer rounded-md transition-colors`}
              onClick={handlePriceFilter}
              aria-label="Appliquer les filtres de prix"
              disabled={isSubmitting}
            >
              Appliquer
            </button>
          </div>

          {/* Catégories */}
          <div className="p-4 border border-gray-200 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3 text-gray-700">Catégories</h3>

            {isArrayEmpty(categories) ? (
              <div className="w-full text-center py-2">
                <p className="text-gray-500">Aucune catégorie disponible</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {categories?.map((category) => (
                  <button
                    key={category?._id}
                    className={`flex items-center w-full p-2 rounded-md transition-colors cursor-pointer ${
                      currentCategory === category?._id
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => handleCategoryClick(category?._id)}
                    aria-pressed={currentCategory === category?._id}
                    disabled={isSubmitting}
                  >
                    <span className="ml-2">{category?.categoryName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bouton réinitialiser mobile */}
          {hasActiveFilters && (
            <div className="md:hidden">
              <button
                onClick={resetFilters}
                className="w-full py-2 text-center text-sm text-red-600 hover:text-red-800 border border-red-200 cursor-pointer rounded-md hover:bg-red-50"
                aria-label="Réinitialiser tous les filtres"
                disabled={isSubmitting}
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Filters;
