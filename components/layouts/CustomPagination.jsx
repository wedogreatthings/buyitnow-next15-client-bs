'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import ResponsivePaginationComponent from 'react-responsive-pagination';
import 'react-responsive-pagination/themes/classic.css';

const CustomPagination = memo(({ totalPages = 1 }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // Calculer le numéro de page actuel de manière sécurisée
  const getCurrentPage = useCallback(() => {
    const pageParam = searchParams?.get('page');
    if (!pageParam) return 1;

    const parsedPage = parseInt(pageParam, 10);

    // Vérifier si parsedPage est un nombre valide
    if (isNaN(parsedPage) || parsedPage < 1) {
      return 1;
    }

    // Limiter à totalPages
    return Math.min(parsedPage, Math.max(1, totalPages));
  }, [searchParams, totalPages]);

  // Page courante
  const currentPage = getCurrentPage();

  // Réinitialiser l'état de navigation si l'URL change
  useEffect(() => {
    if (isNavigating) {
      setIsNavigating(false);
    }
  }, [searchParams]);

  // Gestion du changement de page avec feedback visuel
  const handlePageChange = useCallback(
    (newPage) => {
      // Éviter les actions pendant la navigation
      if (isNavigating) return;

      // Éviter les requêtes inutiles pour la même page
      if (newPage === currentPage) return;

      // Marquer comme en cours de navigation
      setIsNavigating(true);

      try {
        // Créer une nouvelle instance de searchParams pour éviter les mutations
        const params = new URLSearchParams(searchParams?.toString() || '');

        if (newPage === 1) {
          // Supprimer le paramètre pour la page 1 (plus propre dans l'URL)
          params.delete('page');
        } else {
          params.set('page', newPage.toString());
        }

        // Construire le chemin
        const query = params.toString();
        const path = query ? `${pathname}?${query}` : pathname;

        // Naviguer
        router.push(path);

        // Scroll en haut de page pour une meilleure UX
        if (typeof window !== 'undefined') {
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      } catch (error) {
        // Gérer l'erreur et réinitialiser l'état
        console.error('Erreur de navigation:', error);
        setIsNavigating(false);
      }
    },
    [currentPage, searchParams, pathname, router, isNavigating],
  );

  // Ne pas afficher la pagination s'il n'y a qu'une seule page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex mt-8 justify-center" aria-live="polite">
      {isNavigating ? (
        <div className="flex items-center space-x-2 text-gray-600">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Chargement de la page {currentPage}...</span>
        </div>
      ) : (
        <ResponsivePaginationComponent
          current={currentPage}
          total={totalPages}
          onPageChange={handlePageChange}
          maxWidth={300}
          ariaPreviousLabel="Page précédente"
          ariaNextLabel="Page suivante"
          previousLabel="«"
          nextLabel="»"
        />
      )}
    </div>
  );
});

CustomPagination.displayName = 'CustomPagination';

export default CustomPagination;

// <div className="flex mt-20 justify-center"></div>
