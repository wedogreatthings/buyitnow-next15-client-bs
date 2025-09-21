// components/auth/ForgotPassword.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  Mail,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  LoaderCircle,
} from 'lucide-react';
import { validateForgotPassword } from '@/helpers/validation/schemas/auth';

/**
 * Composant de demande de réinitialisation de mot de passe
 */
const ForgotPassword = ({ referer }) => {
  // États du composant
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastSentTime, setLastSentTime] = useState(null);

  // Référence pour le focus
  const emailRef = useRef(null);

  // Focus sur le champ email au chargement
  useEffect(() => {
    if (emailRef.current) {
      emailRef.current.focus();
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

  // Gestion du countdown pour le rate limiting
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

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

    // Vérifier le rate limiting côté client
    if (countdown > 0) {
      toast.warning(
        `Veuillez attendre ${countdown} secondes avant de renvoyer la demande.`,
      );
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Validation avec Yup
      const validation = await validateForgotPassword({
        email: email.trim().toLowerCase(),
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error('Veuillez corriger les erreurs dans le formulaire.');
        setIsSubmitting(false);
        return;
      }

      // Appel à l'API
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: validation.data.email,
        }),
      });

      const data = await response.json();

      // Toujours afficher succès pour éviter l'énumération d'emails
      if (data.success || data.code === 'EMAIL_SENT_IF_EXISTS') {
        setEmailSent(true);
        setLastSentTime(Date.now());
        setCountdown(120); // 2 minutes avant prochain envoi

        // Message de succès générique
        toast.success(
          data.message ||
            'Si cette adresse email existe dans notre système, vous recevrez un lien de réinitialisation.',
        );

        // Log pour développement
        if (process.env.NODE_ENV === 'development' && data.data?.debug) {
          console.log('Debug info:', data.data.debug);
        }
      } else {
        // Ne pas révéler d'informations spécifiques
        toast.info(
          'Si cette adresse email existe dans notre système, vous recevrez un lien de réinitialisation.',
        );
        setEmailSent(true);
        setCountdown(120);
      }
    } catch (error) {
      console.error('Forgot password error:', error);

      // Message d'erreur générique
      toast.error(
        'Une erreur est survenue. Veuillez réessayer dans quelques instants.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Réinitialiser pour une nouvelle demande
  const handleNewRequest = () => {
    setEmailSent(false);
    setEmail('');
    setErrors({});
    setCountdown(0);
    if (emailRef.current) {
      emailRef.current.focus();
    }
  };

  // Écran de succès après envoi
  if (emailSent) {
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
            Email envoyé !
          </h2>
          <p className="text-sm text-gray-600">
            Si l&apos;adresse email{' '}
            <span className="font-mono font-medium">{email}</span> existe dans
            notre système, vous recevrez un lien de réinitialisation.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Prochaines étapes :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Vérifiez votre boîte de réception</li>
                <li>Consultez également vos spams</li>
                <li>Le lien expire dans 1 heure</li>
                <li>Cliquez sur le lien pour créer un nouveau mot de passe</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Délai d'attente */}
        {countdown > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600 mr-2" />
              <p className="text-sm text-yellow-800">
                Nouvelle demande disponible dans {Math.floor(countdown / 60)}:
                {(countdown % 60).toString().padStart(2, '0')}
              </p>
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="space-y-3">
          <button
            onClick={handleNewRequest}
            disabled={countdown > 0}
            className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
              countdown > 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {countdown > 0
              ? 'Veuillez patienter...'
              : 'Faire une nouvelle demande'}
          </button>

          <Link
            href="/login"
            className="w-full block text-center py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Retour à la connexion
          </Link>
        </div>

        {/* Aide */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">
            Vous ne recevez pas l&apos;email ?
          </p>
          <Link
            href="/help/password-reset"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Obtenir de l&apos;aide
          </Link>
        </div>
      </div>
    );
  }

  // Formulaire de demande
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

      {/* Instructions */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Entrez l&apos;adresse email associée à votre compte et nous vous
          enverrons un lien pour réinitialiser votre mot de passe.
        </p>
      </div>

      {/* Champ email */}
      <div className="mb-6">
        <label htmlFor="email" className="block mb-2 font-medium text-gray-700">
          Adresse email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="email"
            ref={emailRef}
            className={`appearance-none border ${
              errors.email ? 'border-red-500' : 'border-gray-200'
            } bg-gray-50 rounded-md py-2 pl-10 pr-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Effacer l'erreur quand l'utilisateur tape
              if (errors.email) {
                setErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            disabled={isSubmitting}
            required
          />
        </div>
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

      {/* Bouton de soumission */}
      <button
        type="submit"
        className={`w-full px-4 py-3 text-center inline-flex justify-center items-center text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
          isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        disabled={isSubmitting || isOffline}
        aria-busy={isSubmitting ? 'true' : 'false'}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
            Envoi en cours...
          </>
        ) : (
          <>
            <Mail className="w-4 h-4 mr-2" />
            Envoyer le lien de réinitialisation
          </>
        )}
      </button>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour à la connexion
        </Link>
      </div>

      <hr className="my-6 border-gray-200" />

      {/* Liens supplémentaires */}
      <p className="text-center text-gray-600 text-sm">
        Vous n&apos;avez pas de compte ?{' '}
        <Link
          href="/register"
          className="text-blue-600 hover:text-blue-800 font-semibold"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
};

export default ForgotPassword;
