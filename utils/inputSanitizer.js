/**
 * Sanitisation simple des entrées - Complément minimal à Yup
 * Adapté pour 500 visiteurs/jour
 */

/**
 * Nettoie une chaîne basique (trim + espaces multiples)
 * PAS d'encodage HTML - React le fait automatiquement
 */
export const cleanString = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

/**
 * Parse un nombre de manière sûre
 */
export const parseNumber = (value, defaultValue = null) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

/**
 * Parse un booléen
 */
export const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', 'on', '1', 'yes'].includes(value.toLowerCase().trim());
  }
  return Boolean(value);
};

/**
 * Vérifie un ObjectId MongoDB (format seulement)
 */
export const isValidObjectId = (value) => {
  if (!value) return false;
  return /^[0-9a-fA-F]{24}$/.test(String(value).trim());
};

/**
 * Parse les paramètres de recherche produits
 * Simple extraction sans sur-sanitisation
 */
export const parseProductSearchParams = (searchParams) => {
  const params = {};

  // Keyword - juste un trim
  const keyword = searchParams.get('keyword');
  if (keyword) {
    params.keyword = cleanString(keyword);
  }

  // Category - vérifier si c'est un ObjectId valide
  const category = searchParams.get('category');
  if (category && isValidObjectId(category)) {
    params.category = category.trim();
  }

  // Prix min/max - parser en nombre
  const minPrice = searchParams.get('min') || searchParams.get('price[gt]');
  if (minPrice) {
    const min = parseNumber(minPrice);
    if (min !== null && min >= 0) {
      params['price[gt]'] = min;
    }
  }

  const maxPrice = searchParams.get('max') || searchParams.get('price[lt]');
  if (maxPrice) {
    const max = parseNumber(maxPrice);
    if (max !== null && max >= 0) {
      params['price[lt]'] = max;
    }
  }

  // Page - avec défaut à 1
  const page = parseNumber(searchParams.get('page'), 1);
  params.page = Math.max(1, Math.min(page, 1000));

  return params;
};

/**
 * Construit des paramètres d'URL propres
 */
export const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, value);
    }
  });

  return searchParams.toString();
};

/**
 * Nettoie les données de formulaire avant validation Yup
 * Utiliser UNIQUEMENT pour les formulaires, pas pour les API
 */
export const cleanFormData = (data) => {
  const cleaned = {};

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string') {
      cleaned[key] = cleanString(value);
    } else {
      cleaned[key] = value;
    }
  });

  return cleaned;
};

export default {
  cleanString,
  parseNumber,
  parseBoolean,
  isValidObjectId,
  parseProductSearchParams,
  buildQueryString,
  cleanFormData,
};
