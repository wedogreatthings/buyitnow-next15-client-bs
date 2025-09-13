/**
 * Système de cache simple pour e-commerce (~500 visiteurs/jour)
 * Sans dépendances externes
 */

// Configuration simple des durées de cache (en millisecondes)
export const CACHE_DURATIONS = {
  products: 10 * 60 * 1000, // 10 minutes
  singleProduct: 15 * 60 * 1000, // 15 minutes
  categories: 30 * 60 * 1000, // 30 minutes
  cart: 5 * 60 * 1000, // 5 minutes
  user: 5 * 60 * 1000, // 5 minutes
  staticPages: 60 * 60 * 1000, // 1 heure
};

/**
 * Cache simple en mémoire avec expiration automatique
 */
class SimpleCache {
  constructor(name = 'cache', maxSize = 100) {
    this.name = name;
    this.maxSize = maxSize;
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Récupérer une valeur du cache
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * Stocker une valeur dans le cache
   */
  set(key, value, ttl = 300000) {
    // 5min par défaut
    // Protection contre les fuites mémoire (bonne pratique 2025)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Supprimer 10% du cache pour éviter l'effet yo-yo
      const keysToDelete = Math.ceil(this.maxSize * 0.1);
      const keys = Array.from(this.cache.keys()).slice(0, keysToDelete);
      keys.forEach((k) => this.delete(k));
    }

    // Supprimer ancien timer si existe
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Stocker la valeur
    this.cache.set(key, value);

    // Programmer la suppression automatique
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);

    return true;
  }

  /**
   * Supprimer une valeur
   */
  delete(key) {
    // Nettoyer le timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    return this.cache.delete(key);
  }

  /**
   * Vider tout le cache
   */
  clear() {
    // Nettoyer tous les timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Taille du cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Récupérer ou définir (get or set)
   */
  async getOrSet(key, fetchFn, ttl) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fetchFn();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Supprimer par pattern simple
   */
  deletePattern(pattern) {
    const keys = Array.from(this.cache.keys());
    const regex = new RegExp(pattern);
    let deleted = 0;

    for (const key of keys) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }

    return deleted;
  }
}

// Instances de cache pour l'application (tailles adaptées à 500 visiteurs/jour)
export const appCache = {
  products: new SimpleCache('products', 30), // 30 produits max (optimisé)
  categories: new SimpleCache('categories', 15), // 15 catégories max
  users: new SimpleCache('users', 25), // 25 utilisateurs max (concurrence réaliste)
  cart: new SimpleCache('cart', 25), // 25 paniers max
  static: new SimpleCache('static', 10), // 10 pages statiques max
};

/**
 * Générer une clé de cache simple
 */
export function getCacheKey(prefix, params = {}) {
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return `${prefix}:${paramStr || 'default'}`;
}

/**
 * Headers de cache pour Next.js (simplifié)
 */
export function getCacheHeaders(resourceType) {
  const durations = {
    products: 600, // 10 minutes
    categories: 1800, // 30 minutes
    staticPages: 3600, // 1 heure
    staticAssets: 86400, // 1 jour
  };

  const maxAge = durations[resourceType] || durations.staticPages;

  return {
    'Cache-Control': `max-age=${maxAge}, stale-while-revalidate=${Math.floor(maxAge / 2)}`,
  };
}

/**
 * Fonction de cache avec memoization simple
 */
export function createCachedFunction(
  fn,
  cacheName,
  ttl = CACHE_DURATIONS.products,
) {
  const cache = new SimpleCache(cacheName, 50);

  return async function (...args) {
    const key = JSON.stringify(args);
    return cache.getOrSet(key, () => fn.apply(this, args), ttl);
  };
}

/**
 * Utilitaires pour e-commerce
 */

// Cache produit par ID
export const getCachedProduct = createCachedFunction(
  async (productId) => {
    // Votre fonction fetch produit ici
    // return await fetchProduct(productId);
  },
  'product-by-id',
  CACHE_DURATIONS.singleProduct,
);

// Cache catégories
export const getCachedCategories = createCachedFunction(
  async () => {
    // Votre fonction fetch catégories ici
    // return await fetchCategories();
  },
  'categories',
  CACHE_DURATIONS.categories,
);

// Invalidation du cache produit quand modifié
export function invalidateProduct(productId) {
  appCache.products.deletePattern(`.*${productId}.*`);
}

// Invalidation du cache utilisateur
export function invalidateUser(userId) {
  appCache.users.deletePattern(`.*${userId}.*`);
  appCache.cart.deletePattern(`.*${userId}.*`);
}

// Nettoyage à la fermeture (optionnel)
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', () => {
    Object.values(appCache).forEach((cache) => cache.clear());
  });
}
