// next-sitemap.config.js
const { captureException } = require('./monitoring/sentry');

/**
 * Configuration pour next-sitemap
 *
 * Ce fichier configure la génération automatique du sitemap.xml et robots.txt
 * pour le site Buy It Now. Il définit:
 * - Les URLs à inclure/exclure
 * - Les priorités et fréquences de changement par type de page
 * - La configuration robots.txt avec des règles spécifiques
 * - Les optimisations de performance pour la génération
 *
 * @see https://github.com/iamvishnusankar/next-sitemap pour la documentation complète
 */

// Définir la constante en haut du fichier
const DEFAULT_SITE_URL = 'https://buyitnow-next15-client-bs.vercel.app';
let SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

try {
  // Vérifier si l'URL est valide
  if (SITE_URL) {
    new URL(SITE_URL);
  } else {
    console.warn('NEXT_PUBLIC_SITE_URL not defined, using default URL');
    SITE_URL = DEFAULT_SITE_URL;
  }
} catch (e) {
  console.error(`Invalid NEXT_PUBLIC_SITE_URL: ${SITE_URL}`, e);
  console.warn('Falling back to default URL');
  SITE_URL = DEFAULT_SITE_URL;
}

module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,

  // Configuration plus complète pour robots.txt
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/address',
          '/api',
          '/cart',
          '/me',
          '/shipping',
          '/shipping-choice',
          '/payment',
          '/confirmation',
          '/error',
          '/404',
          '/500',
          '/search', // Pages de résultats de recherche dynamiques
          '/*?*', // Bloquer les URLs avec paramètres de requête
        ],
      },
      // Ajout de règles spécifiques pour les robots gourmands
      {
        userAgent: 'GPTBot',
        disallow: ['/'], // Bloquer ChatGPT si souhaité
      },
    ],
    additionalSitemaps: [`${SITE_URL}/server-sitemap.xml`],
  },

  exclude: [
    '/address/*',
    '/api/*',
    '/cart',
    '/me/*',
    '/shipping',
    '/shipping-choice',
    '/payment',
    '/confirmation',
    '/error',
    '/404',
    '/500',
    '/search',
  ],

  // Optimisation de performance: une seule instance de Date pour toutes les URLs
  autoLastmod: true, // Utiliser la date de génération pour toutes les URLs

  // Configuration pour limiter la charge serveur
  sitemapSize: 5000, // Diviser les sitemaps volumineux
  generateIndexSitemap: true,

  // Fonction transform plus robuste
  transform: async (config) => {
    try {
      const url = config.loc || '';
      if (!url) {
        console.warn('Empty URL encountered in sitemap transform');
        return {
          loc: '',
          changefreq: 'weekly',
          priority: 0.1,
        };
      }

      // Pages de produit
      if (url.includes('/products/')) {
        return {
          loc: url,
          changefreq: 'daily',
          priority: 0.8,
          // Utiliser la date système ou une date issue des métadonnées de page
          ...(config.lastmod ? { lastmod: config.lastmod } : {}),
        };
      }

      // Pages de catégorie
      if (url.includes('/category/')) {
        return {
          loc: url,
          changefreq: 'weekly',
          priority: 0.7,
          ...(config.lastmod ? { lastmod: config.lastmod } : {}),
        };
      }

      // Page d'accueil
      if (url === '' || url === '/') {
        return {
          loc: url,
          changefreq: 'daily',
          priority: 1.0,
          ...(config.lastmod ? { lastmod: config.lastmod } : {}),
        };
      }

      // Configuration par défaut pour toutes les autres pages
      return {
        loc: url,
        changefreq: 'weekly',
        priority: 0.5,
        ...(config.lastmod ? { lastmod: config.lastmod } : {}),
      };
    } catch (error) {
      console.error(`Error transforming URL: ${config?.loc}`, error);

      // Utiliser Sentry pour capturer l'exception avec contexte
      if (process.env.NODE_ENV === 'production') {
        captureException(error, {
          tags: {
            component: 'sitemap-generator',
            url: config?.loc || 'unknown',
          },
          extra: {
            config: JSON.stringify(config),
          },
          level: 'error',
        });
      }

      // Fournir une configuration par défaut en cas d'erreur
      return {
        loc: config.loc || '',
        changefreq: 'weekly',
        priority: 0.5,
      };
    }
  },
};
