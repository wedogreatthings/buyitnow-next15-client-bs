import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { withSentryConfig } from '@sentry/nextjs';
import withBundleAnalyzer from '@next/bundle-analyzer';

// ===== VALIDATION INTELLIGENTE DES VARIABLES D'ENVIRONNEMENT =====
const validateEnv = () => {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const IS_CI =
    process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

  console.log(`🔍 Environment Detection:
    - NODE_ENV: ${NODE_ENV}
    - IS_CI: ${IS_CI}
    - IS_BUILD_PHASE: ${IS_BUILD_PHASE}
  `);

  // 📋 CATÉGORISATION DES VARIABLES
  const BUILD_TIME_VARS = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'NEXT_PUBLIC_CLOUDINARY_API_KEY',
    'NEXT_PUBLIC_SENTRY_DSN',
    'NEXT_PUBLIC_ENABLE_SW',
  ];

  const RUNTIME_VARS = [
    'API_URL',
    'DB_URI',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'CLOUDINARY_API_SECRET',
    'RESEND_API_KEY',
    'SENTRY_URL',
    'SENTRY_PROJECT',
    'SENTRY_ORG',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_IGNORE_API_RESOLUTION_ERROR',
    'DEFAULT_PRODUCTS_PER_PAGE',
    'MAX_PRODUCTS_PER_PAGE',
    'QUERY_TIMEOUT',
    'CACHE_MAX_AGE_CATEGORIES',
    'CACHE_MAX_AGE_PRODUCTS',
  ];

  const ALWAYS_REQUIRED = ['NODE_ENV'];

  // 🎯 LOGIQUE DE VALIDATION SELON LE CONTEXTE
  let requiredVars = [];

  if (NODE_ENV === 'development') {
    // 🔧 DÉVELOPPEMENT : Validation permissive
    requiredVars = [...ALWAYS_REQUIRED];
    console.log('🔧 Dev mode: Basic validation only');
  } else if (IS_CI && NODE_ENV === 'production') {
    // 🏗️ BUILD CI/CD : Variables nécessaires au build
    requiredVars = [...ALWAYS_REQUIRED, ...BUILD_TIME_VARS];
    console.log('🏗️ CI Build mode: Validating BUILD_TIME_VARS');
  } else if (NODE_ENV === 'production' && !IS_CI) {
    // 🚀 PRODUCTION RUNTIME : Validation complète
    requiredVars = [...ALWAYS_REQUIRED, ...RUNTIME_VARS, ...BUILD_TIME_VARS];
    console.log('🚀 Production runtime: Validating ALL variables');
  }

  // ✅ VÉRIFICATION DES VARIABLES
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    const context = IS_CI ? 'CI Build' : NODE_ENV;
    console.warn(
      `⚠️ [${context}] Missing environment variables: ${missingVars.join(
        ', ',
      )}`,
    );

    // 🛡️ ÉCHEC STRICT EN PRODUCTION RUNTIME SEULEMENT
    if (NODE_ENV === 'production' && !IS_CI) {
      throw new Error(
        `❌ Production runtime failed: Missing critical environment variables: ${missingVars.join(
          ', ',
        )}`,
      );
    }
  } else {
    const context = IS_CI ? 'CI Build' : NODE_ENV;
    console.log(
      `✅ [${context}] All required environment variables are present`,
    );
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🚀 EXÉCUTER LA VALIDATION
validateEnv();

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  analyzerMode: 'static',
  openAnalyzer: false,
});

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer, strict-origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: `default-src 'self'; manifest-src 'self'; worker-src ${process.env.NEXT_PUBLIC_SITE_URL}; frame-src 'self' https://upload-widget.cloudinary.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css https://upload-widget.cloudinary.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; media-src 'self' https://res.cloudinary.com ; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://res.cloudinary.com https://sentry.io https://*.ingest.sentry.io https://*.sentry.io;`,
  },
];

const nextConfig = {
  // Configuration de base
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  // Configuration des packages externes
  serverExternalPackages: ['mongoose'],

  // Configuration des images Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 1 jour
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Configuration du compilateur
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn', 'log'], // Garde error et warn en production
          }
        : false,
  },

  // Timeout pour la génération de pages statiques (réduit de 180 à 60)
  staticPageGenerationTimeout: 180,
  // Configuration des headers de sécurité
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Dans la section headers, pour les API non-critiques:
      {
        source: '/api/products',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=120', // Pour les requêtes GET publiques
          },
          // Autres en-têtes...
          {
            key: 'Access-Control-Allow-Origin',
            value: 'www.google.fr', // Set your origin
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: `${process.env.NEXT_PUBLIC_API_URL}`, // Set your origin
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },
  // Configuration des redirections
  async redirects() {
    return [
      {
        source: '/404',
        destination: '/',
        permanent: false,
      },
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Configuration du runtime serveur
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },

  // Configuration Webpack simplifiée
  webpack: (config, { dev, isServer }) => {
    // Configuration minimale pour la production
    if (!dev) {
      // Optimisations de base
      config.optimization.moduleIds = 'deterministic';

      // Split chunks simple
      if (!isServer) {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        };
      }

      // Cache filesystem pour builds plus rapides
      config.cache = {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      };

      // Réduction des logs
      config.infrastructureLogging = {
        level: 'error',
      };
    }

    return config;
  },

  // ESLint - Ne pas ignorer les erreurs
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Logging en développement seulement
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

// Configuration Sentry - ERREURS SEULEMENT (pas de performance/replay)
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG || 'benew',
  project: process.env.SENTRY_PROJECT || 'buyitnow',
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Configuration silencieuse en production
  silent: true,

  // Désactivation des plugins si pas d'auth token
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,

  // Upload des sourcemaps
  widenClientFileUpload: true,
  transpileClientSDK: true,
  hideSourceMaps: true,

  // Mode dry-run si pas en production ou pas de token
  dryRun:
    process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,

  // Debug seulement en développement
  debug: false,

  // Ignorer l'erreur de résolution API si configuré
  // tunnelRoute: '/monitoring',

  // Configuration des fichiers à inclure
  include: '.next',
  ignore: ['node_modules', '.next/cache'],
};

// Export avec Sentry et Bundle Analyzer
export default withSentryConfig(
  bundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions,
);
