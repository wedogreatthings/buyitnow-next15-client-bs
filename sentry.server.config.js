// sentry.server.config.js
// Configuration Sentry serveur standard - Erreurs uniquement
// Next.js 15 - buyitnow-client-n15-prv1

import * as Sentry from '@sentry/nextjs';

// Configuration d'environnement
const environment = process.env.NODE_ENV || 'development';
const isProd = environment === 'production';

// Fonction simple pour détecter les données sensibles
const containsSensitiveData = (str) => {
  if (!str || typeof str !== 'string') return false;

  const sensitivePatterns = [
    /password/i,
    /token/i,
    /auth/i,
    /key/i,
    /secret/i,
    /waafi|cac-pay|bci-pay|d-money/i,
    /mongodb/i,
    /connection/i,
    /email[=:]/i,
    /user[=:]/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(str));
};

// Classification simple des erreurs
const categorizeError = (error) => {
  if (!error) return 'unknown';

  const message = (error.message || '').toLowerCase();
  const name = (error.name || '').toLowerCase();
  const combined = message + ' ' + name;

  if (/mongo|database|db|connection|timeout/.test(combined)) return 'database';
  if (/network|fetch|http|request|api/.test(combined)) return 'network';
  if (/auth|permission|unauthorized|forbidden/.test(combined))
    return 'authentication';
  if (/validation|schema|required|invalid/.test(combined)) return 'validation';

  return 'application';
};

// Validation DSN simple
const isValidDSN = (dsn) => {
  return dsn && /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
};

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment,
    release: process.env.NEXT_PUBLIC_VERSION || '0.1.0',

    // Configuration serveur - Erreurs uniquement
    debug: !isProd,
    enabled: isProd,

    // Pas de performance monitoring
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // Pas de session replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Logs désactivés pour simplifier
    enableLogs: false,

    // Intégrations minimales
    integrations: [],

    // Traitement des breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filtrer les requêtes vers des routes sensibles
      if (
        ['xhr', 'fetch'].includes(breadcrumb.category) &&
        breadcrumb.data?.url
      ) {
        const url = breadcrumb.data.url;

        // Ignorer les routes sensibles
        if (/\/(api\/)?(auth|login|payment|confirmation)/.test(url)) {
          return null;
        }

        // Filtrer les données dans le body des requêtes
        if (
          breadcrumb.data.body &&
          containsSensitiveData(breadcrumb.data.body)
        ) {
          breadcrumb.data.body = '[FILTERED]';
        }
      }

      // Filtrer les logs console sensibles
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        if (containsSensitiveData(breadcrumb.message)) {
          return null;
        }
      }

      return breadcrumb;
    },

    // Traitement des événements avant envoi
    beforeSend(event, hint) {
      const error = hint && hint.originalException;

      // Ignorer les erreurs des routes sensibles
      if (event.request?.url) {
        const url = event.request.url;
        if (/\/(api\/)?(auth|login|payment|confirmation)/.test(url)) {
          return null;
        }
      }

      // Catégoriser l'erreur
      if (error) {
        event.tags = event.tags || {};
        event.tags.error_category = categorizeError(error);
      }

      // Anonymiser les headers
      if (event.request?.headers) {
        const sensitiveHeaders = [
          'cookie',
          'authorization',
          'x-auth-token',
          'session',
        ];
        sensitiveHeaders.forEach((header) => {
          if (event.request.headers[header]) {
            event.request.headers[header] = '[FILTERED]';
          }
        });
      }

      // Anonymiser les données utilisateur
      if (event.user) {
        delete event.user.ip_address;
        if (event.user.email) {
          event.user.email = '[FILTERED]';
        }
        if (event.user.username) {
          event.user.username = '[FILTERED]';
        }
      }

      // Filtrer les messages sensibles
      if (event.message && containsSensitiveData(event.message)) {
        event.message = '[Message filtré contenant des données sensibles]';
      }

      // Tags du projet
      event.tags = {
        ...event.tags,
        project: 'buyitnow-client-n15-prv1',
        runtime: 'nodejs',
      };

      return event;
    },

    // Erreurs à ignorer (conservées telles quelles)
    ignoreErrors: [
      // Erreurs réseau
      'Connection refused',
      'Connection reset',
      'ECONNREFUSED',
      'ECONNRESET',
      'socket hang up',
      'ETIMEDOUT',
      'read ECONNRESET',
      'connect ETIMEDOUT',

      // Erreurs de parsing
      'Unexpected token',
      'SyntaxError',
      'JSON.parse',

      // Erreurs de certificat
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'CERT_HAS_EXPIRED',
      'ssl3_get_server_certificate',

      // Erreurs de DNS
      'getaddrinfo ENOTFOUND',
      'getaddrinfo EAI_AGAIN',

      // Erreurs de base de données
      'database timeout',
      'MongoNetworkError',
      'MongoError',
      'SequelizeConnectionError',

      // Erreurs Next.js
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
      'Cancelled',
      'Route cancelled',

      // Erreurs d'opérations abandonnées
      'AbortError',
      'Operation was aborted',
    ],
  });

  console.log('✅ Sentry server initialized (errors only)');
} else {
  console.warn('⚠️ Sentry server: Invalid or missing DSN');
}
