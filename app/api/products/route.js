import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Product from '@/backend/models/product';
import Category from '@/backend/models/category';
import APIFilters from '@/backend/utils/APIFilters';
import { captureException } from '@/monitoring/sentry';
import { parseProductSearchParams } from '@/utils/inputSanitizer';
import { validateProductFilters } from '@/helpers/validation/schemas/product';
import { withApiRateLimit } from '@/utils/rateLimit';

// Configuration simple
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 50;

/**
 * GET /api/products
 * Récupère la liste des produits avec filtres et pagination
 * Rate limit: 60 req/min (public) ou 120 req/min (authenticated)
 *
 * Headers de sécurité gérés par next.config.mjs :
 * - Cache-Control: public, max-age=300, stale-while-revalidate=600
 * - CDN-Cache-Control: max-age=600
 * - X-Content-Type-Options: nosniff
 * - Vary: Accept-Encoding
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Connexion DB
    await dbConnect();

    // Sanitisation des paramètres
    const sanitizedParams = parseProductSearchParams(req.nextUrl.searchParams);

    // Validation des paramètres sanitisés
    const validation = await validateProductFilters(sanitizedParams);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid parameters',
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    // Utiliser les données validées
    const validatedParams = validation.data;
    const searchParams = new URLSearchParams();
    Object.entries(validatedParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        searchParams.set(key, value);
      }
    });

    // Configuration de la pagination
    const resPerPage = Math.min(MAX_PER_PAGE, Math.max(1, DEFAULT_PER_PAGE));

    // Au lieu de Product.find()
    const baseQuery = Product.find({ isActive: true })
      .populate({
        path: 'category',
        match: { isActive: true },
      })
      .select('name description stock price images category')
      .slice('images', 1);

    // Créer les filtres avec les paramètres validés
    const apiFilters = new APIFilters(baseQuery, searchParams)
      .search()
      .filter();

    // Compter les produits filtrés
    const filteredProductsCount = await apiFilters.query
      .clone()
      .lean()
      .countDocuments();

    // Ajouter la pagination
    apiFilters.pagination(resPerPage);

    // Récupérer les produits
    const products = await apiFilters.query;

    // Calculer les métadonnées
    const totalPages = Math.ceil(filteredProductsCount / resPerPage);

    // Préparer la réponse
    const responseData = {
      success: true,
      data: {
        totalPages,
        totalProducts: filteredProductsCount,
        products: products || [],
      },
    };

    // ============================================
    // NOUVELLE IMPLÉMENTATION : Headers de sécurité
    // Les headers principaux sont maintenant gérés par next.config.mjs
    // Nous retournons simplement la réponse sans headers supplémentaires
    // car la configuration centralisée dans next.config.mjs applique :
    //
    // Pour /api/products/* :
    // - Cache-Control: public, max-age=300, stale-while-revalidate=600
    // - CDN-Cache-Control: max-age=600
    // - X-Content-Type-Options: nosniff
    // - Vary: Accept-Encoding
    //
    // Headers globaux de sécurité (toutes routes) :
    // - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
    // - X-Frame-Options: SAMEORIGIN
    // - X-Content-Type-Options: nosniff
    // - Referrer-Policy: strict-origin-when-cross-origin
    // - Permissions-Policy: camera=(), microphone=(), geolocation=(), ...
    // - Content-Security-Policy: [configuration complète]
    // ============================================

    return NextResponse.json(responseData, {
      status: 200,
      // Plus besoin d'ajouter les headers ici car ils sont gérés globalement
      // Les headers de cache sont appliqués automatiquement via next.config.mjs
    });
  } catch (error) {
    console.error('Products fetch error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError') {
      captureException(error, {
        tags: { component: 'api', route: 'products/GET' },
        extra: {
          query: req.nextUrl.search,
        },
      });
    }

    // Gestion simple des erreurs
    let status = 500;
    let message = 'Failed to fetch products';

    if (error.name === 'ValidationError') {
      status = 400;
      message = 'Invalid parameters';
    } else if (error.message?.includes('timeout')) {
      status = 504;
      message = 'Request timeout';
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status },
    );
  }
});
