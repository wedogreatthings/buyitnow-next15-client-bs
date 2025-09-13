/**
 * Sanitisation simple pour l'authentification
 * Complément léger à la validation Yup existante
 */

/**
 * Nettoie un email (trim + lowercase)
 * La validation complète est faite par Yup
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

/**
 * Nettoie un nom (trim + espaces multiples)
 * La validation complète est faite par Yup
 */
export const sanitizeName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
};

/**
 * Nettoie un téléphone (garde que les chiffres et +)
 * La validation complète est faite par Yup
 */
export const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';

  const trimmed = phone.trim();
  // Garder le + du début si présent, puis que les chiffres
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.substring(1).replace(/\D/g, '');
  }
  return trimmed.replace(/\D/g, '');
};

/**
 * NE PAS sanitiser les mots de passe !
 * Les espaces et caractères spéciaux peuvent être voulus
 */
export const sanitizePassword = (password) => {
  // Retourner tel quel - la validation est faite par Yup
  return password || '';
};

/**
 * Sanitise les données de connexion
 */
export const sanitizeLoginData = (data = {}) => {
  return {
    email: sanitizeEmail(data.email),
    password: sanitizePassword(data.password),
  };
};

/**
 * Sanitise les données d'inscription
 */
export const sanitizeRegisterData = (data = {}) => {
  return {
    name: sanitizeName(data.name),
    email: sanitizeEmail(data.email),
    phone: sanitizePhone(data.phone),
    password: sanitizePassword(data.password),
  };
};

/**
 * Sanitise les données de profil
 */
export const sanitizeProfileData = (data = {}) => {
  return {
    name: sanitizeName(data.name),
    phone: sanitizePhone(data.phone),
  };
};

export default {
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
  sanitizeLoginData,
  sanitizeRegisterData,
  sanitizeProfileData,
};
