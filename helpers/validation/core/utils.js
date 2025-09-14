/**
 * Utilitaires de validation simplifiés
 * Adapté pour 500 visiteurs/jour
 */

import * as yup from 'yup';

// Regex communs
export const REGEX = {
  SAFE_NAME: /^[a-zA-Z0-9\u00C0-\u017F\s._'-]+$/,
  EMAIL:
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  STRONG_PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
  PHONE: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/,
  MONGODB_OBJECTID: /^[0-9a-fA-F]{24}$/,
  DJIBOUTI_PHONE: /^77[0-9]{6}$/,
};

// Mots de passe communs à éviter
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

// Nettoie et normalise une chaîne
export const sanitizeString = (value) => {
  if (!value) return value;
  return value.trim().replace(/\s+/g, ' ');
};

// Validation ObjectId MongoDB
export const isValidObjectId = (value) => {
  if (!value) return false;
  return REGEX.MONGODB_OBJECTID.test(value);
};

// Validation téléphone
export const isValidPhone = (value) => {
  if (!value) return false;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length >= 6 && cleaned.length <= 15;
};

// Validation téléphone djiboutien
export const isValidDjiboutiPhone = (phone) => {
  if (!phone) return false;
  const cleaned = phone.replace(/\s|-/g, '');
  return REGEX.DJIBOUTI_PHONE.test(cleaned);
};

// Vérification mot de passe commun
export const isNotCommonPassword = (password) => {
  if (!password) return true;
  return !COMMON_PASSWORDS.has(password.toLowerCase());
};

// Vérification informations personnelles dans mot de passe
export const passwordContainsPersonalInfo = (password, context) => {
  if (!password || !context?.parent) return true;

  const { name, email } = context.parent;
  const lowercasePassword = password.toLowerCase();

  if (
    name &&
    name.length > 3 &&
    lowercasePassword.includes(name.toLowerCase())
  ) {
    return false;
  }

  const emailUsername = email ? email.split('@')[0] : '';
  if (
    emailUsername &&
    emailUsername.length > 3 &&
    lowercasePassword.includes(emailUsername.toLowerCase())
  ) {
    return false;
  }

  return true;
};

// Protection basique contre l'injection NoSQL
export const noNoSqlInjection = (value) => {
  if (!value) return true;
  // Vérifie seulement les patterns MongoDB dangereux
  return !/(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$exists)/.test(
    value,
  );
};

/**
 * Validation principale avec gestion d'erreur simplifiée
 */
export const validate = async (schema, data, options = {}) => {
  try {
    const result = await schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      ...options,
    });

    return {
      isValid: true,
      data: result,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: formatValidationErrors(error),
    };
  }
};

/**
 * Formate les erreurs de validation
 */
export const formatValidationErrors = (error) => {
  const formattedErrors = {};

  if (error.inner?.length) {
    error.inner.forEach((err) => {
      formattedErrors[err.path] = err.message;
    });
  } else if (error.path && error.message) {
    formattedErrors[error.path] = error.message;
  } else {
    formattedErrors.general = error.message || 'Erreur de validation inconnue';
  }

  return formattedErrors;
};

/**
 * Champs de base réutilisables
 */
export const createBaseFields = () => ({
  email: yup
    .string()
    .transform(sanitizeString)
    .lowercase()
    .required('Email requis')
    .max(100, 'Email trop long')
    .email('Format email invalide')
    .matches(REGEX.EMAIL, 'Format email invalide')
    .test('no-nosql', 'Format invalide', noNoSqlInjection),

  name: yup
    .string()
    .transform(sanitizeString)
    .required('Nom requis')
    .min(2, 'Nom trop court')
    .max(50, 'Nom trop long')
    .matches(REGEX.SAFE_NAME, 'Caractères non autorisés')
    .test('no-nosql', 'Format invalide', noNoSqlInjection),

  phone: yup
    .string()
    .transform(sanitizeString)
    .required('Téléphone requis')
    .matches(REGEX.PHONE, 'Format téléphone invalide')
    .test('valid-phone', 'Téléphone invalide', isValidPhone),

  password: yup
    .string()
    .trim()
    .required('Mot de passe requis')
    .min(8, 'Minimum 8 caractères')
    .max(100, 'Maximum 100 caractères')
    .test('no-spaces', "Pas d'espaces autorisés", (val) => !/\s/.test(val))
    .test('not-common', 'Mot de passe trop commun', isNotCommonPassword),

  objectId: yup
    .string()
    .trim()
    .required('ID requis')
    .test('valid-id', 'Format ID invalide', isValidObjectId),
});
