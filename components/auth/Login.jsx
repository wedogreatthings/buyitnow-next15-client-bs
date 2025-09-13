'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';

import { parseCallbackUrl } from '@/helpers/helpers';
import { validateLogin } from '@/helpers/validation/schemas/auth';

const Login = ({ csrfToken }) => {
  // États du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isOffline, setIsOffline] = useState(false);

  const router = useRouter();
  const params = useSearchParams();
  const callBackUrl = params.get('callbackUrl');

  // Vérifier l'état de la connexion
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

  // Gestionnaire de soumission du formulaire
  const submitHandler = async (e) => {
    e.preventDefault();

    // Vérifier d'abord si l'utilisateur est hors ligne
    if (isOffline) {
      toast.error(
        'Vous semblez être hors ligne. Veuillez vérifier votre connexion internet.',
      );
      return;
    }

    setIsLoading(true);

    try {
      // Validation complète avant soumission
      await validateLogin({
        email: email || '',
        password: password || '',
      });

      // Tentative de connexion
      const data = await signIn('credentials', {
        email,
        password,
        callbackUrl: callBackUrl ? parseCallbackUrl(callBackUrl) : '/',

        csrfToken,
        redirect: false, // Désactiver la redirection automatique pour gérer les erreurs
      });

      if (data?.error) {
        // Analyser le type d'erreur pour afficher un message approprié
        if (
          data.error.includes('rate limit') ||
          data.error.includes('too many')
        ) {
          toast.error(
            'Trop de tentatives de connexion. Veuillez réessayer ultérieurement.',
          );
        } else if (data.error.includes('locked')) {
          toast.error(
            'Votre compte est temporairement verrouillé suite à plusieurs tentatives.',
          );
        } else if (
          data.error.toLowerCase().includes('email') ||
          data.error.toLowerCase().includes('password')
        ) {
          toast.error(
            'Identifiants incorrects. Veuillez vérifier votre email et mot de passe.',
          );
        } else {
          toast.error(data.error || 'Échec de connexion');
        }
      } else if (data?.ok) {
        // Connexion réussie
        toast.success('Connexion réussie!');
        router.push('/');
      }
    } catch (error) {
      // Gérer les erreurs de validation
      if (error.name === 'ValidationError') {
        // Organiser les erreurs par champ
        const fieldErrors = {};
        error.inner?.forEach((err) => {
          fieldErrors[err.path] = err.message;
        });
        setErrors(fieldErrors);

        toast.error('Veuillez corriger les erreurs dans le formulaire.');
      } else {
        // Erreurs techniques
        console.error('Login error:', error);
        toast.error('Un problème est survenu. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 mb-20 p-4 md:p-7 rounded-lg bg-white shadow-lg">
      <form onSubmit={submitHandler} noValidate>
        {/* Alerte hors ligne */}
        {isOffline && (
          <div
            className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md"
            role="alert"
          >
            <p className="text-sm">
              Vous êtes actuellement hors ligne. La connexion nécessite une
              connexion internet.
            </p>
          </div>
        )}

        {/* Champ email */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block mb-1 font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            className={`appearance-none border ${errors.email ? 'border-red-500' : 'border-gray-200'} bg-gray-100 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="email"
            placeholder="Votre adresse email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            disabled={isLoading}
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
            Mot de passe
          </label>
          <input
            id="password"
            className={`appearance-none border ${errors.password ? 'border-red-500' : 'border-gray-200'} bg-gray-100 rounded-md py-2 px-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full transition-colors`}
            type="password"
            placeholder="Votre mot de passe"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'password-error' : undefined}
            minLength={6}
            disabled={isLoading}
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
        </div>

        {/* Lien mot de passe oublié */}
        <div className="mb-4 text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Mot de passe oublié?
          </Link>
        </div>

        {/* Bouton de connexion */}
        <button
          type="submit"
          className={`my-2 px-4 py-2 text-center w-full inline-flex justify-center items-center text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          disabled={isLoading}
          aria-busy={isLoading ? 'true' : 'false'}
        >
          {isLoading ? (
            <>
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
              Connexion en cours...
            </>
          ) : (
            'Se connecter'
          )}
        </button>

        <hr className="mt-6 mb-5 border-gray-200" />

        {/* Lien d'inscription */}
        <p className="text-center text-gray-600">
          Vous n&apos;avez pas de compte?{' '}
          <Link
            href="/register"
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            S&apos;inscrire
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
