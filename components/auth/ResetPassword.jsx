// components/auth/ResetPassword.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Shield,
  LoaderCircle,
} from 'lucide-react';
import { validateResetPassword } from '@/helpers/validation/schemas/auth';
import captureClientError from '@/monitoring/sentry';

/**
 * Composant de réinitialisation de mot de passe avec token
 */
const ResetPassword = ({ token }) => {
  const router = useRouter();

  // Références pour focus
  const newPasswordRef = useRef(null);

  // États du formulaire
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState({
    new: false,
    confirm: false,
  });
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);

  // Focus sur le premier champ au chargement
  useEffect(() => {
    if (newPasswordRef.current) {
      newPasswordRef.current.focus();
    }
  }, []);

  // Vérifier l'état de la connexion internet
  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calcul de la force du mot de passe
  const calculatePasswordStrength = (password) => {
    try {
      if (!password) {
        setPasswordStrength(0);
        return;
      }

      let score = 0;

      // Longueur (max 30 points)
      score += Math.min(password.length * 3, 30);

      // Complexité (max 70 points)
      if (/[a-z]/.test(password)) score += 10; // Minuscules
      if (/[A-Z]/.test(password)) score += 15; // Majuscules
      if (/\d/.test(password)) score += 15; // Chiffres
      if (/[@$!%*?&#]/.test(password)) score += 20; // Caractères spéciaux

      // Variété de caractères
      const uniqueChars = new Set(password).size;
      score += Math.min(uniqueChars, 10);

      // Pénalités
      if (/(123456|password|qwerty|abc123)/i.test(password)) score -= 20;
      if (/(.)\1{2,}/.test(password)) score -= 10; // Répétitions

      setPasswordStrength(Math.max(0, Math.min(100, score)));
    } catch (error) {
      captureClientError(
        error,
        'ResetPassword',
        'passwordStrengthCalculation',
        false,
      );
    }
  };

  // Gestionnaire de changement des champs
  const handleChange = (e) => {
    try {
      const { name, value } = e.target;

      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Effacer l'erreur du champ quand l'utilisateur tape
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }

      // Calculer la force si c'est le nouveau mot de passe
      if (name === 'newPassword') {
        calculatePasswordStrength(value);
      }

      // Vérifier la correspondance des mots de passe
      if (name === 'confirmPassword' || name === 'newPassword') {
        if (name === 'confirmPassword' && value !== formData.newPassword) {
          setErrors((prev) => ({
            ...prev,
            confirmPassword: 'Les mots de passe ne correspondent pas',
          }));
        } else if (
          name === 'newPassword' &&
          formData.confirmPassword &&
          value !== formData.confirmPassword
        ) {
          setErrors((prev) => ({
            ...prev,
            confirmPassword: 'Les mots de passe ne correspondent pas',
          }));
        } else {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.confirmPassword;
            return newErrors;
          });
        }
      }
    } catch (error) {
      captureClientError(error, 'ResetPassword', 'technicalError', true);
    }
  };

  // Basculer la visibilité du mot de passe
  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Obtenir la couleur et le texte de la force du mot de passe
  const getPasswordStrengthInfo = () => {
    if (passwordStrength < 30)
      return { text: 'Faible', color: 'bg-red-500', textColor: 'text-red-600' };
    if (passwordStrength < 60)
      return {
        text: 'Moyen',
        color: 'bg-yellow-500',
        textColor: 'text-yellow-600',
      };
    if (passwordStrength < 80)
      return { text: 'Bon', color: 'bg-blue-500', textColor: 'text-blue-600' };
    return { text: 'Fort', color: 'bg-green-500', textColor: 'text-green-600' };
  };

  // Gestionnaire de soumission du formulaire
  const submitHandler = async (e) => {
    e.preventDefault();

    // Vérifier si hors ligne
    if (isOffline) {
      toast.error(
        'Vous semblez être hors ligne. Veuillez vérifier votre connexion internet.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Validation avec Yup
      const validation = await validateResetPassword({
        token,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error('Veuillez corriger les erreurs dans le formulaire.');
        setIsSubmitting(false);
        return;
      }

      // Appel à l'API
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: validation.data.newPassword,
          confirmPassword: validation.data.confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Succès
        setResetSuccess(true);
        toast.success(
          data.message || 'Mot de passe réinitialisé avec succès !',
        );

        // Log pour développement
        if (process.env.NODE_ENV === 'development') {
          console.log('Password reset successful:', data.data);
        }

        // Redirection après 3 secondes
        setTimeout(() => {
          router.push('/login?message=password_reset_success');
        }, 3000);
      } else {
        // Gestion des erreurs spécifiques
        switch (data.code) {
          case 'INVALID_OR_EXPIRED_TOKEN':
            setTokenExpired(true);
            toast.error(
              'Le lien de réinitialisation est invalide ou a expiré.',
            );
            break;
          case 'SAME_PASSWORD':
            toast.error(
              "Le nouveau mot de passe doit être différent de l'ancien.",
            );
            break;
          case 'ACCOUNT_SUSPENDED':
            toast.error(
              "Votre compte est suspendu. Contactez l'administrateur.",
            );
            break;
          case 'ACCOUNT_LOCKED':
            toast.error(data.message);
            break;
          case 'VALIDATION_FAILED':
            setErrors(data.errors || {});
            toast.error('Veuillez corriger les erreurs dans le formulaire.');
            break;
          default:
            toast.error(data.message || 'Erreur lors de la réinitialisation.');
        }
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Écran de succès
  if (resetSuccess) {
    return (
      <div className="space-y-6">
        {/* Icône de succès */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        {/* Message de succès */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Mot de passe réinitialisé !
          </h2>
          <p className="text-sm text-gray-600">
            Votre mot de passe a été modifié avec succès.
          </p>
        </div>

        {/* Redirection automatique */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
            <p className="text-sm text-blue-800">
              Redirection vers la page de connexion dans 3 secondes...
            </p>
          </div>
        </div>

        {/* Bouton de connexion immédiate */}
        <Link
          href="/login"
          className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
        >
          Se connecter maintenant
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    );
  }

  // Écran de token expiré
  if (tokenExpired) {
    return (
      <div className="space-y-6">
        {/* Icône d'erreur */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* Message d'erreur */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Lien expiré ou invalide
          </h2>
          <p className="text-sm text-gray-600">
            Ce lien de réinitialisation n&apos;est plus valide. Les liens
            expirent après 1 heure pour votre sécurité.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/forgot-password"
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
          >
            Demander un nouveau lien
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>

          <Link
            href="/login"
            className="w-full block text-center py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  // Formulaire de réinitialisation
  const strengthInfo = getPasswordStrengthInfo();

  return (
    <form onSubmit={submitHandler} noValidate>
      {/* Alerte hors ligne */}
      {isOffline && (
        <div
          className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md"
          role="alert"
        >
          <p className="text-sm">
            Vous êtes actuellement hors ligne. Une connexion internet est
            nécessaire.
          </p>
        </div>
      )}

      {/* Champ nouveau mot de passe */}
      <div className="mb-6">
        <label
          htmlFor="newPassword"
          className="block mb-2 font-medium text-gray-700"
        >
          Nouveau mot de passe
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="newPassword"
            name="newPassword"
            ref={newPasswordRef}
            type={showPassword.new ? 'text' : 'password'}
            className={`appearance-none border ${
              errors.newPassword ? 'border-red-500' : 'border-gray-200'
            } bg-gray-50 rounded-md py-2 pl-10 pr-10 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            placeholder="Créez un mot de passe fort"
            value={formData.newPassword}
            onChange={handleChange}
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? 'true' : 'false'}
            aria-describedby={
              errors.newPassword ? 'newPassword-error' : undefined
            }
            disabled={isSubmitting}
            required
            minLength={8}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => togglePasswordVisibility('new')}
            tabIndex="-1"
            aria-label={
              showPassword.new
                ? 'Masquer le mot de passe'
                : 'Afficher le mot de passe'
            }
          >
            {showPassword.new ? (
              <EyeOff className="h-5 w-5 text-gray-400" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        {errors.newPassword && (
          <p
            id="newPassword-error"
            className="mt-1 text-xs text-red-600"
            role="alert"
          >
            {errors.newPassword}
          </p>
        )}

        {/* Indicateur de force du mot de passe */}
        {formData.newPassword && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">
                Force du mot de passe:
              </span>
              <span
                className={`text-xs font-semibold ${strengthInfo.textColor}`}
              >
                {strengthInfo.text}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${strengthInfo.color} transition-all duration-300`}
                style={{ width: `${passwordStrength}%` }}
              ></div>
            </div>

            {/* Critères du mot de passe */}
            <div className="mt-2 space-y-1">
              <div
                className={`flex items-center text-xs ${formData.newPassword.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}
              >
                {formData.newPassword.length >= 8 ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Au moins 8 caractères
              </div>
              <div
                className={`flex items-center text-xs ${/[A-Z]/.test(formData.newPassword) ? 'text-green-600' : 'text-gray-400'}`}
              >
                {/[A-Z]/.test(formData.newPassword) ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Une lettre majuscule
              </div>
              <div
                className={`flex items-center text-xs ${/[a-z]/.test(formData.newPassword) ? 'text-green-600' : 'text-gray-400'}`}
              >
                {/[a-z]/.test(formData.newPassword) ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Une lettre minuscule
              </div>
              <div
                className={`flex items-center text-xs ${/\d/.test(formData.newPassword) ? 'text-green-600' : 'text-gray-400'}`}
              >
                {/\d/.test(formData.newPassword) ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Un chiffre
              </div>
              <div
                className={`flex items-center text-xs ${/[@$!%*?&#]/.test(formData.newPassword) ? 'text-green-600' : 'text-gray-400'}`}
              >
                {/[@$!%*?&#]/.test(formData.newPassword) ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Un caractère spécial
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Champ confirmation mot de passe */}
      <div className="mb-6">
        <label
          htmlFor="confirmPassword"
          className="block mb-2 font-medium text-gray-700"
        >
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Shield className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword.confirm ? 'text' : 'password'}
            className={`appearance-none border ${
              errors.confirmPassword ? 'border-red-500' : 'border-gray-200'
            } bg-gray-50 rounded-md py-2 pl-10 pr-10 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            placeholder="Confirmez votre nouveau mot de passe"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            aria-describedby={
              errors.confirmPassword ? 'confirmPassword-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => togglePasswordVisibility('confirm')}
            tabIndex="-1"
            aria-label={
              showPassword.confirm
                ? 'Masquer le mot de passe'
                : 'Afficher le mot de passe'
            }
          >
            {showPassword.confirm ? (
              <EyeOff className="h-5 w-5 text-gray-400" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p
            id="confirmPassword-error"
            className="mt-1 text-xs text-red-600"
            role="alert"
          >
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Bouton de soumission */}
      <button
        type="submit"
        className={`w-full px-4 py-3 text-center inline-flex justify-center items-center text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
          isSubmitting || Object.keys(errors).length > 0
            ? 'opacity-70 cursor-not-allowed'
            : ''
        }`}
        disabled={isSubmitting || isOffline || Object.keys(errors).length > 0}
        aria-busy={isSubmitting ? 'true' : 'false'}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
            Réinitialisation en cours...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Réinitialiser le mot de passe
          </>
        )}
      </button>

      <hr className="my-6 border-gray-200" />

      {/* Lien de demande de nouveau token */}
      <p className="text-center text-gray-600 text-sm">
        Le lien ne fonctionne pas ?{' '}
        <Link
          href="/forgot-password"
          className="text-blue-600 hover:text-blue-800 font-semibold"
        >
          Demander un nouveau lien
        </Link>
      </p>
    </form>
  );
};

export default ResetPassword;
