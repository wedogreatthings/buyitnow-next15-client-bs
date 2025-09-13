'use client'; // Error boundaries must be Client Components

import { useEffect, useState } from 'react';
import { captureException } from '@/monitoring/sentry';
import { getErrorDisplayInfo } from '@/monitoring/errorUtils';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

/**
 * Gestionnaire d'erreurs spécifique à la page de connexion
 * Capture et affiche les erreurs d'authentification tout en les envoyant à Sentry
 */
export default function LoginError({ error, reset }) {
  const [errorDetails, setErrorDetails] = useState({
    title: 'Erreur de connexion',
    message: 'Une erreur est survenue lors de la tentative de connexion.',
    level: 'error',
    action: 'retry',
  });

  useEffect(() => {
    // Identifier le type d'erreur pour un traitement approprié
    const categorizeError = () => {
      // Ajouter des informations pour le contexte d'authentification
      error.componentName = error.componentName || 'LoginPage';
      error.additionalInfo = {
        ...(error.additionalInfo || {}),
        context: 'authentication',
        page: 'login',
      };

      // Utiliser l'utilitaire existant si disponible
      let baseErrorInfo = {};
      try {
        baseErrorInfo = getErrorDisplayInfo(error);
      } catch (e) {
        // Fallback si l'utilitaire n'est pas disponible
        console.error('Error in getErrorDisplayInfo:', e);
      }

      // Analyser le message d'erreur pour des problèmes spécifiques d'authentification
      const errorMsg = error.message?.toLowerCase() || '';

      if (errorMsg.includes('csrf') || errorMsg.includes('token invalid')) {
        return {
          title: 'Erreur de sécurité',
          message:
            'Une erreur de sécurité a été détectée. Veuillez rafraîchir la page et réessayer.',
          level: 'error',
          action: 'refresh',
        };
      }

      if (
        errorMsg.includes('rate limit') ||
        errorMsg.includes('too many attempts')
      ) {
        return {
          title: 'Trop de tentatives',
          message:
            'Vous avez effectué trop de tentatives de connexion. Veuillez réessayer plus tard.',
          level: 'warning',
          action: 'wait',
        };
      }

      if (errorMsg.includes('locked') || errorMsg.includes('blocked')) {
        return {
          title: 'Compte temporairement bloqué',
          message:
            'Votre compte a été temporairement bloqué suite à plusieurs tentatives infructueuses.',
          level: 'warning',
          action: 'wait',
        };
      }

      if (
        errorMsg.includes('credentials') ||
        errorMsg.includes('invalid email') ||
        errorMsg.includes('password')
      ) {
        return {
          title: 'Identifiants incorrects',
          message: "L'email ou le mot de passe saisi est incorrect.",
          level: 'warning',
          action: 'retry',
        };
      }

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

      if (errorMsg.includes('database') || errorMsg.includes('server')) {
        return {
          title: 'Erreur serveur',
          message:
            'Nos serveurs rencontrent actuellement des difficultés. Veuillez réessayer ultérieurement.',
          level: 'error',
          action: 'wait',
        };
      }

      // Utiliser les informations de base ou un message par défaut
      return {
        title: baseErrorInfo.title || 'Erreur de connexion',
        message:
          baseErrorInfo.message ||
          'Une erreur est survenue. Veuillez réessayer.',
        level: baseErrorInfo.level || 'error',
        action: 'retry',
      };
    };

    // Envoyer l'erreur à Sentry avec des métadonnées enrichies
    const sendToSentry = (errorInfo) => {
      captureException(error, {
        tags: {
          component: 'login',
          errorType: 'auth_error',
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
    };

    // Journaliser l'erreur dans les logs
    const logError = (errorInfo) => {
      console.error('Authentication error occurred', {
        error: error.message,
        errorType: errorInfo.title,
        action: errorInfo.action,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        timestamp: new Date().toISOString(),
      });
    };

    // Nettoyer la session si nécessaire
    const cleanupSession = (errorInfo) => {
      // Si l'erreur indique un problème de session/token, nettoyer la session
      if (
        errorInfo.action === 'refresh' ||
        error.message?.includes('token') ||
        error.message?.includes('session')
      ) {
        // Tentative de nettoyage en arrière-plan
        signOut({ redirect: false }).catch((e) =>
          console.warn('Failed to sign out after login error', {
            error: e.message,
          }),
        );
      }
    };

    // Traitement principal à l'initialisation du composant
    const errorInfo = categorizeError();
    setErrorDetails(errorInfo);
    sendToSentry(errorInfo);
    logError(errorInfo);
    cleanupSession(errorInfo);

    // Log plus détaillé en mode développement
    if (process.env.NODE_ENV === 'development') {
      console.error('Login error details:', {
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
          {/* Afficher le bouton "Réessayer" sauf si l'action est "wait" */}
          {errorDetails.action !== 'wait' && (
            <button
              onClick={() => reset()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 flex items-center justify-center"
              aria-label="Réessayer la connexion"
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

          {/* Bouton de rafraîchissement spécifique si action="refresh" */}
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

          <Link
            href="/register"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-md transition duration-200 text-center"
          >
            Créer un compte
          </Link>

          <Link
            href="/"
            className="w-full bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 font-semibold py-3 px-4 rounded-md transition duration-200 text-center"
          >
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
