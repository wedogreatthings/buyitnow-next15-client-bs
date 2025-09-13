'use client'; // Error boundaries must be Client Components

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { captureException } from '@/monitoring/sentry';
import { useRouter } from 'next/navigation';

export default function Error({ error, reset }) {
  const router = useRouter();
  const [errorReference] = useState(() => Date.now().toString(36)); // Générer un identifiant unique
  const [hasRetried, setHasRetried] = useState(false);

  // Déterminer le type d'erreur pour une meilleure gestion
  const errorType = determineErrorType(error);

  // Log et monitoring de l'erreur au montage du composant
  useEffect(() => {
    // Collecter les informations de telemetry
    const telemetry = collectTelemetry();

    // Log de l'erreur en console en développement
    console.error('Product page error:', error);

    // Récupérer l'URL complète et l'ID du produit
    const url = window.location.href;
    const segments = window.location.pathname.split('/');
    const productId = segments[segments.length - 1];

    // Capture de l'erreur par Sentry avec contexte enrichi
    captureException(error, {
      tags: {
        component: 'ProductPage',
        errorType: errorType.code,
        action: 'page_load',
        errorReference,
        hasRetried,
      },
      extra: {
        message: error.message,
        productId,
        url,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent,
        screen: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer || 'direct',
        ...telemetry,
      },
      level: errorType.severity,
    });

    // Analytique côté client (peut être remplacé par votre outil d'analyse)
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'error', {
        event_category: 'product_page',
        event_label: errorType.code,
        value: productId,
      });
    }
  }, [error, errorType, errorReference, hasRetried]);

  // Fonction pour collecter des informations de telemetry
  function collectTelemetry() {
    try {
      return {
        connectionType: navigator.connection
          ? navigator.connection.effectiveType
          : 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        isOnline: navigator.onLine,
        language: navigator.language,
        timestamp: new Date().toISOString(),
        timeOnPage: document.startTime
          ? Date.now() - document.startTime
          : 'unknown',
      };
    } catch (e) {
      return { telemetryError: e.message };
    }
  }

  // Déterminer le type d'erreur pour adapter la réponse
  function determineErrorType(err) {
    // Erreur liée à un produit qui n'existe pas
    if (
      err.message?.includes('not found') ||
      err.statusCode === 404 ||
      err.cause?.statusCode === 404
    ) {
      return {
        code: 'PRODUCT_NOT_FOUND',
        message:
          "Ce produit n'est pas disponible ou a été retiré de notre catalogue.",
        severity: 'info',
        recoverable: false,
      };
    }

    // Erreur de timeout
    if (err.message?.includes('timeout') || err.name === 'TimeoutError') {
      return {
        code: 'TIMEOUT',
        message:
          'Le chargement du produit a pris trop de temps. Veuillez réessayer.',
        severity: 'warning',
        recoverable: true,
      };
    }

    // Erreur de réseau
    if (
      err.message?.includes('network') ||
      err.name === 'NetworkError' ||
      err.message?.includes('fetch')
    ) {
      return {
        code: 'NETWORK',
        message:
          'Problème de connexion détecté. Vérifiez votre connexion internet et réessayez.',
        severity: 'warning',
        recoverable: true,
      };
    }

    // Erreur serveur
    if (err.statusCode >= 500 || err.cause?.statusCode >= 500) {
      return {
        code: 'SERVER_ERROR',
        message:
          'Nos serveurs rencontrent des difficultés. Nous travaillons à résoudre le problème.',
        severity: 'error',
        recoverable: true,
      };
    }

    // Par défaut
    return {
      code: 'UNKNOWN',
      error: err,
      message:
        "Une erreur inattendue s'est produite lors du chargement du produit.",
      severity: 'error',
      recoverable: true,
    };
  }

  // Fonction pour gérer le retry avec tracking
  const handleRetry = () => {
    setHasRetried(true);
    reset();
  };

  // Fonction pour naviguer vers la page d'accueil
  const goHome = () => {
    router.push('/');
  };

  // Fonction pour suggérer des produits similaires
  const findSimilarProducts = () => {
    // Si nous connaissons la catégorie, nous pourrions rediriger vers cette catégorie
    // Pour l'instant, rediriger vers la page d'accueil
    router.push('/');
  };

  return (
    <div className="container mx-auto py-10 px-4 text-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Oups ! Impossible d&apos;afficher ce produit
        </h1>

        <p className="text-gray-700 mb-6">{errorType.message}</p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          {errorType.recoverable && (
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Réessayer
            </button>
          )}

          <Link
            href="/"
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            onClick={goHome}
          >
            Retour à l&apos;accueil
          </Link>

          {errorType.code === 'PRODUCT_NOT_FOUND' && (
            <button
              onClick={findSimilarProducts}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Produits similaires
            </button>
          )}
        </div>

        {/* Afficher plus de détails en mode développement */}
        {process.env.NODE_ENV === 'production' && (
          <div className="mt-8 p-4 bg-gray-100 rounded text-left overflow-auto max-h-60">
            <h3 className="text-lg font-semibold mb-2">
              Détails de l&apos;erreur (visible uniquement en développement):
            </h3>
            <p className="font-mono text-sm">Type: {errorType.code}</p>
            <p className="font-mono text-sm">Message: {error.message}</p>
            {error.stack && (
              <pre className="text-xs mt-2 text-gray-600 whitespace-pre-wrap">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>
            Si le problème persiste, veuillez contacter notre service client.
          </p>
          <p className="mt-2">Référence erreur: {errorReference}</p>
        </div>
      </div>
    </div>
  );
}
