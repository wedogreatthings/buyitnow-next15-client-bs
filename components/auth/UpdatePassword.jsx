'use client';

import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import DOMPurify from 'dompurify';

import AuthContext from '@/context/AuthContext';
import { ArrowLeft, Check, CircleSlash2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
// import { validatePasswordUpdate } from '@/helpers/schemas';

/**
 * Composant de mise à jour de mot de passe
 * Amélioré avec validation complète, sécurité renforcée et retour utilisateur optimisé
 *
 * @param {Object} props
 * @param {string} props.userId - Identifiant utilisateur pour monitoring
 * @param {string} props.referer - URL referer pour le suivi de navigation
 */
const UpdatePassword = ({ userId, referer }) => {
  const { error, updatePassword, clearErrors } = useContext(AuthContext);

  // Références pour focus et manipulation du formulaire
  const formRef = useRef(null);
  const currentPasswordRef = useRef(null);

  // États du formulaire
  const [formState, setFormState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // États de validation et d'interface
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Dans le composant UpdatePassword, ajouter cette ligne après les autres hooks
  const router = useRouter();

  // Focus au chargement
  useEffect(() => {
    if (currentPasswordRef.current) {
      currentPasswordRef.current.focus();
    }
  }, [currentPasswordRef]);

  // Gestion des erreurs du contexte d'authentification
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
      setIsSubmitting(false);
    }
  }, [error, clearErrors]);

  // Sanitize input pour prévenir XSS
  const sanitizeInput = useCallback((value) => {
    if (typeof value === 'string') {
      return DOMPurify.sanitize(value);
    }
    return value;
  }, []);

  // Modification de la fonction handleInputChange pour corriger le problème de validation des mots de passe
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);

    // Mettre à jour l'état du formulaire
    setFormState((prevState) => {
      const newState = {
        ...prevState,
        [name]: sanitizedValue,
      };

      // Vérifier la correspondance entre les mots de passe
      if (name === 'newPassword' || name === 'confirmPassword') {
        // Si on modifie le nouveau mot de passe
        if (name === 'newPassword') {
          if (newState.confirmPassword && newState.confirmPassword.length > 0) {
            // Mettre à jour l'erreur en fonction de si les mots de passe correspondent
            if (sanitizedValue !== newState.confirmPassword) {
              setValidationErrors((prev) => ({
                ...prev,
                confirmPassword: 'Les mots de passe ne correspondent pas',
              }));
            } else {
              // Important: supprimer l'erreur quand les mots de passe correspondent
              setValidationErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.confirmPassword;
                return newErrors;
              });
            }
          }
        }

        // Si on modifie la confirmation du mot de passe
        if (name === 'confirmPassword') {
          if (sanitizedValue.length > 0) {
            // Vérifier si la confirmation correspond au nouveau mot de passe
            if (sanitizedValue !== newState.newPassword) {
              setValidationErrors((prev) => ({
                ...prev,
                confirmPassword: 'Les mots de passe ne correspondent pas',
              }));
            } else {
              // Important: supprimer l'erreur quand les mots de passe correspondent
              setValidationErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.confirmPassword;
                return newErrors;
              });
            }
          } else {
            // Champ vide, pas d'erreur à ce stade
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.confirmPassword;
              return newErrors;
            });
          }
        }
      }

      return newState;
    });

    // Marquer le formulaire comme touché
    setFormTouched(true);

    // Effacer l'erreur de ce champ quand l'utilisateur tape
    if (validationErrors[name] && name !== 'confirmPassword') {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Si on est en train de calculer la force du mot de passe
    if (name === 'newPassword') {
      calculatePasswordStrength(sanitizedValue);
    }
  }, []);

  // Calcule la force du mot de passe sur une échelle de 0 à 100
  const calculatePasswordStrength = useCallback((password) => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let score = 0;

    // Longueur (40 points max)
    score += Math.min(password.length * 4, 40);

    // Complexité (60 points max)
    if (/[a-z]/.test(password)) score += 10; // Minuscules
    if (/[A-Z]/.test(password)) score += 10; // Majuscules
    if (/\d/.test(password)) score += 10; // Chiffres
    if (/[^a-zA-Z\d]/.test(password)) score += 15; // Caractères spéciaux

    // Variété de caractères (bonus)
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars, 15);

    // Séquences communes (malus)
    if (/(123456|password|qwerty|abc123)/i.test(password)) score -= 20;

    // Répétitions (malus)
    if (/(.)\1{2,}/.test(password)) score -= 10;

    // Limiter le score entre 0 et 100
    score = Math.max(0, Math.min(score, 100));

    setPasswordStrength(score);
  }, []);

  // Récupérer le label et la couleur de force du mot de passe
  const getPasswordStrengthInfo = useCallback(() => {
    if (passwordStrength < 30) return { label: 'Faible', color: 'bg-red-500' };
    if (passwordStrength < 60)
      return { label: 'Moyen', color: 'bg-yellow-500' };
    if (passwordStrength < 80) return { label: 'Bon', color: 'bg-blue-500' };
    return { label: 'Fort', color: 'bg-green-500' };
  }, [passwordStrength]);

  // Ajouter cette fonction de gestion du retour
  const handleGoBack = () => {
    router.back(); // ou router.push('/me') si vous voulez forcer le retour à /me
  };

  // Fonction de soumission du formulaire
  const submitHandler = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      // Soumettre la mise à jour du mot de passe
      await updatePassword({
        currentPassword: formState.currentPassword,
        newPassword: formState.newPassword,
        confirmPassword: formState.confirmPassword,
      });

      // Succès (si aucune erreur n'est déclenchée)
      toast.success('Mot de passe mis à jour avec succès');

      // Réinitialiser le formulaire
      setFormState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setFormTouched(false);
      setPasswordStrength(0);

      // Log anonymisé pour monitoring (en production uniquement)
      if (process.env.NODE_ENV === 'production') {
        console.info('Password updated', {
          userId: userId
            ? `${userId.substring(0, 2)}...${userId.slice(-2)}`
            : 'unknown',
          referer: referer ? referer.substring(0, 10) + '...' : 'direct',
        });
      }
    } catch (error) {
      // Géré par l'effect qui écoute les erreurs du contexte
      console.error('Password update error:', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Basculer l'affichage du mot de passe
  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Générer les classes pour les inputs en fonction des erreurs
  const getInputClassName = (fieldName) => {
    const baseClass =
      'appearance-none border rounded-md py-2 px-3 w-full transition-colors duration-200';

    if (validationErrors[fieldName]) {
      return `${baseClass} border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500`;
    }

    return `${baseClass} border-gray-200 bg-gray-100 hover:border-gray-400 focus:outline-hidden focus:border-blue-500 focus:ring-blue-500`;
  };

  // Informations sur la force du mot de passe
  const strengthInfo = getPasswordStrengthInfo();

  return (
    <div className="mb-8 p-4 md:p-7 mx-auto rounded-lg bg-white shadow-lg">
      {/* NOUVEAU : Bouton de retour */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          aria-label="Retourner à la page précédente"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={submitHandler}
        noValidate
        aria-label="Formulaire de modification de mot de passe"
      >
        <h2 className="mb-5 text-2xl font-semibold">
          Modifier votre mot de passe
        </h2>

        <div className="mb-6">
          <label
            htmlFor="currentPassword"
            className="block mb-2 font-medium text-gray-700"
          >
            Mot de passe actuel <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              name="currentPassword"
              ref={currentPasswordRef}
              type={showPassword.current ? 'text' : 'password'}
              className={getInputClassName('currentPassword')}
              placeholder="Saisissez votre mot de passe actuel"
              value={formState.currentPassword}
              onChange={handleInputChange}
              required
              minLength={6}
              aria-invalid={!!validationErrors.currentPassword}
              aria-describedby={
                validationErrors.currentPassword
                  ? 'currentPassword-error'
                  : undefined
              }
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600"
              onClick={() => togglePasswordVisibility('current')}
              tabIndex="-1"
              aria-label={
                showPassword.current
                  ? 'Masquer le mot de passe'
                  : 'Afficher le mot de passe'
              }
            >
              {showPassword.current ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {validationErrors.currentPassword && (
            <p id="currentPassword-error" className="mt-1 text-sm text-red-600">
              {validationErrors.currentPassword}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label
            htmlFor="newPassword"
            className="block mb-2 font-medium text-gray-700"
          >
            Nouveau mot de passe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="newPassword"
              name="newPassword"
              type={showPassword.new ? 'text' : 'password'}
              className={getInputClassName('newPassword')}
              placeholder="Créez un nouveau mot de passe fort"
              value={formState.newPassword}
              onChange={handleInputChange}
              required
              minLength={8}
              aria-invalid={!!validationErrors.newPassword}
              aria-describedby={
                validationErrors.newPassword
                  ? 'newPassword-error'
                  : 'password-requirements'
              }
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600"
              onClick={() => togglePasswordVisibility('new')}
              tabIndex="-1"
              aria-label={
                showPassword.new
                  ? 'Masquer le mot de passe'
                  : 'Afficher le mot de passe'
              }
            >
              {showPassword.current ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {validationErrors.newPassword ? (
            <p id="newPassword-error" className="mt-1 text-sm text-red-600">
              {validationErrors.newPassword}
            </p>
          ) : (
            <ul
              id="password-requirements"
              className="mt-1 text-xs text-gray-500 space-y-1"
            >
              <li
                className={`flex flex-row
                  ${formState.newPassword.length >= 8 ? 'text-green-600' : ''}
                `}
              >
                {formState.newPassword.length >= 8 ? (
                  <Check className="mr-1" />
                ) : (
                  <CircleSlash2 className="mr-1" />
                )}
                Au moins 8 caractères
              </li>
              <li
                className={`flex flex-row
                  ${/[A-Z]/.test(formState.newPassword) ? 'text-green-600' : ''}
                `}
              >
                {/[A-Z]/.test(formState.newPassword) ? (
                  <Check className="mr-1" />
                ) : (
                  <CircleSlash2 className="mr-1" />
                )}
                Au moins une lettre majuscule
              </li>
              <li
                className={`flex flex-row
                  ${/[a-z]/.test(formState.newPassword) ? 'text-green-600' : ''}
                `}
              >
                {/[a-z]/.test(formState.newPassword) ? (
                  <Check className="mr-1" />
                ) : (
                  <CircleSlash2 className="mr-1" />
                )}
                Au moins une lettre minuscule
              </li>
              <li
                className={`flex flex-row
                  ${/\d/.test(formState.newPassword) ? 'text-green-600' : ''}
                `}
              >
                {/\d/.test(formState.newPassword) ? (
                  <Check className="mr-1" />
                ) : (
                  <CircleSlash2 className="mr-1" />
                )}
                Au moins un chiffre
              </li>
              <li
                className={`flex flex-row
                  ${
                    /[@$!%*?&#]/.test(formState.newPassword)
                      ? 'text-green-600'
                      : ''
                  }
                `}
              >
                {/[@$!%*?&#]/.test(formState.newPassword) ? (
                  <Check className="mr-1" />
                ) : (
                  <CircleSlash2 className="mr-1" />
                )}
                Au moins un caractère spécial (@$!%*?&#)
              </li>
            </ul>
          )}

          {formState.newPassword && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">
                  Force du mot de passe:{' '}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    passwordStrength < 30
                      ? 'text-red-600'
                      : passwordStrength < 60
                        ? 'text-yellow-600'
                        : passwordStrength < 80
                          ? 'text-blue-600'
                          : 'text-green-600'
                  }`}
                >
                  {strengthInfo.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${strengthInfo.color}`}
                  style={{ width: `${passwordStrength}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label
            htmlFor="confirmPassword"
            className="block mb-2 font-medium text-gray-700"
          >
            Confirmer le mot de passe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword.confirm ? 'text' : 'password'}
              className={getInputClassName('confirmPassword')}
              placeholder="Confirmez votre nouveau mot de passe"
              value={formState.confirmPassword}
              onChange={handleInputChange}
              required
              aria-invalid={!!validationErrors.confirmPassword}
              aria-describedby={
                validationErrors.confirmPassword
                  ? 'confirmPassword-error'
                  : undefined
              }
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600"
              onClick={() => togglePasswordVisibility('confirm')}
              tabIndex="-1"
              aria-label={
                showPassword.confirm
                  ? 'Masquer le mot de passe'
                  : 'Afficher le mot de passe'
              }
            >
              {showPassword.confirm ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {validationErrors.confirmPassword && (
            <p id="confirmPassword-error" className="mt-1 text-sm text-red-600">
              {validationErrors.confirmPassword}
            </p>
          )}
        </div>

        {validationErrors.general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-400 rounded text-red-700">
            {validationErrors.general}
          </div>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            (formTouched && Object.keys(validationErrors).length > 0)
          }
          className={`mt-4 px-4 py-2 text-center w-full inline-block text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isSubmitting ||
            (formTouched && Object.keys(validationErrors).length > 0)
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Mise à jour en cours...
            </span>
          ) : (
            'Mettre à jour le mot de passe'
          )}
        </button>
      </form>
    </div>
  );
};

export default UpdatePassword;
