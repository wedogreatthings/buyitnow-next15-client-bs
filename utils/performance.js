/**
 * Utilitaires de performance simplifiés pour e-commerce
 * Optimisé pour ~500 visiteurs/jour
 */

const isBrowser = typeof window !== 'undefined';

/**
 * Cache simple avec expiration
 */
export function memoize(fn, ttlMs = 60000) {
  if (typeof fn !== 'function') {
    throw new Error('memoize: Premier argument doit être une fonction');
  }

  const cache = new Map();
  const timers = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    // Auto-cleanup après TTL
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
    }

    timers.set(
      key,
      setTimeout(() => {
        cache.delete(key);
        timers.delete(key);
      }, ttlMs),
    );

    return result;
  };
}

/**
 * Debounce simple
 */
export function debounce(fn, delay = 300) {
  if (!isBrowser) return fn;

  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle simple
 */
export function throttle(fn, limit = 300) {
  if (!isBrowser) return fn;

  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Préchargement d'images avec loading="lazy" moderne
 */
export function preloadImage(src, lazy = false) {
  if (!isBrowser) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const img = new Image();

    // Support du lazy loading natif (2025 standard)
    if (lazy && 'loading' in img) {
      img.loading = 'lazy';
    }

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Échec chargement: ${src}`));
    img.src = src;
  });
}

/**
 * Précharger plusieurs images (max 2 simultanées pour éviter surcharge réseau)
 */
export async function preloadImages(urls) {
  if (!isBrowser || !urls.length) return [];

  const results = [];

  // Traiter par batch de 2 (optimisé pour e-commerce 2025)
  for (let i = 0; i < urls.length; i += 2) {
    const batch = urls.slice(i, i + 2);
    const batchPromises = batch.map(
      (url) => preloadImage(url).catch(() => null), // Ignorer les erreurs
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((img) => img !== null));
  }

  return results;
}

/**
 * Détection de connexion internet
 */
export function isOnline() {
  if (!isBrowser) return true;
  return navigator.onLine;
}

/**
 * Écouter les changements de connexion
 */
export function onConnectionChange(callback) {
  if (!isBrowser) return;

  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

/**
 * Détection connexion lente (simple)
 */
export function isSlowConnection() {
  if (!isBrowser) return false;

  const connection = navigator.connection;
  if (!connection) return false;

  return (
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g' ||
    (connection.downlink && connection.downlink < 1)
  );
}

/**
 * Préférence mouvement réduit
 */
export function prefersReducedMotion() {
  if (!isBrowser) return false;

  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Utilitaires spécifiques e-commerce
 */

// Cache produits (5 minutes)
export const cacheProduct = memoize(
  (productId) => {
    // Votre fonction fetch produit ici
  },
  5 * 60 * 1000,
);

// Recherche avec debounce (500ms optimisé pour UX e-commerce)
export const debouncedSearch = debounce((query) => {
  // Votre fonction de recherche ici
}, 500);

// Mise à jour panier avec debounce (800ms pour éviter requests excessives)
export const debouncedCartUpdate = debounce((cartData) => {
  // Votre fonction de mise à jour panier ici
}, 800);
