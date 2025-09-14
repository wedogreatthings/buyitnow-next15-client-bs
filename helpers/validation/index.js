/**
 * Point d'entrée principal pour la validation
 * Version simplifiée pour 500 visiteurs/jour
 */

// Export des utilitaires de base
export {
  REGEX,
  sanitizeString,
  isValidObjectId,
  isValidPhone,
  isValidDjiboutiPhone,
  validate,
  formatValidationErrors,
} from './core/utils';

// Export des schémas d'authentification
export {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validateLogin,
  validateRegister,
  validatePasswordUpdate,
  validateForgotPassword,
  validateResetPassword,
} from './schemas/auth';

// Export des schémas utilisateur
export {
  profileSchema,
  emailVerificationSchema,
  validateProfile,
  validateProfileWithLogging,
  validateEmailVerification,
} from './schemas/user';

// Export des schémas produit
export {
  searchSchema,
  priceFiltersSchema,
  categorySchema,
  productFiltersSchema,
  productReviewSchema,
  validateProductSearch,
  validatePriceFilters,
  validateCategory,
  validateProductFilters,
  validateProductReview,
} from './schemas/product';

// Export des schémas adresse
export {
  addressSchema,
  addressSelectionSchema,
  validateAddress,
  validateAddressSelection,
  formatAddressDisplay,
  formatAddressShort,
  isAddressComplete,
} from './schemas/address';

// Export des schémas paiement
export {
  SUPPORTED_PLATFORMS,
  djiboutiPaymentSchema,
  simpleInvoiceSchema,
  getPlatformName,
  getPlatformOptions,
  formatDjiboutiPhone,
  validateDjiboutiPayment,
  validateSimpleInvoice,
} from './schemas/payment';

// Export des schémas contact
export {
  contactSchema,
  validateContactMessage,
  classifyMessageType,
  isMessageUrgent,
  formatContactEmail,
} from './schemas/contact';
