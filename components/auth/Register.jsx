'use client';

import { useState, useContext, useEffect, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import AuthContext from '@/context/AuthContext';
// import { registerSchema } from '@/helpers/schemas';

const Register = () => {
  // Contexte d'authentification
  const {
    error,
    registerUser,
    clearErrors,
    loading: contextLoading,
  } = useContext(AuthContext);

  // États du formulaire
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const formRef = useRef(null);

  // Détection de l'état de la connexion internet
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
  }, [navigator]);

  // Gestion des erreurs depuis le contexte
  useEffect(() => {
    if (error) {
      // Traitement intelligent des erreurs
      if (error.includes('duplicate') || error.includes('already exists')) {
        toast.error(
          'Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email.',
        );
      } else {
        toast.error(error);
      }
      clearErrors();
    }
  }, [error, clearErrors]);

  // Mise à jour des champs du formulaire
  const handleChange = async (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Validation en temps réel
    // await validateField(name, value);

    // Calcul de la force du mot de passe
    if (name === 'password') {
      calculatePasswordStrength(value);
    }
  };

  // Validation d'un champ individuel
  // const validateField = async (name, value) => {
  //   try {
  //     await registerSchema.validateAt(name, { [name]: value });
  //     setErrors((prev) => ({ ...prev, [name]: undefined }));
  //     return true;
  //   } catch (error) {
  //     setErrors((prev) => ({ ...prev, [name]: error.message }));
  //     return false;
  //   }
  // };

  // Calcul de la force du mot de passe (0-100)
  const calculatePasswordStrength = (password) => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let score = 0;

    // Longueur (max 25 points)
    score += Math.min(password.length * 2.5, 25);

    // Complexité (max 75 points)
    if (/[A-Z]/.test(password)) score += 15; // Majuscules
    if (/[a-z]/.test(password)) score += 10; // Minuscules
    if (/[0-9]/.test(password)) score += 15; // Chiffres
    if (/[^A-Za-z0-9]/.test(password)) score += 20; // Caractères spéciaux
    if (/(.)\1\1/.test(password)) score -= 10; // Répétitions (pénalité)

    // Variété des caractères (max 15 points supplémentaires)
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 1.5, 15);

    setPasswordStrength(Math.max(0, Math.min(100, score)));
  };

  // Soumission du formulaire
  const submitHandler = async (e) => {
    e.preventDefault();

    if (isOffline) {
      toast.warning(
        'Vous semblez être hors ligne. Veuillez vérifier votre connexion internet.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Soumission au serveur
      await registerUser({
        ...formData,
      });

      // Réinitialisation du formulaire en cas de succès
      if (!error) {
        formRef.current?.reset();
        setFormData({
          name: '',
          phone: '',
          email: '',
          password: '',
        });
      }
    } catch (error) {
      // Traitement générique des erreurs
      toast.error('Une erreur est survenue. Veuillez réessayer.');
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obtenir la couleur de la barre de force du mot de passe
  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Obtenir le message de force du mot de passe
  const getPasswordStrengthText = () => {
    if (passwordStrength < 30) return 'Faible';
    if (passwordStrength < 60) return 'Moyen';
    return 'Fort';
  };

  return (
    <div className="max-w-md w-full mx-auto mt-8 mb-16 p-4 md:p-7 rounded-lg bg-white shadow-lg">
      <form ref={formRef} onSubmit={submitHandler} noValidate>
        {/* Alerte hors ligne */}
        {isOffline && (
          <div
            className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md"
            role="alert"
          >
            <p className="text-sm font-medium">
              Vous êtes actuellement hors ligne. L&apos;inscription nécessite
              une connexion internet.
            </p>
          </div>
        )}

        {/* Champ nom */}
        <div className="mb-4">
          <label
            htmlFor="name"
            className="block mb-1 font-medium text-gray-700"
          >
            Nom complet <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            className={`appearance-none border ${errors.name ? 'border-red-500' : 'border-gray-200'} bg-gray-50 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="text"
            placeholder="Votre nom complet"
            value={formData.name}
            onChange={handleChange}
            // onBlur={(e) => validateField('name', e.target.value)}
            disabled={isSubmitting || contextLoading}
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'name-error' : undefined}
            autoComplete="name"
            required
          />
          {errors.name && (
            <p
              id="name-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {errors.name}
            </p>
          )}
        </div>

        {/* Champ téléphone */}
        <div className="mb-4">
          <label
            htmlFor="phone"
            className="block mb-1 font-medium text-gray-700"
          >
            Numéro de téléphone <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            className={`appearance-none border ${errors.phone ? 'border-red-500' : 'border-gray-200'} bg-gray-50 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="tel"
            placeholder="Votre numéro de téléphone"
            value={formData.phone}
            onChange={handleChange}
            // onBlur={(e) => validateField('phone', e.target.value)}
            disabled={isSubmitting || contextLoading}
            aria-invalid={errors.phone ? 'true' : 'false'}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            autoComplete="tel"
            required
          />
          {errors.phone && (
            <p
              id="phone-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {errors.phone}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Format: numéro à 10 chiffres sans espaces
          </p>
        </div>

        {/* Champ email */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block mb-1 font-medium text-gray-700"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            className={`appearance-none border ${errors.email ? 'border-red-500' : 'border-gray-200'} bg-gray-50 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="email"
            placeholder="Votre adresse email"
            value={formData.email}
            onChange={handleChange}
            // onBlur={(e) => validateField('email', e.target.value)}
            disabled={isSubmitting || contextLoading}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            autoComplete="email"
            required
          />
          {errors.email && (
            <p
              id="email-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Champ mot de passe */}
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block mb-1 font-medium text-gray-700"
          >
            Mot de passe <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            className={`appearance-none border ${errors.password ? 'border-red-500' : 'border-gray-200'} bg-gray-50 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="password"
            placeholder="Créez un mot de passe sécurisé"
            value={formData.password}
            onChange={handleChange}
            // onBlur={(e) => validateField('password', e.target.value)}
            disabled={isSubmitting || contextLoading}
            minLength={8}
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'password-error' : undefined}
            autoComplete="new-password"
            required
          />
          {errors.password && (
            <p
              id="password-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {errors.password}
            </p>
          )}

          {/* Indicateur de force du mot de passe */}
          {formData.password && (
            <div className="mt-2">
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
                  // eslint-disable-next-line react/forbid-dom-props
                  style={{ width: `${passwordStrength}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-600 flex justify-between">
                <span>Force du mot de passe: {getPasswordStrengthText()}</span>
                <span>{passwordStrength}/100</span>
              </p>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Au moins 8 caractères avec majuscules, minuscules et chiffres
          </p>
        </div>

        {/* Conditions d'utilisation */}
        <div className="mb-6">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="terms"
                aria-describedby="terms-description"
                name="terms"
                type="checkbox"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                required
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="font-medium text-gray-700">
                J&apos;accepte les conditions d&apos;utilisation
              </label>
              <p id="terms-description" className="text-gray-500">
                En créant un compte, vous acceptez nos{' '}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  conditions d&apos;utilisation
                </Link>{' '}
                et notre{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  politique de confidentialité
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Bouton de soumission */}
        <button
          type="submit"
          className={`px-4 py-3 text-center w-full inline-flex justify-center items-center text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isSubmitting || contextLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          disabled={isSubmitting || contextLoading || isOffline}
        >
          {isSubmitting || contextLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
              Création en cours...
            </>
          ) : (
            'Créer mon compte'
          )}
        </button>

        <hr className="my-6 border-gray-200" />

        <p className="text-center text-gray-600">
          Vous avez déjà un compte ?{' '}
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
