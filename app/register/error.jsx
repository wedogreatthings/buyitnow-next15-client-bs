'use client'; // Error boundaries must be Client Components

import { useEffect, useState } from 'react';
import { captureException } from '@/monitoring/sentry';
import { getErrorDisplayInfo } from '@/monitoring/errorUtils';
import Link from 'next/link';

/**
 * Gestionnaire d'erreurs spécifique à la page d'inscription
 * Capture et affiche les erreurs d'inscription tout en les envoyant à Sentry
 */
export default function RegisterError({ error, reset }) {
  const [errorDetails, setErrorDetails] = useState({
    title: "Erreur d'inscription",
    message: 'Une erreur est survenue lors de votre inscription.',
    level: 'error',
    action: 'retry',
  });

  useEffect(() => {
    // Enrichir l'erreur avec des informations pour le contexte d'inscription
    error.componentName = error.componentName || 'RegisterPage';
    error.additionalInfo = {
      ...(error.additionalInfo || {}),
      context: 'registration',
      page: 'register',
    };

    // Analyser le message d'erreur pour des problèmes spécifiques d'inscription
    const categorizeError = () => {
      const errorMsg = (error.message || '').toLowerCase();

      // Détection des erreurs d'emails dupliqués
      if (
        errorMsg.includes('duplicate') ||
        errorMsg.includes('already exists') ||
        errorMsg.includes('already registered')
      ) {
        return {
          title: 'Email déjà utilisé',
          message:
            'Cette adresse email est déjà associée à un compte. Veuillez vous connecter ou utiliser une autre adresse.',
          level: 'warning',
          action: 'login',
        };
      }

      // Erreurs de validation
      if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
        return {
          title: 'Données invalides',
          message:
            'Certaines informations saisies ne sont pas valides. Veuillez vérifier le formulaire et réessayer.',
          level: 'warning',
          action: 'retry',
        };
      }

      // Erreurs de sécurité
      if (errorMsg.includes('csrf') || errorMsg.includes('token invalid')) {
        return {
          title: 'Erreur de sécurité',
          message:
            'Une erreur de sécurité a été détectée. Veuillez rafraîchir la page et réessayer.',
          level: 'error',
          action: 'refresh',
        };
      }

      // Erreurs de rate limiting
      if (errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
        return {
          title: 'Trop de tentatives',
          message:
            "Vous avez effectué trop de tentatives d'inscription. Veuillez réessayer plus tard.",
          level: 'warning',
          action: 'wait',
        };
      }

      // Erreurs de connexion
      if (
        errorMsg.includes('network') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('timeout')
      ) {
        return {
          title: 'Problème de connexion',
          message: 'Vérifiez votre connexion internet et réessayez.',
          level: 'warning',
          action: 'retry',
        };
      }

      // Erreurs serveur
      if (
        errorMsg.includes('server') ||
        errorMsg.includes('database') ||
        errorMsg.includes('500')
      ) {
        return {
          title: 'Erreur serveur',
          message:
            'Nos serveurs rencontrent actuellement des difficultés. Veuillez réessayer ultérieurement.',
          level: 'error',
          action: 'wait',
        };
      }

      // Fallback pour les erreurs inconnues
      const baseErrorInfo = getErrorDisplayInfo(error);
      return {
        title: baseErrorInfo.title || "Erreur d'inscription",
        message:
          baseErrorInfo.message ||
          'Une erreur est survenue lors de votre inscription. Veuillez réessayer.',
        level: baseErrorInfo.level || 'error',
        action: 'retry',
      };
    };

    // Obtenir les détails de l'erreur catégorisée
    const errorInfo = categorizeError();
    setErrorDetails(errorInfo);

    // Envoyer l'erreur à Sentry avec des métadonnées enrichies
    captureException(error, {
      tags: {
        component: 'register',
        errorType: 'registration_error',
        level: errorInfo.level,
        action: errorInfo.action,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      },
      extra: {
        errorTitle: errorInfo.title,
        errorMessage: errorInfo.message,
        userAgent:
          typeof window !== 'undefined' ? window.navigator.userAgent : '',
        referrer: typeof window !== 'undefined' ? document.referrer : '',
        componentStack: error.componentStack || null,
        additionalInfo: error.additionalInfo || null,
      },
      level:
        errorInfo.level === 'fatal'
          ? 'fatal'
          : errorInfo.level === 'warning'
            ? 'warning'
            : 'error',
    });

    // Journaliser l'erreur
    console.error('Registration error occurred', {
      error: error.message,
      errorType: errorInfo.title,
      action: errorInfo.action,
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      timestamp: new Date().toISOString(),
    });

    // Log plus détaillé en mode développement
    if (process.env.NODE_ENV === 'development') {
      console.error('Registration error details:', {
        message: error.message,
        stack: error.stack,
        additionalInfo: error.additionalInfo,
        categorizedAs: errorInfo,
      });
    }
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 border border-red-100">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          {errorDetails.title}
        </h2>

        <p className="text-gray-600 text-center mb-8">{errorDetails.message}</p>

        <div className="flex flex-col space-y-3">
          {/* Bouton Réessayer - ne pas afficher pour l'action "wait" */}
          {errorDetails.action !== 'wait' && (
            <button
              onClick={() => reset()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 flex items-center justify-center"
              aria-label="Réessayer l'inscription"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              Réessayer
            </button>
          )}

          {/* Bouton Rafraîchir spécifique si action="refresh" */}
          {errorDetails.action === 'refresh' && (
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 flex items-center justify-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              Actualiser la page
            </button>
          )}

          {/* Bouton Se connecter spécifique si action="login" */}
          {errorDetails.action === 'login' && (
            <Link
              href="/login"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 text-center flex items-center justify-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                ></path>
              </svg>
              Se connecter
            </Link>
          )}

          <Link
            href="/"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-md transition duration-200 text-center flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              ></path>
            </svg>
            Retour à l&apos;accueil
          </Link>
        </div>

        {/* Affichage des détails d'erreur en mode développement */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-md border border-gray-300">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Détails techniques (visible uniquement en développement):
            </h3>
            <pre className="text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap">
              {error.message}
              {error.stack &&
                `\n\nStack: ${error.stack.split('\n').slice(0, 3).join('\n')}...`}
              {error.componentName && `\n\nComposant: ${error.componentName}`}
              {error.additionalInfo &&
                `\n\nContexte: ${JSON.stringify(error.additionalInfo, null, 2)}`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
