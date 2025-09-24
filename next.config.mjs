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
  // Configuration des headers de sécurité// next.config.js - Section headers optimisée
  async headers() {
    return [
      // ============================================
      // 1. HEADERS DE SÉCURITÉ GLOBAUX (toutes les pages HTML)
      // ============================================
      {
        source: '/(.*)',
        headers: [
          // HSTS - Force HTTPS (2 ans recommandé pour production)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Protection Clickjacking (remplacé par CSP frame-ancestors mais gardé pour compatibilité)
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Changé de DENY pour permettre vos propres iframes si besoin
          },
          // Protection contre le MIME sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Politique de referrer équilibrée (sécurité + analytics)
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy - Désactive les APIs non nécessaires pour un e-commerce
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
          // CSP optimisé pour votre stack
          {
            key: 'Content-Security-Policy',
            value: `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://upload-widget.cloudinary.com;
            style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
            img-src 'self' blob: data: https://res.cloudinary.com https://buyitnow-next15-client-bs.vercel.app;
            font-src 'self' data: https://cdnjs.cloudflare.com;
            connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com https://upload-widget.cloudinary.com ${process.env.NODE_ENV === 'production' ? 'https://*.sentry.io https://sentry.io' : ''};
            media-src 'self' https://res.cloudinary.com;
            object-src 'none';
            frame-src 'self' https://upload-widget.cloudinary.com;
            frame-ancestors 'self';
            base-uri 'self';
            form-action 'self';
            manifest-src 'self';
            worker-src 'self';
            upgrade-insecure-requests;
          `
              .replace(/\s{2,}/g, ' ')
              .trim(),
          },
          // Headers additionnels pour la sécurité
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '0', // Désactivé car déprécié et peut causer des vulnérabilités
          },
        ],
      },

      // ============================================
      // 2. APIs PUBLIQUES (products, category)
      // Appelées par Server Components (S2S)
      // ============================================
      {
        source: '/api/(products|category)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'max-age=600',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },

      // ============================================
      // 3. APIs D'AUTHENTIFICATION
      // Sécurité maximale, jamais de cache
      // ============================================
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
        ],
      },

      // ============================================
      // 4. APIs PRIVÉES (cart, orders, address, emails)
      // Données sensibles utilisateur
      // ============================================
      {
        source: '/api/(address|cart|orders|emails)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
        ],
      },

      // ============================================
      // 5. ASSETS STATIQUES NEXT.JS
      // Cache immutable pour les builds
      // ============================================
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },

      // ============================================
      // 6. IMAGES STATIQUES LOCALES
      // Dans votre dossier public/images
      // ============================================
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=7200',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
        ],
      },

      // ============================================
      // 7. FAVICONS ET ASSETS ROOT
      // ============================================
      {
        source:
          '/(favicon.ico|icon-*.png|apple-touch-icon.png|robots.txt|sitemap.xml)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=43200',
          },
        ],
      },

      // ============================================
      // 8. SERVICE WORKER
      // ============================================
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },

      // ============================================
      // 9. MANIFEST PWA
      // ============================================
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },

      // ============================================
      // 10. PAGES D'ERREUR
      // ============================================
      {
        source: '/(404|500|error)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },

      // ============================================
      // 11. PAGES SENSIBLES (auth, payment, checkout)
      // ============================================
      {
        source:
          '/(login|register|forgot-password|reset-password|cart|shipping|payment|confirmation)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
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
