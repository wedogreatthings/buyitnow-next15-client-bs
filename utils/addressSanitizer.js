/**
 * Sanitisation simple des adresses - Complément léger à la validation Yup
 * Adapté pour 500 visiteurs/jour
 */

/**
 * Nettoie une chaîne basique (trim + espaces multiples)
 */
const cleanString = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

/**
 * Nettoie un code postal (garde uniquement alphanumérique et tirets)
 */
const cleanZipCode = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/[^a-zA-Z0-9\-\s]/g, '')
    .trim();
};

/**
 * Sanitise une adresse complète avant validation Yup
 * @param {Object} addressData - Données d'adresse brutes
 * @returns {Object} - Données nettoyées prêtes pour validation Yup
 */
export const sanitizeAddress = (addressData = {}) => {
  if (!addressData || typeof addressData !== 'object') {
    return {};
  }

  return {
    street: cleanString(addressData.street),
    additionalInfo: cleanString(addressData.additionalInfo),
    city: cleanString(addressData.city),
    state: cleanString(addressData.state),
    zipCode: cleanZipCode(addressData.zipCode),
    country: cleanString(addressData.country),
    isDefault: Boolean(addressData.isDefault),
  };
};

/**
 * Vérifie rapidement si les champs requis sont présents
 * (Utilisé pour validation côté client avant envoi)
 */
export const hasRequiredFields = (address) => {
  return !!(
    address?.street &&
    address?.city &&
    address?.state &&
    address?.country
  );
};

/**
 * Formate une adresse pour l'affichage
 */
export const formatAddressDisplay = (address) => {
  if (!address) return '';

  const parts = [
    address.street,
    address.additionalInfo,
    `${address.city}, ${address.state}`,
    address.zipCode,
    address.country,
  ].filter(Boolean);

  return parts.join('\n');
};

/**
 * Formate une adresse en une ligne
 */
export const formatAddressOneLine = (address) => {
  if (!address) return '';

  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean);

  return parts.join(', ');
};

export default {
  sanitizeAddress,
  hasRequiredFields,
  formatAddressDisplay,
  formatAddressOneLine,
};
