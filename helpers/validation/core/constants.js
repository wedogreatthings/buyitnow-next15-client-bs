// helpers/validation/core/constants.js
// Constantes et utilitaires partagés pour toutes les validations

/**
 * Regex communs pour la validation - Optimisés pour la performance
 */
export const REGEX = {
  // Caractères sûrs pour les noms (pré-compilé pour performance)
  SAFE_NAME: /^[a-zA-Z0-9\u00C0-\u017F\s._'-]+$/,

  // Email RFC compliant (version optimisée)
  EMAIL:
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

  // Mot de passe fort (pré-compilé)
  STRONG_PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,

  // Séquences communes
  COMMON_SEQUENCES: /(123456|password|qwerty|abc123)/i,

  // Téléphone international
  PHONE: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/,

  // ObjectId MongoDB (24 caractères hex)
  MONGODB_OBJECTID: /^[0-9a-fA-F]{24}$/,
};

/**
 * Patterns d'injection - Compilés une seule fois pour performance
 */
export const SECURITY_PATTERNS = {
  SQL_INJECTION: [
    /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|UNION)(\s|$)/i,
    /(\s|^)(JOIN|FROM|INTO|WHERE)(\s|$)/i,
    /(\s|^)(--)/,
    /(;)/,
    /('|").*\1.*=/,
    /\/\*/,
    /\*\//,
    /xp_/,
  ],

  NOSQL_INJECTION: [
    /\$/,
    /\{.*:.*\}/,
    /\[.*\]/,
    /\.\.|^\.|\.$/,
    /new\s+Date/,
    /\bfunction\s*\(/,
    /\bObjectId\s*\(/,
    /\bISODate\s*\(/,
  ],
};

/**
 * Listes de mots de passe communs (optimisé avec Set pour performance O(1))
 */
export const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '123456',
  'qwerty',
  'abc123',
  'welcome',
  'admin',
  'letmein',
  'welcome1',
  'monkey',
  '111111',
  '1234567890',
  'azerty',
  'soleil',
  'motdepasse',
]);

/**
 * Utilitaires de validation partagés - Optimisés pour performance
 */
export const validationUtils = {
  /**
   * Test de sécurité SQL injection (cache des résultats)
   */
  noSqlInjection: (() => {
    const cache = new Map();
    return (value) => {
      if (!value) return true;

      // Cache pour éviter de re-tester les mêmes valeurs
      if (cache.has(value)) return cache.get(value);

      const result = !SECURITY_PATTERNS.SQL_INJECTION.some((pattern) =>
        pattern.test(value),
      );
      cache.set(value, result);
      return result;
    };
  })(),

  /**
   * Test de sécurité NoSQL injection (avec cache)
   */
  noNoSqlInjection: (() => {
    const cache = new Map();
    return (value) => {
      if (!value) return true;

      if (cache.has(value)) return cache.get(value);

      const result = !SECURITY_PATTERNS.NOSQL_INJECTION.some((pattern) =>
        pattern.test(value),
      );
      cache.set(value, result);
      return result;
    };
  })(),

  /**
   * Vérification mot de passe commun (O(1) avec Set)
   */
  isNotCommonPassword: (password) => {
    if (!password) return true;
    return !COMMON_PASSWORDS.has(password.toLowerCase());
  },

  /**
   * Vérification informations personnelles dans mot de passe
   */
  passwordContainsPersonalInfo: (password, context) => {
    if (!password || !context?.parent) return true;

    const { name, email } = context.parent;
    const lowercasePassword = password.toLowerCase();

    // Vérifier le nom
    if (
      name &&
      name.length > 3 &&
      lowercasePassword.includes(name.toLowerCase())
    ) {
      return false;
    }

    // Vérifier l'email
    const emailUsername = email ? email.split('@')[0] : '';
    if (
      emailUsername &&
      emailUsername.length > 3 &&
      lowercasePassword.includes(emailUsername.toLowerCase())
    ) {
      return false;
    }

    return true;
  },

  /**
   * Validation ObjectId MongoDB
   */
  isValidObjectId: (value) => {
    if (!value) return false;
    return REGEX.MONGODB_OBJECTID.test(value);
  },

  /**
   * Validation téléphone avec nettoyage
   */
  isValidPhone: (value) => {
    if (!value) return false;
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length >= 6 && cleaned.length <= 15;
  },

  /**
   * Nettoyage et normalisation de chaîne
   */
  sanitizeString: (value) => {
    if (!value) return value;
    return value.trim().replace(/\s+/g, ' ');
  },
};

/**
 * Configuration des champs réutilisables - Lazy evaluation
 */
export const createBaseFields = (yup) => ({
  email: () =>
    yup
      .string()
      .transform(validationUtils.sanitizeString)
      .lowercase()
      .required('Email is required')
      .max(100, 'Email must be at most 100 characters')
      .email('Please enter a valid email address')
      .matches(REGEX.EMAIL, 'Invalid email format')
      .test(
        'no-sql-injection',
        'Invalid email format',
        validationUtils.noSqlInjection,
      )
      .test(
        'no-nosql-injection',
        'Invalid email format',
        validationUtils.noNoSqlInjection,
      ),

  name: () =>
    yup
      .string()
      .transform(validationUtils.sanitizeString)
      .required('Name is required')
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must be at most 50 characters')
      .matches(REGEX.SAFE_NAME, 'Name contains invalid characters')
      .test(
        'no-sql-injection',
        'Name contains invalid characters',
        validationUtils.noSqlInjection,
      )
      .test(
        'no-nosql-injection',
        'Name contains invalid characters',
        validationUtils.noNoSqlInjection,
      ),

  phone: () =>
    yup
      .string()
      .transform(validationUtils.sanitizeString)
      .required('Phone number is required')
      .matches(REGEX.PHONE, 'Invalid phone number format')
      .test(
        'is-valid-phone',
        'Phone number must be valid',
        validationUtils.isValidPhone,
      ),

  password: () =>
    yup
      .string()
      .trim()
      .required('Password is required')
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be at most 100 characters')
      .test(
        'no-whitespace',
        'Password should not contain spaces',
        (value) => !/\s/.test(value),
      )
      .test(
        'no-common-sequences',
        'Password contains common sequences',
        (value) => !REGEX.COMMON_SEQUENCES.test(value),
      )
      .test(
        'not-common-password',
        'Password is too common',
        validationUtils.isNotCommonPassword,
      ),

  objectId: () =>
    yup
      .string()
      .trim()
      .required('ID is required')
      .test(
        'is-valid-object-id',
        'Invalid ID format',
        validationUtils.isValidObjectId,
      ),
});

/**
 * Limites de performance pour éviter les abus
 */
export const PERFORMANCE_LIMITS = {
  MAX_VALIDATION_TIME: 1000, // 1 seconde max
  MAX_STRING_LENGTH: 10000, // 10KB max
  MAX_ARRAY_LENGTH: 1000, // 1000 éléments max
  CACHE_SIZE: 1000, // Taille du cache de validation
};
