/**
 * Schémas de validation pour les adresses
 */

import * as yup from 'yup';
import {
  sanitizeString,
  isValidObjectId,
  validate,
  noNoSqlInjection,
} from '../core/utils';

// Schéma d'adresse
export const addressSchema = yup.object().shape({
  street: yup
    .string()
    .transform(sanitizeString)
    .required('Adresse obligatoire')
    .min(3, 'Minimum 3 caractères')
    .max(100, 'Maximum 100 caractères')
    .matches(/^[a-zA-Z0-9\s,.'°-]+$/, 'Caractères non autorisés')
    .test('no-nosql', 'Format invalide', noNoSqlInjection),

  city: yup
    .string()
    .transform(sanitizeString)
    .required('Ville obligatoire')
    .min(2, 'Minimum 2 caractères')
    .max(50, 'Maximum 50 caractères')
    .matches(/^[a-zA-Z\s'\-\u00C0-\u017F]+$/, 'Caractères non autorisés'),

  state: yup
    .string()
    .transform(sanitizeString)
    .required('Région obligatoire')
    .min(2, 'Minimum 2 caractères')
    .max(50, 'Maximum 50 caractères')
    .matches(/^[a-zA-Z\s'\-\u00C0-\u017F]+$/, 'Caractères non autorisés'),

  zipCode: yup
    .string()
    .nullable()
    .transform((value) => (value === '' ? null : sanitizeString(value)))
    .test('valid-zip', 'Code postal invalide', (value) => {
      if (!value) return true;
      const cleaned = value.replace(/\s/g, '');
      return /^[0-9]{2,5}$/.test(cleaned);
    }),

  additionalInfo: yup
    .string()
    .nullable()
    .transform((value) => (value === '' ? null : sanitizeString(value)))
    .max(100, 'Maximum 100 caractères'),

  country: yup
    .string()
    .transform(sanitizeString)
    .required('Pays obligatoire')
    .min(2, 'Minimum 2 caractères')
    .max(50, 'Maximum 50 caractères')
    .matches(/^[a-zA-Z\s'\-\u00C0-\u017F]+$/, 'Caractères non autorisés'),

  isDefault: yup.boolean().default(false),
});

// Schéma de sélection d'adresse
export const addressSelectionSchema = yup.object().shape({
  selectedAddressId: yup
    .string()
    .required('Sélectionnez une adresse')
    .test('valid-id', 'ID invalide', isValidObjectId),
});

// Fonctions de validation
export const validateAddress = (data) => validate(addressSchema, data);
export const validateAddressSelection = (data) =>
  validate(addressSelectionSchema, data);

// Helpers d'affichage
export const formatAddressDisplay = (address) => {
  if (!address) return '';

  const parts = [
    address.street,
    address.additionalInfo,
    `${address.city}, ${address.state}`,
    address.zipCode,
    address.country,
  ].filter((part) => part && part.trim());

  return parts.join('\n');
};

export const formatAddressShort = (address) => {
  if (!address) return '';

  return `${address.street}, ${address.city}, ${address.state}${
    address.zipCode ? ', ' + address.zipCode : ''
  }, ${address.country}`;
};

export const isAddressComplete = (address) => {
  if (!address) return false;

  return !!(
    address.street?.trim() &&
    address.city?.trim() &&
    address.state?.trim() &&
    address.country?.trim()
  );
};
