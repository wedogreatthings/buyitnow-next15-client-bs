import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Product from '@/backend/models/product';
import Category from '@/backend/models/category';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/products/[id]
 * Récupère un produit par son ID avec produits similaires
 * Optimisé pour ~500 visiteurs/jour
 * Rate limit: 60 req/min (public) ou 120 req/min (authenticated)
 *
 * Headers de sécurité gérés par next.config.mjs :
 * - Cache-Control: public, max-age=300, stale-while-revalidate=600
 * - CDN-Cache-Control: max-age=600
 * - X-Content-Type-Options: nosniff
 * - Vary: Accept-Encoding
 * - ETag généré automatiquement par Next.js
 */
export const GET = withApiRateLimit(async function (req, { params }) {
  try {
    // Validation simple de l'ID MongoDB
    const { id } = params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid product ID format',
        },
        { status: 400 },
      );
    }

    // Connexion DB
    await dbConnect();

    // Récupérer le produit principal
    const product = await Product.findById(id)
      .select(
        'name description price images category stock sold isActive slug updatedAt',
      )
      .populate('category', 'categoryName')
      .lean();

    // Si le produit n'existe pas
    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: 'Product not found',
        },
        { status: 404 },
      );
    }

    // Vérifier si le produit est actif
    if (!product.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'Product is not available',
        },
        { status: 410 }, // 410 Gone - Le produit existait mais n'est plus disponible
      );
    }

    // Récupérer les produits similaires (même catégorie)
    let sameCategoryProducts = [];
    if (product.category) {
      try {
        sameCategoryProducts = await Product.find({
          category: product.category._id,
          _id: { $ne: id },
          isActive: true,
          stock: { $gt: 0 }, // Seulement les produits en stock
        })
          .select('name price images slug stock')
          .limit(4)
          .lean();
      } catch (error) {
        // Si erreur, continuer sans produits similaires
        console.warn('Failed to fetch similar products:', error.message);
      }
    }

    // ============================================
    // NOUVELLE IMPLÉMENTATION : Headers de sécurité
    // Les headers sont maintenant gérés de manière centralisée par next.config.mjs
    //
    // Configuration appliquée automatiquement pour /api/products/[id] :
    //
    // Headers spécifiques aux APIs produits :
    // - Cache-Control: public, max-age=300, stale-while-revalidate=600
    //   (5 min de cache, 10 min stale-while-revalidate pour fraîcheur des données)
    // - CDN-Cache-Control: max-age=600
    //   (10 min pour CDN - Vercel Edge Network)
    // - X-Content-Type-Options: nosniff
    //   (Protection contre le MIME sniffing)
    // - Vary: Accept-Encoding
    //   (Gestion correcte du cache avec compression)
    //
    // Headers globaux de sécurité (appliqués à toutes les routes) :
    // - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
    // - X-Frame-Options: SAMEORIGIN
    // - Referrer-Policy: strict-origin-when-cross-origin
    // - Permissions-Policy: camera=(), microphone=(), geolocation=(), ...
    // - Content-Security-Policy: [configuration complète avec Cloudinary]
    //
    // Note: L'ETag n'est plus nécessaire car Next.js 15 le génère
    // automatiquement basé sur le contenu de la réponse
    // ============================================

    // Préparer la réponse avec structure optimisée
    const responseData = {
      success: true,
      data: {
        product: {
          _id: product._id,
          name: product.name,
          description: product.description,
          price: product.price,
          images: product.images,
          category: product.category,
          stock: product.stock,
          sold: product.sold || 0,
          slug: product.slug,
          isActive: product.isActive,
          // Ajout de métadonnées utiles pour le SEO
          lastModified: product.updatedAt || new Date().toISOString(),
        },
        sameCategoryProducts,
        // Métadonnées supplémentaires pour le client
        meta: {
          hasRelatedProducts: sameCategoryProducts.length > 0,
          categoryName: product.category?.categoryName || null,
          availability: product.stock > 0 ? 'in_stock' : 'out_of_stock',
        },
      },
    };

    // Retourner la réponse sans headers manuels
    // Les headers sont appliqués automatiquement via next.config.mjs
    return NextResponse.json(responseData, {
      status: 200,
      // Plus besoin de spécifier les headers ici
      // Next.js 15 génère automatiquement l'ETag basé sur le JSON
    });
  } catch (error) {
    console.error('Product fetch error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'CastError') {
      captureException(error, {
        tags: {
          component: 'api',
          route: 'products/[id]/GET',
          productId: params.id,
        },
      });
    }

    // Gestion simple des erreurs avec statuts HTTP appropriés
    let status = 500;
    let message = 'Failed to fetch product';
    let code = 'INTERNAL_ERROR';

    if (error.name === 'CastError') {
      status = 400;
      message = 'Invalid product ID format';
      code = 'INVALID_ID';
    } else if (error.name === 'MongoNetworkError') {
      status = 503;
      message = 'Database connection error';
      code = 'DB_ERROR';
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
        // En développement, inclure plus de détails
        ...(process.env.NODE_ENV === 'development' && {
          error: error.message,
        }),
      },
      { status },
    );
  }
});
