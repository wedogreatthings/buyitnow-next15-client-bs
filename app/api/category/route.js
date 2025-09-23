import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Category from '@/backend/models/category';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/category
 * Récupère toutes les catégories actives
 * Rate limit: 60 req/min (public) ou 120 req/min (authenticated)
 * Cache: 30min avec stale-while-revalidate de 1h
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Connexion DB
    await dbConnect();

    // Récupérer les catégories actives
    const categories = await Category.find({ isActive: true })
      .select('categoryName')
      .sort({ categoryName: 1 })
      .lean();

    // Headers de cache pour les catégories (changent rarement)
    const cacheHeaders = {
      'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600', // 30min cache, 1h stale
      'CDN-Cache-Control': 'max-age=3600', // 1h pour CDN si utilisé
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          categories,
          count: categories.length,
        },
      },
      {
        status: 200,
        headers: cacheHeaders,
      },
    );
  } catch (error) {
    console.error('Categories fetch error:', error.message);

    // Capturer seulement les vraies erreurs système
    captureException(error, {
      tags: { component: 'api', route: 'category/GET' },
    });

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch categories',
      },
      { status: 500 },
    );
  }
});
