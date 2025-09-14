/**
 * Helpers utilitaires pour l'application e-commerce
 * Version simplifiée pour 500 visiteurs/jour
 */

// Vérifie si un tableau est vide
export const isArrayEmpty = (array) => {
  return !Array.isArray(array) || array.length === 0;
};

// Formate un prix avec devise
export const formatPrice = (value, currency = '$', decimals = 2) => {
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const amount = isNaN(numValue) ? 0 : numValue;
  return `${currency} ${amount.toFixed(decimals)}`;
};

// Tronque une chaîne
export const truncateString = (str, length = 50) => {
  if (!str || typeof str !== 'string') return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
};

// Génère un ID unique
export const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Formate une date
export const formatDate = (date, options = {}, locale = 'fr-FR') => {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) return '';

  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
};

// Debounce simple pour les recherches
export const debounce = (func, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

// Vérifie si un objet est vide
export const isEmptyObject = (obj) => {
  if (!obj || typeof obj !== 'object') return true;
  return Object.keys(obj).length === 0;
};

// Récupère une valeur imbriquée de manière sécurisée
export const getNestedValue = (obj, path, defaultValue = null) => {
  if (!obj || !path) return defaultValue;

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return result === undefined ? defaultValue : result;
};

// Convertit un objet en query string
export const objectToQueryString = (params) => {
  if (!params || typeof params !== 'object') return '';

  return Object.entries(params)
    .filter(
      ([_, value]) => value !== undefined && value !== null && value !== '',
    )
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value
          .map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
          .join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
};

// Met en majuscule la première lettre
export const capitalizeFirstLetter = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Retourne une valeur sécurisée (évite undefined/null)
export const safeValue = (value, defaultValue = '') => {
  return value === undefined || value === null ? defaultValue : value;
};

// Gestion des paramètres de prix pour les URLs
export const getPriceQueryParams = (queryParams, key, value) => {
  const hasValueInParam = queryParams.has(key);

  if (value && hasValueInParam) {
    queryParams.set(key, value);
  } else if (value) {
    queryParams.append(key, value);
  } else if (hasValueInParam) {
    queryParams.delete(key);
  }
  return queryParams;
};

// Nom du cookie selon l'environnement
export const getCookieName = () => {
  let cookieName = '';

  if (process.env.NODE_ENV === 'development') {
    cookieName = 'next-auth.session-token';
  }

  if (process.env.NODE_ENV === 'production') {
    cookieName = '__Secure-next-auth.session-token';
  }

  return cookieName;
};

// Parse l'URL de callback
export const parseCallbackUrl = (url) => {
  const res = url.replace(/%3A/g, ':').replace(/%2F/g, '/');
  return res;
};
