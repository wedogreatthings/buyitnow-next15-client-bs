/**
 * Schémas d'authentification simplifiés
 */

import * as yup from 'yup';
import {
  createBaseFields,
  REGEX,
  passwordContainsPersonalInfo,
  validate,
} from '../core/utils';

const baseFields = createBaseFields();

// Schéma de connexion
export const loginSchema = yup.object().shape({
  email: baseFields.email,
  password: yup
    .string()
    .trim()
    .required('Mot de passe requis')
    .min(6, 'Minimum 6 caractères')
    .max(100, 'Maximum 100 caractères'),
});

// Schéma d'inscription
export const registerSchema = yup.object().shape({
  name: baseFields.name,
  email: baseFields.email,
  phone: baseFields.phone,
  password: baseFields.password
    .matches(
      REGEX.STRONG_PASSWORD,
      'Le mot de passe doit contenir: majuscule, minuscule, chiffre et caractère spécial',
    )
    .test(
      'no-personal-info',
      'Le mot de passe ne doit pas contenir votre nom ou email',
      passwordContainsPersonalInfo,
    ),
});

// Schéma de mise à jour de mot de passe
export const updatePasswordSchema = yup.object().shape({
  currentPassword: yup
    .string()
    .trim()
    .required('Mot de passe actuel requis')
    .min(6, 'Minimum 6 caractères'),

  newPassword: baseFields.password
    .matches(REGEX.STRONG_PASSWORD, 'Mot de passe pas assez fort')
    .test(
      'different',
      'Doit être différent du mot de passe actuel',
      function (value) {
        return value !== this.parent.currentPassword;
      },
    ),

  confirmPassword: yup
    .string()
    .required('Confirmation requise')
    .test('match', 'Les mots de passe ne correspondent pas', function (value) {
      return value === this.parent.newPassword;
    }),
});

// Schéma mot de passe oublié
export const forgotPasswordSchema = yup.object().shape({
  email: baseFields.email,
});

// Schéma réinitialisation mot de passe
export const resetPasswordSchema = yup.object().shape({
  token: yup
    .string()
    .required('Token requis')
    .min(10, 'Token invalide')
    .max(200, 'Token invalide'),

  newPassword: baseFields.password.matches(
    REGEX.STRONG_PASSWORD,
    'Mot de passe pas assez fort',
  ),

  confirmPassword: yup
    .string()
    .required('Confirmation requise')
    .test('match', 'Les mots de passe ne correspondent pas', function (value) {
      return value === this.parent.newPassword;
    }),
});

// Fonctions de validation
export const validateLogin = (data) => validate(loginSchema, data);
export const validateRegister = (data) => validate(registerSchema, data);
export const validatePasswordUpdate = (data) =>
  validate(updatePasswordSchema, data);
export const validateForgotPassword = (data) =>
  validate(forgotPasswordSchema, data);
export const validateResetPassword = (data) =>
  validate(resetPasswordSchema, data);
