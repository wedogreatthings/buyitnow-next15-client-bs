'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
// import { searchSchema } from '@/helpers/schemas';

// Fonction de debounce pour limiter les requêtes
const useDebounce = (fn, delay) => {
  const timeoutRef = useRef(null);

  return useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay],
  );
};

const Search = ({ setLoading }) => {
  const [keyword, setKeyword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const inputRef = useRef(null);

  // Fonction pour modifier le keyword avec validation basique
  const handleKeywordChange = useCallback((e) => {
    const value = e.target.value;
    setKeyword(value);
  }, []);

  // Validation et soumission debounce
  const submitHandler = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      // Éviter les soumissions multiples
      if (isSubmitting) return;
      setIsSubmitting(true);
      setLoading?.(true);

      try {
        // Vérification simple avant validation
        if (!keyword || keyword.trim() === '') {
          toast.error('Veuillez entrer un terme de recherche');
          setLoading?.(false);
          setIsSubmitting(false);
          return;
        }

        // Validation avec le schéma Yup
        // await searchSchema.validate({ keyword }, { abortEarly: false });

        // Navigation vers la page de résultats
        router.push(`/?keyword=${encodeURIComponent(keyword.trim())}`);
      } catch (error) {
        // Gestion d'erreur améliorée
        if (error.inner && error.inner.length) {
          // Afficher toutes les erreurs de validation
          error.inner.forEach((err) => {
            toast.error(err.message);
          });
        } else {
          // Afficher une erreur générique plus conviviale
          toast.error(
            error.message || 'Une erreur est survenue lors de la recherche',
          );
        }

        setLoading?.(false);
        setIsSubmitting(false);
      }
    },
    [keyword],
  );

  // Soumettre sur appui de la touche Entrée avec debounce
  const debouncedSubmit = useDebounce(submitHandler, 300);

  // Gérer l'appui sur la touche Entrée
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        debouncedSubmit(e); // Utiliser debouncedSubmit au lieu de submitHandler
      }
    },
    [debouncedSubmit],
  );

  return (
    <form
      className="flex flex-nowrap items-center w-full order-last md:order-none mt-5 md:mt-0 md:w-1/3 lg:w-2/4"
      onSubmit={(e) => {
        e.preventDefault();
        debouncedSubmit(e);
      }}
      role="search"
      aria-label="Rechercher des produits"
    >
      <input
        ref={inputRef}
        className="grow appearance-none border border-gray-200 bg-gray-100 rounded-md mr-2 py-2 px-3 hover:border-gray-400 focus:outline-none focus:border-blue-500"
        type="search"
        placeholder="Rechercher un produit..."
        value={keyword}
        onChange={handleKeywordChange}
        onKeyDown={handleKeyDown}
        aria-label="Terme de recherche"
        disabled={isSubmitting}
        required
      />
      <button
        type="button"
        className={`px-4 py-2 inline-block border border-transparent ${
          isSubmitting
            ? 'bg-blue-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white rounded-md transition-colors`}
        onClick={debouncedSubmit} // Utiliser debouncedSubmit ici
        disabled={isSubmitting}
        aria-label="Lancer la recherche"
      >
        {isSubmitting ? 'Recherche...' : 'Rechercher'}
      </button>
    </form>
  );
};

export default Search;
