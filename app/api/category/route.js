import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Category from '@/backend/models/category';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/category
 * Récupère toutes les catégories actives
 * Rate limit: 60 req/min (public) ou 120 req/min (authenticated)
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/category/* :
 * - Cache-Control: public, max-age=300, stale-while-revalidate=600
 * - CDN-Cache-Control: max-age=600
 * - X-Content-Type-Options: nosniff
 * - Vary: Accept-Encoding
 *
 * Headers globaux de sécurité (toutes routes) :
 * - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
 * - X-Frame-Options: SAMEORIGIN
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: [configuration restrictive]
 * - Content-Security-Policy: [configuration complète]
 *
 * Note: Les catégories sont des données publiques avec cache long
 * car elles changent rarement dans un e-commerce
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Connexion DB
    await dbConnect();

    // Récupérer les catégories actives avec plus de détails
    const categories = await Category.find({ isActive: true })
      .select('categoryName')
      .sort({ categoryName: 1 })
      .lean();

    // Vérifier s'il y a des catégories
    if (!categories || categories.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No categories available',
          data: {
            categories: [],
            count: 0,
            meta: {
              timestamp: new Date().toISOString(),
              cached: false,
            },
          },
        },
        {
          status: 200,
          // Pas de headers manuels - gérés par next.config.mjs
        },
      );
    }

    // Formater les catégories pour optimiser la réponse
    const formattedCategories = categories.map((cat) => ({
      _id: cat._id,
      name: cat.categoryName,
      slug: cat.slug,
      description: cat.description || '',
      // Retirer les dates pour réduire la taille de la réponse
      // sauf si nécessaire pour le cache client
    }));

    // ============================================
    // NOUVELLE IMPLÉMENTATION : Headers de sécurité
    //
    // Les headers sont maintenant gérés de manière centralisée
    // par next.config.mjs pour garantir la cohérence et la sécurité
    //
    // Pour /api/(products|category)/* sont appliqués automatiquement :
    // - Cache public avec max-age de 5 minutes (données publiques)
    // - Stale-while-revalidate de 10 minutes pour fraîcheur
    // - CDN cache de 10 minutes pour performance
    // - Protection MIME sniffing (X-Content-Type-Options)
    // - Vary sur Accept-Encoding pour compression
    //
    // Ces headers optimisent la performance pour les données
    // publiques tout en maintenant la fraîcheur des données
    // ============================================

    // Calculer un hash simple pour l'ETag (optionnel)
    const dataHash = Buffer.from(JSON.stringify(formattedCategories))
      .toString('base64')
      .substring(0, 20);

    return NextResponse.json(
      {
        success: true,
        data: {
          categories: formattedCategories,
          count: formattedCategories.length,
          meta: {
            timestamp: new Date().toISOString(),
            etag: dataHash,
            cached: true,
            cacheMaxAge: 300, // Informer le client du cache
          },
        },
      },
      {
        status: 200,
        // Headers de cache gérés automatiquement par next.config.mjs
        // Configuration dans next.config.mjs :
        // source: '/api/(products|category)/:path*'
        // Cache-Control: public, max-age=300, stale-while-revalidate=600
      },
    );
  } catch (error) {
    console.error('Categories fetch error:', error.message);

    // Capturer seulement les vraies erreurs système
    captureException(error, {
      tags: {
        component: 'api',
        route: 'category/GET',
        error_type: error.name,
      },
      extra: {
        message: error.message,
        stack: error.stack,
      },
    });

    // Gestion améliorée des erreurs
    let status = 500;
    let message = 'Failed to fetch categories';
    let code = 'INTERNAL_ERROR';

    if (
      error.name === 'MongoNetworkError' ||
      error.message?.includes('connection')
    ) {
      status = 503;
      message = 'Database connection error';
      code = 'DB_CONNECTION_ERROR';
    } else if (error.message?.includes('timeout')) {
      status = 504;
      message = 'Request timeout';
      code = 'TIMEOUT';
    }

    return NextResponse.json(
      {
        success: false,
        message,
        code,
        ...(process.env.NODE_ENV === 'development' && {
          error: error.message,
        }),
      },
      { status },
    );
  }
});
