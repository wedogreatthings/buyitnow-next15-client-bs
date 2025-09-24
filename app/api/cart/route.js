import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import User from '@/backend/models/user';
import Cart from '@/backend/models/cart';
import Product from '@/backend/models/product';
import { DECREASE, INCREASE } from '@/helpers/constants';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/cart
 * Récupère le panier de l'utilisateur connecté
 * Rate limit: 120 req/min (lecture fréquente autorisée pour utilisateurs authentifiés)
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/cart/* :
 * - Cache-Control: private, no-cache, no-store, must-revalidate
 * - Pragma: no-cache
 * - X-Content-Type-Options: nosniff
 * - X-Robots-Tag: noindex, nofollow
 * - X-Download-Options: noopen
 *
 * Headers globaux de sécurité (toutes routes) :
 * - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
 * - X-Frame-Options: SAMEORIGIN
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: [configuration restrictive]
 * - Content-Security-Policy: [configuration complète]
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email }).select('_id');
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // Récupérer le panier avec les produits populés
    const cartItems = await Cart.find({ user: user._id })
      .populate('product', 'name price stock images isActive')
      .lean();

    // Filtrer les produits disponibles et ajuster les quantités
    const validCartItems = cartItems.filter(
      (item) => item.product && item.product.isActive && item.product.stock > 0,
    );

    // Ajuster les quantités si elles dépassent le stock
    const formattedCart = validCartItems.map((item) => {
      const quantity = Math.min(item.quantity, item.product.stock);
      const subtotal = quantity * item.product.price;

      return {
        id: item._id,
        productId: item.product._id,
        productName: item.product.name,
        price: item.product.price,
        quantity,
        stock: item.product.stock,
        subtotal,
        imageUrl: item.product.images?.[0]?.url || '',
        meta: {
          adjusted: quantity !== item.quantity,
          originalQuantity: item.quantity,
        },
      };
    });

    const cartCount = formattedCart.length;
    const cartTotal = formattedCart.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    // ============================================
    // NOUVELLE IMPLÉMENTATION : Headers de sécurité
    //
    // Les headers sont maintenant gérés de manière centralisée
    // par next.config.mjs pour garantir la cohérence et la sécurité
    //
    // Pour /api/cart/* sont appliqués automatiquement :
    // - Cache privé uniquement (données sensibles utilisateur)
    // - Pas de cache navigateur (no-store, no-cache)
    // - Protection contre l'indexation (X-Robots-Tag)
    // - Protection téléchargements (X-Download-Options)
    // - Protection MIME (X-Content-Type-Options)
    //
    // Ces headers garantissent que les données du panier
    // ne sont jamais mises en cache publiquement ou indexées
    // ============================================

    return NextResponse.json(
      {
        success: true,
        data: {
          cartCount,
          cartTotal,
          cart: formattedCart,
          meta: {
            timestamp: new Date().toISOString(),
            hasAdjustments: formattedCart.some((item) => item.meta?.adjusted),
          },
        },
      },
      {
        status: 200,
        // Pas de headers manuels - gérés par next.config.mjs
      },
    );
  } catch (error) {
    console.error('Cart GET error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (!error.message?.includes('authentication')) {
      captureException(error, {
        tags: {
          component: 'api',
          route: 'cart/GET',
          user: req.user?.email,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message?.includes('authentication')
          ? 'Authentication failed'
          : 'Failed to fetch cart',
        code: error.message?.includes('authentication')
          ? 'AUTH_FAILED'
          : 'FETCH_ERROR',
      },
      { status: error.message?.includes('authentication') ? 401 : 500 },
    );
  }
});

/**
 * POST /api/cart
 * Ajoute un produit au panier
 * Rate limit: 30 ajouts par 5 minutes (protection contre l'ajout massif de produits)
 *
 * Headers de sécurité appliqués automatiquement via next.config.mjs
 */
export const POST = withApiRateLimit(
  async function (req) {
    try {
      // Vérifier l'authentification
      await isAuthenticatedUser(req, NextResponse);

      // Connexion DB
      await dbConnect();

      // Récupérer l'utilisateur
      const user = await User.findOne({ email: req.user.email }).select('_id');
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // Parser les données
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid request body',
            code: 'INVALID_BODY',
          },
          { status: 400 },
        );
      }

      const { productId, quantity = 1 } = body;

      // Validation basique
      if (!productId || !/^[0-9a-fA-F]{24}$/.test(productId)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid product ID',
            code: 'INVALID_PRODUCT_ID',
          },
          { status: 400 },
        );
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid quantity. Must be between 1 and 99',
            code: 'INVALID_QUANTITY',
            data: { min: 1, max: 99, provided: quantity },
          },
          { status: 400 },
        );
      }

      // Vérifier le produit
      const product = await Product.findById(productId)
        .select('name price stock isActive')
        .lean();

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            message: 'Product not found',
            code: 'PRODUCT_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      if (!product.isActive) {
        return NextResponse.json(
          {
            success: false,
            message: 'Product is not available',
            code: 'PRODUCT_INACTIVE',
          },
          { status: 400 },
        );
      }

      if (product.stock === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Product is out of stock',
            code: 'OUT_OF_STOCK',
          },
          { status: 400 },
        );
      }

      if (quantity > product.stock) {
        return NextResponse.json(
          {
            success: false,
            message: `Only ${product.stock} units available`,
            code: 'INSUFFICIENT_STOCK',
            data: { available: product.stock, requested: quantity },
          },
          { status: 400 },
        );
      }

      // Vérifier si le produit est déjà dans le panier
      const existingCartItem = await Cart.findOne({
        user: user._id,
        product: productId,
      });

      let updatedItem;
      let isNewItem = false;

      if (existingCartItem) {
        // Mettre à jour la quantité
        const newQuantity = Math.min(
          existingCartItem.quantity + quantity,
          product.stock,
        );

        existingCartItem.quantity = newQuantity;
        await existingCartItem.save();
        updatedItem = existingCartItem;
      } else {
        // Créer un nouvel item
        isNewItem = true;
        updatedItem = await Cart.create({
          user: user._id,
          product: productId,
          quantity: Math.min(quantity, product.stock),
          price: product.price,
          productName: product.name,
        });
      }

      // Récupérer le panier mis à jour
      const cartItems = await Cart.find({ user: user._id })
        .populate('product', 'name price stock images isActive')
        .lean();

      // Formater la réponse
      const formattedCart = cartItems
        .filter((item) => item.product && item.product.isActive)
        .map((item) => ({
          id: item._id,
          productId: item.product._id,
          productName: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          stock: item.product.stock,
          subtotal: item.quantity * item.product.price,
          imageUrl: item.product.images?.[0]?.url || '',
        }));

      const cartCount = formattedCart.length;
      const cartTotal = formattedCart.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      // Log de sécurité pour audit
      console.log('🔒 Security event - Cart item added:', {
        userId: user._id,
        productId,
        quantity: updatedItem.quantity,
        isNewItem,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      return NextResponse.json(
        {
          success: true,
          message: isNewItem
            ? 'Product added to cart'
            : 'Cart quantity updated',
          data: {
            cartCount,
            cartTotal,
            cart: formattedCart,
            addedItem: {
              productId,
              quantity: updatedItem.quantity,
              isNewItem,
            },
          },
        },
        {
          status: isNewItem ? 201 : 200,
          // Headers de sécurité appliqués automatiquement
        },
      );
    } catch (error) {
      console.error('Cart POST error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (error.code !== 11000 && !error.message?.includes('authentication')) {
        captureException(error, {
          tags: {
            component: 'api',
            route: 'cart/POST',
            user: req.user?.email,
          },
        });
      }

      // Gestion spécifique des erreurs
      let status = 500;
      let message = 'Failed to add to cart';
      let code = 'INTERNAL_ERROR';

      if (error.code === 11000) {
        status = 409;
        message = 'Product already in cart';
        code = 'DUPLICATE_ITEM';
      } else if (error.message?.includes('authentication')) {
        status = 401;
        message = 'Authentication failed';
        code = 'AUTH_FAILED';
      }

      return NextResponse.json({ success: false, message, code }, { status });
    }
  },
  {
    customLimit: {
      points: 30, // 30 ajouts maximum
      duration: 300000, // par période de 5 minutes
      blockDuration: 600000, // blocage de 10 minutes en cas de dépassement
    },
  },
);

/**
 * PUT /api/cart
 * Met à jour la quantité d'un produit dans le panier
 * Rate limit: 60 modifications par 5 minutes (permettre les ajustements multiples de quantité)
 *
 * Headers de sécurité appliqués automatiquement via next.config.mjs
 */
export const PUT = withApiRateLimit(
  async function (req) {
    try {
      // Vérifier l'authentification
      await isAuthenticatedUser(req, NextResponse);

      // Connexion DB
      await dbConnect();

      // Récupérer l'utilisateur
      const user = await User.findOne({ email: req.user.email }).select('_id');
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // Parser les données
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid request body',
            code: 'INVALID_BODY',
          },
          { status: 400 },
        );
      }

      const cartItemId = body.product?.id;
      const action = body.value;

      // Validation
      if (!cartItemId || !/^[0-9a-fA-F]{24}$/.test(cartItemId)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid cart item ID',
            code: 'INVALID_CART_ITEM_ID',
          },
          { status: 400 },
        );
      }

      if (action !== INCREASE && action !== DECREASE) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid action. Must be INCREASE or DECREASE',
            code: 'INVALID_ACTION',
            data: { validActions: [INCREASE, DECREASE] },
          },
          { status: 400 },
        );
      }

      // Récupérer l'item du panier
      const cartItem = await Cart.findOne({
        _id: cartItemId,
        user: user._id,
      }).populate('product', 'stock isActive name price');

      if (!cartItem) {
        return NextResponse.json(
          {
            success: false,
            message: 'Cart item not found',
            code: 'CART_ITEM_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // Vérifier que le produit est toujours disponible
      if (!cartItem.product || !cartItem.product.isActive) {
        // Supprimer l'item si le produit n'est plus disponible
        await Cart.findByIdAndDelete(cartItemId);

        return NextResponse.json(
          {
            success: false,
            message: 'Product no longer available',
            code: 'PRODUCT_UNAVAILABLE',
            data: { itemRemoved: true },
          },
          { status: 400 },
        );
      }

      // Variables pour le log
      const previousQuantity = cartItem.quantity;
      let itemDeleted = false;

      // Mettre à jour la quantité
      if (action === INCREASE) {
        const newQuantity = cartItem.quantity + 1;

        if (newQuantity > cartItem.product.stock) {
          return NextResponse.json(
            {
              success: false,
              message: `Only ${cartItem.product.stock} units available`,
              code: 'INSUFFICIENT_STOCK',
              data: {
                current: cartItem.quantity,
                available: cartItem.product.stock,
              },
            },
            { status: 400 },
          );
        }

        cartItem.quantity = newQuantity;
        await cartItem.save();
      } else if (action === DECREASE) {
        const newQuantity = cartItem.quantity - 1;

        if (newQuantity <= 0) {
          // Supprimer l'item si quantité = 0
          await Cart.findByIdAndDelete(cartItemId);
          itemDeleted = true;
        } else {
          cartItem.quantity = newQuantity;
          await cartItem.save();
        }
      }

      // Récupérer le panier mis à jour
      const cartItems = await Cart.find({ user: user._id })
        .populate('product', 'name price stock images isActive')
        .lean();

      // Formater la réponse
      const formattedCart = cartItems
        .filter((item) => item.product && item.product.isActive)
        .map((item) => ({
          id: item._id,
          productId: item.product._id,
          productName: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          stock: item.product.stock,
          subtotal: item.quantity * item.product.price,
          imageUrl: item.product.images?.[0]?.url || '',
        }));

      const cartCount = formattedCart.length;
      const cartTotal = formattedCart.reduce(
        (sum, item) => sum + item.subtotal,
        0,
      );

      // Log de sécurité pour audit
      console.log('🔒 Security event - Cart quantity updated:', {
        userId: user._id,
        cartItemId,
        action,
        previousQuantity,
        newQuantity: itemDeleted ? 0 : cartItem.quantity,
        itemDeleted,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      return NextResponse.json(
        {
          success: true,
          message: itemDeleted
            ? 'Item removed from cart'
            : `Cart ${action === INCREASE ? 'increased' : 'decreased'} successfully`,
          data: {
            cartCount,
            cartTotal,
            cart: formattedCart,
            updatedItem: {
              cartItemId,
              action,
              deleted: itemDeleted,
              newQuantity: itemDeleted ? 0 : cartItem.quantity,
            },
          },
        },
        {
          status: 200,
          // Headers appliqués automatiquement
        },
      );
    } catch (error) {
      console.error('Cart PUT error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (error.name !== 'ValidationError' && error.name !== 'CastError') {
        captureException(error, {
          tags: {
            component: 'api',
            route: 'cart/PUT',
            user: req.user?.email,
          },
        });
      }

      // Gestion simple des erreurs
      let status = 500;
      let message = 'Failed to update cart';
      let code = 'INTERNAL_ERROR';

      if (error.name === 'ValidationError') {
        status = 400;
        message = 'Invalid cart data';
        code = 'VALIDATION_ERROR';
      } else if (error.name === 'CastError') {
        status = 400;
        message = 'Invalid ID format';
        code = 'INVALID_ID_FORMAT';
      }

      return NextResponse.json({ success: false, message, code }, { status });
    }
  },
  {
    customLimit: {
      points: 60, // 60 modifications maximum
      duration: 300000, // par période de 5 minutes
      blockDuration: 300000, // blocage de 5 minutes (plus court pour les ajustements de panier)
    },
  },
);
