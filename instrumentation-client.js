// instrumentation-client.js
// Configuration Sentry client simplifiée - Erreurs uniquement
// Next.js 15 - buyitnow-client-n15-prv1

import * as Sentry from '@sentry/nextjs';

// Configuration d'environnement
const environment = process.env.NODE_ENV || 'development';
const isProd = environment === 'production';

// Détection simple du navigateur pour le contexte
const detectBrowser = () => {
  if (typeof window === 'undefined') return 'server';
  const userAgent = window.navigator.userAgent.toLowerCase();

  if (userAgent.includes('firefox')) return 'firefox';
  if (userAgent.includes('chrome')) return 'chrome';
  if (userAgent.includes('safari') && !userAgent.includes('chrome'))
    return 'safari';
  if (userAgent.includes('edge')) return 'edge';

  return 'unknown';
};

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
    /\b(?:\d{4}[ -]?){3}\d{4}\b/,
    /email[=:]/i,
    /login/i,
    /confirmation/i,
    /payment/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(str));
};

// Configuration Sentry client
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment,
  release: process.env.NEXT_PUBLIC_VERSION || '0.1.0',

  // Erreurs uniquement - Pas de performance monitoring
  tracesSampleRate: 0,

  // Pas de session replay
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Configuration de base
  debug: !isProd,
  enabled: isProd,

  // Intégrations vides - Erreurs uniquement
  integrations: [],

  // Traitement des événements avant envoi
  beforeSend(event, hint) {
    // Ajouter le contexte navigateur
    if (typeof window !== 'undefined') {
      event.tags = event.tags || {};
      event.tags.browser = detectBrowser();
      event.tags.viewport = `${window.innerWidth}x${window.innerHeight}`;
    }

    // Anonymiser les données utilisateur
    if (event.user) {
      delete event.user.ip_address;
      if (event.user.email) {
        event.user.email = '[FILTERED]';
      }
    }

    // Filtrer les URLs sensibles
    if (event.request && event.request.url) {
      if (containsSensitiveData(event.request.url)) {
        try {
          const url = new URL(event.request.url);

          // Filtrer les paramètres sensibles
          ['token', 'password', 'auth', 'key', 'secret', 'email'].forEach(
            (param) => {
              if (url.searchParams.has(param)) {
                url.searchParams.set(param, '[FILTERED]');
              }
            },
          );

          // Généraliser les pages sensibles
          if (/\/(payment|confirmation|account|profile)/i.test(url.pathname)) {
            event.request.url = `${url.origin}/[SENSITIVE_PAGE]`;
          } else {
            event.request.url = url.toString();
          }
        } catch (e) {
          // URL invalide, laisser tel quel
        }
      }
    }

    // Nettoyer les messages d'erreur
    if (event.message && containsSensitiveData(event.message)) {
      event.message = '[Message contenant des données sensibles]';
    }

    // Tags du projet
    event.tags = {
      ...event.tags,
      project: 'buyitnow-client-n15-prv1',
      runtime: 'browser',
    };

    return event;
  },

  // Liste des erreurs à ignorer (conservée telle quelle)
  ignoreErrors: [
    // Erreurs réseau
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    'TypeError: Failed to fetch',
    'Load failed',
    'net::ERR_',
    'TypeError: NetworkError',
    'TypeError: Network request failed',
    'Network Error',
    'network error',
    'timeout',
    'Timeout',
    'timeout of 0ms exceeded',
    'Fetch API cannot load',
    'TIMEOUT',
    'Request timed out',

    // Erreurs de navigation
    'ResizeObserver loop limit exceeded',
    'ResizeObserver Loop Limit Exceeded',
    'Non-Error promise rejection captured',
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
    'page unloaded',
    'document unloaded',
    'unmounted',
    'component unmounted',
    'Minified React error',
    'Canceled',
    'Operation was aborted',
    'navigation cancelled',
    'Route Cancelled',
    'aborted',
    'User aborted',
    'User denied',
    'cancel rendering route',
    'history push',

    // Erreurs de chargement
    'Loading chunk',
    'ChunkLoadError',
    'Loading CSS chunk',
    'Failed to load module script',
    'Loading module',
    'Module not found',
    'Cannot find module',
    'Failed to load resource',
    'Import error',
    'Dynamic require',

    // Erreurs de référence communes
    'Cannot read property',
    'null is not an object',
    'undefined is not an object',
    'Object Not Found Matching Id',
    'not a function',
    'is not a function',
    "can't access property",
    'is not defined',
    'is undefined',
    'has no properties',

    // Erreurs du navigateur
    'Script error',
    'JavaScript error',
    'Out of memory',
    'Quota exceeded',
    'Maximum call stack',
    'Stack overflow',
    'DOM Exception',
    'SecurityError',

    // Erreurs de plugins/extensions
    'extension',
    'plugin',
    'chrome-extension',
    'chrome://extensions',
    'moz-extension',
    'safari-extension',

    // Erreurs traquées ailleurs
    'top.GLOBALS',
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    'http://tt.epicplay.com',
    "Can't find variable: ZiteReader",
    'jigsaw is not defined',
    'ComboSearch is not defined',
    'http://loading.retry.widdit.com/',
    'atomicFindClose',
    'fb_xd_fragment',
    'bmi_SafeAddOnload',
    'EBCallBackMessageReceived',
    'conduitPage',
    /__gcrweb/i,
    /blocked a frame with origin/i,
  ],

  // URLs à ignorer
  denyUrls: [
    // Extensions de navigateur
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
    /^opera:\/\//i,
    /^edge:\/\//i,

    // Services tiers
    /googleusercontent\.com/i,
    /googlesyndication\.com/,
    /adservice\.google\./,
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /hotjar\.com/,
    /facebook\.net/,
    /doubleclick\.net/,
    /bat\.bing\.com/,
    /connect\.facebook\.net/,
    /platform\.twitter\.com/,
    /static\.ads-twitter\.com/,
    /analytics\.tiktok\.com/,
    /snap\.licdn\.com/,
    /static\.cloudflareinsights\.com/,

    // Outils de marketing et analytics
    /hubspot\.com/,
    /cdn\.amplitude\.com/,
    /cdn\.optimizely\.com/,
    /cdn\.mouseflow\.com/,
    /app\.chameleon\.io/,
    /js\.intercomcdn\.com/,
    /cdn\.heapanalytics\.com/,
    /js\.driftt\.com/,
    /widget\.intercom\.io/,
    /js\.sentry-cdn\.com/,
    /browser\.sentry-cdn\.com/,
    /local\.walkme\.com/,

    // Domaines de contenus et CDNs
    /cdn\.cookielaw\.org/,
    /cdn\.jsdelivr\.net/,
    /cdnjs\.cloudflare\.com/,
    /code\.jquery\.com/,
    /unpkg\.com/,
  ],
});

console.log(`✅ Sentry client initialized (errors only) - ${environment}`);
