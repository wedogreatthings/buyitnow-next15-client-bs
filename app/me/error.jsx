'use client';

import { useEffect, useState } from 'react';
import monitoring from '@/monitoring/sentry';

// Constante pour le nombre max de tentatives
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 10000; // 10 secondes

export default function UserProfileError({ error, reset }) {
  // AJOUT: Compteur de tentatives
  const [retryCount, setRetryCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(RETRY_DELAY_MS / 1000);

  // Send error to monitoring system
  useEffect(() => {
    // MODIFICATION: Utiliser une variable d'environnement pour le logging
    const shouldLog = process.env.NEXT_PUBLIC_ENABLE_ERROR_LOGGING === 'true';

    if (shouldLog && process.env.NODE_ENV === 'production') {
      const logError = () => {
        monitoring.captureException(error, {
          tags: {
            component: 'UserProfileError',
            route: '/me',
            retryCount, // AJOUT: Tracker le nombre de tentatives
          },
          level: 'error',
        });
      };

      logError();
    }
  }, [error, retryCount]);

  // Safe error display
  const errorMessage =
    error?.message && !containsSensitiveInfo(error.message)
      ? error.message
      : 'An unexpected error occurred';

  // AJOUT: Timer pour le countdown visuel
  useEffect(() => {
    if (retryCount >= MAX_RETRY_ATTEMPTS) return;

    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [retryCount]);

  // MODIFICATION: Auto-recovery avec limite de tentatives
  useEffect(() => {
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      // AJOUT: Log quand on atteint la limite
      if (process.env.NODE_ENV === 'development') {
        console.warn('Max retry attempts reached');
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        setRetryCount((prev) => prev + 1);
        reset();
      } catch (e) {
        // Silent catch
      }
    }, RETRY_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [reset, retryCount]);

  // AJOUT: Fonction de reset manuel avec compteur
  const handleManualReset = () => {
    setRetryCount((prev) => prev + 1);
    setTimeRemaining(RETRY_DELAY_MS / 1000);
    reset();
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border border-red-100">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 rounded-full bg-red-50 p-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-medium text-gray-900">
            Something went wrong
          </h2>

          <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>

          {/* AJOUT: Affichage du nombre de tentatives */}
          {retryCount > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Retry attempt: {retryCount}/{MAX_RETRY_ATTEMPTS}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleManualReset}
              disabled={retryCount >= MAX_RETRY_ATTEMPTS}
              className={`inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors ${
                retryCount >= MAX_RETRY_ATTEMPTS
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              type="button"
            >
              {retryCount >= MAX_RETRY_ATTEMPTS
                ? 'Max retries reached'
                : 'Try again'}
            </button>

            <button
              onClick={() => (window.location.href = '/')}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              type="button"
            >
              Return home
            </button>
          </div>

          {/* MODIFICATION: Countdown animé */}
          {retryCount < MAX_RETRY_ATTEMPTS && (
            <div className="mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-2">
                Auto-retry in{' '}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {timeRemaining}s
                </span>
                {/* AJOUT: Barre de progression */}
                <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-1000"
                    style={{
                      width: `${(timeRemaining / (RETRY_DELAY_MS / 1000)) * 100}%`,
                    }}
                  />
                </div>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function containsSensitiveInfo(str) {
  if (!str || typeof str !== 'string') return false;

  const patterns = [
    /password/i,
    /token/i,
    /api[_-]?key/i,
    /secret/i,
    /auth/i,
    /cookie/i,
    /session/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/,
    /\b\d{3}[ -]?\d{2}[ -]?\d{4}\b/,
  ];

  return patterns.some((pattern) => pattern.test(str));
}
