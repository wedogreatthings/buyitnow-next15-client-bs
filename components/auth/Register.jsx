'use client';

import { useState, useContext, useEffect, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { CheckCircle, LoaderCircle, Mail } from 'lucide-react';
import AuthContext from '@/context/AuthContext';
import { captureClientError } from '@/monitoring/sentry';

const Register = () => {
  // Contexte d'authentification
  const {
    error,
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
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationData, setRegistrationData] = useState(null);
  const formRef = useRef(null);

  // Détection de l'état de la connexion internet
  useEffect(() => {
    try {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } catch (error) {
      // Monitoring : Erreur de détection de connexion
      captureClientError(error, 'Register', 'connectionDetection', false);
    }
  }, []);

  // Gestion des erreurs depuis le contexte
  useEffect(() => {
    if (error) {
      // Classification des erreurs avec monitoring
      let errorType = 'generic';
      let isCritical = false;

      if (error.includes('duplicate') || error.includes('already exists')) {
        errorType = 'duplicate_user';
        isCritical = false; // Erreur utilisateur normale
        toast.error(
          'Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email.',
        );
      } else if (error.includes('validation')) {
        errorType = 'validation_error';
        isCritical = false;
        toast.error(error);
      } else {
        errorType = 'server_error';
        isCritical = true; // Erreur serveur = critique
        toast.error(error);
      }

      // Monitoring avec contexte
      captureClientError(
        new Error(`Erreur contexte: ${errorType}`),
        'Register',
        'contextError',
        isCritical,
        {
          errorType,
          originalError: error,
          formData: {
            hasName: !!formData.name,
            hasEmail: !!formData.email,
            hasPhone: !!formData.phone,
            emailDomain: formData.email ? formData.email.split('@')[1] : null,
          },
        },
      );

      clearErrors();
    }
  }, [error, clearErrors, formData]);

  // Mise à jour des champs du formulaire
  const handleChange = async (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Calcul de la force du mot de passe
    if (name === 'password') {
      try {
        calculatePasswordStrength(value);
      } catch (error) {
        // Monitoring : Erreur calcul force mot de passe
        captureClientError(
          error,
          'Register',
          'passwordStrengthCalculation',
          false,
        );
      }
    }
  };

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
      const offlineError = new Error('Tentative inscription hors ligne');
      captureClientError(offlineError, 'Register', 'submit', false);
      toast.warning(
        'Vous semblez être hors ligne. Veuillez vérifier votre connexion internet.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Validation côté client basique
      if (
        !formData.name ||
        !formData.email ||
        !formData.password ||
        !formData.phone
      ) {
        const validationError = new Error('Champs obligatoires manquants');
        captureClientError(
          validationError,
          'Register',
          'clientValidation',
          false,
          {
            missingFields: {
              name: !formData.name,
              email: !formData.email,
              password: !formData.password,
              phone: !formData.phone,
            },
          },
        );
        toast.error('Tous les champs sont obligatoires');
        setIsSubmitting(false);
        return;
      }

      // Appel direct à l'API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // ✅ SUCCÈS: Inscription réussie
        setRegistrationSuccess(true);
        setRegistrationData(data.data);

        // Monitoring succès
        captureClientError(
          new Error('Inscription réussie'),
          'Register',
          'registrationSuccess',
          false,
          {
            emailSent: data.data?.emailSent,
            hasNextSteps: !!data.data?.nextSteps,
            userCreated: !!data.data?.user,
            action: 'success',
          },
        );

        // Réinitialiser le formulaire
        setFormData({
          name: '',
          phone: '',
          email: '',
          password: '',
        });
        setPasswordStrength(0);

        // Toast de succès
        toast.success(data.message || 'Inscription réussie !');

        // Log pour développement
        if (process.env.NODE_ENV === 'development') {
          console.log('Registration successful:', {
            user: data.data?.user?.email,
            emailSent: data.data?.emailSent,
            nextSteps: data.data?.nextSteps,
          });
        }
      } else {
        // ✅ ERREUR: Gestion des erreurs spécifiques avec monitoring
        let errorType = 'generic';
        let isCritical = false;

        switch (data.code) {
          case 'DUPLICATE_EMAIL':
          case 'DUPLICATE_TELEPHONE':
            errorType = 'duplicate_data';
            isCritical = false;
            toast.error(data.message);
            break;
          case 'VALIDATION_FAILED':
            errorType = 'validation_failed';
            isCritical = false;
            if (data.errors) {
              setErrors(data.errors);
              toast.error('Veuillez corriger les erreurs dans le formulaire');
            } else {
              toast.error(data.message);
            }
            break;
          case 'RATE_LIMITED':
            errorType = 'rate_limited';
            isCritical = true; // Peut indiquer une attaque
            toast.error('Trop de tentatives. Veuillez réessayer plus tard.');
            break;
          default:
            errorType = 'server_error';
            isCritical = true;
            toast.error(data.message || "Erreur lors de l'inscription");
        }

        // Monitoring avec contexte riche
        captureClientError(
          new Error(`Échec inscription: ${errorType}`),
          'Register',
          'registrationFailure',
          isCritical,
          {
            errorType,
            statusCode: response.status,
            originalError: data.message,
            errorCode: data.code,
            hasValidationErrors: !!data.errors,
            formData: {
              emailDomain: formData.email ? formData.email.split('@')[1] : null,
              passwordStrength: passwordStrength,
              nameLength: formData.name ? formData.name.length : 0,
            },
          },
        );
      }
    } catch (error) {
      // Monitoring : Erreurs techniques
      let isCritical = true;
      let errorType = 'unknown';

      if (error.name === 'AbortError') {
        errorType = 'timeout';
        isCritical = false;
      } else if (
        error.name === 'TypeError' &&
        error.message.includes('fetch')
      ) {
        errorType = 'network_error';
        isCritical = true;
      } else if (error instanceof SyntaxError) {
        errorType = 'json_parse_error';
        isCritical = true;
      }

      captureClientError(error, 'Register', 'technicalError', isCritical, {
        errorType,
        errorName: error.name,
        errorMessage: error.message,
      });

      console.error('Registration error:', error);
      toast.error('Une erreur est survenue. Veuillez réessayer.');
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

  // ✅ NOUVEAU: Écran de succès après inscription
  if (registrationSuccess && registrationData) {
    return (
      <div className="max-w-md w-full mx-auto mt-8 mb-16 p-4 md:p-7 rounded-lg bg-white shadow-lg">
        {/* Icône de succès */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        {/* Titre */}
        <h2 className="text-2xl font-bold text-green-800 text-center mb-4">
          Inscription réussie ! 🎉
        </h2>

        {/* Informations utilisateur */}
        <div className="bg-gray-50 rounded-md p-4 mb-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium">Nom :</span>{' '}
            {registrationData.user?.name}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Email :</span>{' '}
            {registrationData.user?.email}
          </p>
        </div>

        {/* Status email */}
        <div
          className={`rounded-md p-4 mb-6 border ${
            registrationData.emailSent
              ? 'bg-blue-50 border-blue-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-center">
            <Mail
              className={`w-5 h-5 mr-2 ${
                registrationData.emailSent ? 'text-blue-600' : 'text-yellow-600'
              }`}
            />
            <div>
              <p
                className={`font-medium text-sm ${
                  registrationData.emailSent
                    ? 'text-blue-800'
                    : 'text-yellow-800'
                }`}
              >
                {registrationData.emailSent
                  ? 'Email de vérification envoyé !'
                  : "Email en cours d'envoi..."}
              </p>
              <p
                className={`text-xs mt-1 ${
                  registrationData.emailSent
                    ? 'text-blue-700'
                    : 'text-yellow-700'
                }`}
              >
                {registrationData.emailSent
                  ? 'Consultez votre boîte email et vos spams.'
                  : 'Vous recevrez un email sous peu.'}
              </p>
            </div>
          </div>
        </div>

        {/* Étapes suivantes */}
        {registrationData.nextSteps && (
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3">
              Étapes suivantes :
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              {registrationData.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 text-center block"
          >
            Se connecter maintenant
          </Link>

          <button
            onClick={() => {
              setRegistrationSuccess(false);
              setRegistrationData(null);
            }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-md transition duration-200 text-center"
          >
            Créer un autre compte
          </button>
        </div>

        {/* Aide */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 mb-2">
            Vous ne recevez pas l&apos;email ?
          </p>
          <Link
            href="/auth/help"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Obtenir de l&apos;aide
          </Link>
        </div>
      </div>
    );
  }

  // ✅ FORMULAIRE D'INSCRIPTION (état normal)
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
              <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
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
