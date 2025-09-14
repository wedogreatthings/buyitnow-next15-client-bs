/**
 * Schémas de validation pour les profils utilisateur
 */

import * as yup from 'yup';
import { createBaseFields, validate } from '../core/utils';

const baseFields = createBaseFields();

// Schéma de profil utilisateur
export const profileSchema = yup.object().shape({
  name: baseFields.name,
  phone: baseFields.phone,
  avatar: yup
    .object()
    .nullable()
    .shape({
      public_id: yup.string().nullable(),
      url: yup
        .string()
        .nullable()
        .url('URL invalide')
        .test(
          'https',
          'URL non sécurisée',
          (value) => !value || value.startsWith('https://'),
        ),
    })
    .default(null),
});

// Schéma de vérification d'email
export const emailVerificationSchema = yup.object().shape({
  token: yup
    .string()
    .required('Token requis')
    .matches(/^[a-zA-Z0-9]{32,128}$/, 'Token invalide'),
});

// Fonctions de validation
export const validateProfile = (data) => validate(profileSchema, data);
export const validateProfileWithLogging = validateProfile; // Alias pour compatibilité
export const validateEmailVerification = (data) =>
  validate(emailVerificationSchema, data);
