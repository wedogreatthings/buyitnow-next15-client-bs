/**
 * Schémas de validation pour les paiements djiboutiens
 */

import * as yup from 'yup';
import { sanitizeString, validate } from '../core/utils';

// Plateformes de paiement supportées
export const SUPPORTED_PLATFORMS = ['waafi', 'cac-pay', 'bci-pay', 'd-money'];

// Noms d'affichage
const PLATFORM_NAMES = {
  waafi: 'WAAFI',
  'cac-pay': 'CAC-PAY',
  'bci-pay': 'BCI-PAY',
  'd-money': 'D-MONEY',
};

// Schéma de paiement djiboutien
export const djiboutiPaymentSchema = yup.object().shape({
  paymentPlatform: yup
    .string()
    .required('Sélectionnez une plateforme')
    .oneOf(SUPPORTED_PLATFORMS, 'Plateforme non supportée'),

  accountHolderName: yup
    .string()
    .transform(sanitizeString)
    .required('Nom complet requis')
    .min(3, 'Minimum 3 caractères')
    .max(100, 'Maximum 100 caractères')
    .matches(/^[a-zA-Z\u00C0-\u017F\s'-]+$/, 'Caractères non autorisés')
    .test('full-name', 'Prénom et nom requis', (value) => {
      if (!value) return true;
      const words = value.trim().split(/\s+/);
      return words.length >= 2 && words.every((word) => word.length >= 2);
    }),

  phoneNumber: yup
    .string()
    .transform((value) => (value ? value.replace(/\s|-/g, '') : value))
    .required('Téléphone requis')
    .matches(/^77[0-9]{6}$/, 'Format: 77XXXXXX (8 chiffres)')
    .test('not-simple', 'Numéro invalide', (value) => {
      if (!value) return true;
      return !/(77000000|77111111|77123456|77654321)/.test(value);
    }),
});

// Schéma de facture simple
export const simpleInvoiceSchema = yup.object().shape({
  amount: yup
    .number()
    .required('Montant requis')
    .positive('Montant doit être positif')
    .max(999999, 'Montant trop élevé'),

  currency: yup
    .string()
    .required('Devise requise')
    .oneOf(['DJF', 'USD'], 'Devise non supportée'),

  description: yup.string().nullable().max(200, 'Description trop longue'),
});

// Helpers
export const getPlatformName = (platform) => {
  return PLATFORM_NAMES[platform] || platform.toUpperCase();
};

export const getPlatformOptions = () => {
  return SUPPORTED_PLATFORMS.map((platform) => ({
    value: platform,
    label: getPlatformName(platform),
  }));
};

export const formatDjiboutiPhone = (phone) => {
  if (!phone || phone.length !== 8) return phone;
  return `+253 ${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 8)}`;
};

// Fonctions de validation
export const validateDjiboutiPayment = async (data) => {
  const result = await validate(djiboutiPaymentSchema, data);

  if (result.isValid) {
    result.data.platformDisplayName = getPlatformName(
      result.data.paymentPlatform,
    );
    result.data.formattedPhone = formatDjiboutiPhone(result.data.phoneNumber);
  }

  return result;
};

export const validateSimpleInvoice = async (data) => {
  const result = await validate(simpleInvoiceSchema, data);

  if (result.isValid) {
    const tax = result.data.amount * 0.07; // TVA 7% Djibouti
    result.calculations = {
      subtotal: result.data.amount,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((result.data.amount + tax) * 100) / 100,
    };
  }

  return result;
};
