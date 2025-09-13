'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { captureException } from '@/monitoring/sentry';
import { getErrorDisplayInfo } from '@/monitoring/errorUtils';
import Link from 'next/link';

export default function Error({ error, reset }) {
  // On utilise maintenant l'utilitaire centralisé pour obtenir les informations d'erreur
  // Cette fonction a été déplacée dans errorUtils.js

  // Envoyer l'erreur à Sentry dès que le composant est monté
  useEffect(() => {
    // Obtenir les informations d'erreur selon le composant source
    const errorInfo = getErrorDisplayInfo(error);

    // Capture l'erreur avec Sentry avec des métadonnées enrichies
    captureException(error, {
      tags: {
        ...errorInfo.tags,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        timestamp: new Date().toISOString(),
      },
      extra: {
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        componentStack: error.componentStack || null,
        additionalInfo: error.additionalInfo || null,
        userAgent:
          typeof window !== 'undefined' ? window.navigator.userAgent : '',
        // Ajouter des métadonnées pour le débogage
        route: typeof window !== 'undefined' ? window.location.href : '',
        referrer: typeof window !== 'undefined' ? document.referrer : '',
      },
      level: error.fatal ? 'fatal' : errorInfo.level,
    });

    // Log plus détaillé en mode développement
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured by error boundary:', {
        message: error.message,
        component: error.componentName || 'Unknown',
        stack: error.stack,
        additionalInfo: error.additionalInfo,
      });
    }
  }, [error]);

  // Déterminer le contenu à afficher selon le type d'erreur
  const errorInfo = getErrorDisplayInfo(error);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
        <div className="flex items-center mb-4">
          <svg
            className="w-8 h-8 text-red-500 mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <h2 className="text-xl font-semibold text-red-700">
            {errorInfo.title}
          </h2>
        </div>

        <p className="text-gray-700 mb-4">{errorInfo.message}</p>

        <div className="flex space-x-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            aria-label="Réessayer de charger la page"
          >
            Réessayer
          </button>

          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Retour à la page d&apos;accueil
          </Link>
        </div>

        {/* Conditionnellement, afficher plus de détails en mode développement */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-gray-100 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Détails de l&apos;erreur (visible uniquement en développement):
            </h3>
            <pre className="text-xs text-gray-600 overflow-auto max-h-40">
              {error.message}
              {error.componentName && `\nComposant: ${error.componentName}`}
              {error.additionalInfo &&
                `\nContexte: ${JSON.stringify(error.additionalInfo, null, 2)}`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
