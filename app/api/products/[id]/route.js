import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Product from '@/backend/models/product';
import Category from '@/backend/models/category';
import { captureException } from '@/monitoring/sentry';

/**
 * GET /api/products/[id]
 * Récupère un produit par son ID avec produits similaires
 * Optimisé pour ~500 visiteurs/jour
 */
export async function GET(req, { params }) {
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
      .select('name description price images category stock sold isActive slug')
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

    // Récupérer les produits similaires (même catégorie)
    let sameCategoryProducts = [];
    if (product.category) {
      try {
        sameCategoryProducts = await Product.find({
          category: product.category._id,
          _id: { $ne: id },
          isActive: true,
        })
          .select('name price images slug')
          .limit(4)
          .lean();
      } catch (error) {
        // Si erreur, continuer sans produits similaires
        console.warn('Failed to fetch similar products:', error.message);
      }
    }

    // Headers de cache pour un produit (change moins souvent)
    const cacheHeaders = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5min cache, 10min stale
      'CDN-Cache-Control': 'max-age=600', // 10min pour CDN
      ETag: `"${product._id}-${product.updatedAt || Date.now()}"`,
      Vary: 'Accept-Language',
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          product,
          sameCategoryProducts,
        },
      },
      {
        status: 200,
        headers: cacheHeaders,
      },
    );
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

    // Gestion simple des erreurs
    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'CastError'
            ? 'Invalid product ID format'
            : 'Failed to fetch product',
      },
      { status: error.name === 'CastError' ? 400 : 500 },
    );
  }
}
