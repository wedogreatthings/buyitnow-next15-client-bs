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
        { success: false, message: 'User not found' },
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
      };
    });

    const cartCount = formattedCart.length;
    const cartTotal = formattedCart.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          cartCount,
          cartTotal,
          cart: formattedCart,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-cache',
        },
      },
    );
  } catch (error) {
    console.error('Cart GET error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (!error.message?.includes('authentication')) {
      captureException(error, {
        tags: { component: 'api', route: 'cart/GET' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message?.includes('authentication')
          ? 'Authentication failed'
          : 'Failed to fetch cart',
      },
      { status: error.message?.includes('authentication') ? 401 : 500 },
    );
  }
});

/**
 * POST /api/cart
 * Ajoute un produit au panier
 * Rate limit: 30 ajouts par 5 minutes (protection contre l'ajout massif de produits)
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
          { success: false, message: 'User not found' },
          { status: 404 },
        );
      }

      // Parser les données
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          { success: false, message: 'Invalid request body' },
          { status: 400 },
        );
      }

      const { productId, quantity = 1 } = body;

      // Validation basique
      if (!productId || !/^[0-9a-fA-F]{24}$/.test(productId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid product ID' },
          { status: 400 },
        );
      }

      if (quantity < 1 || quantity > 99) {
        return NextResponse.json(
          { success: false, message: 'Invalid quantity' },
          { status: 400 },
        );
      }

      // Vérifier le produit
      const product = await Product.findById(productId)
        .select('name price stock isActive')
        .lean();

      if (!product || !product.isActive) {
        return NextResponse.json(
          { success: false, message: 'Product not available' },
          { status: 404 },
        );
      }

      if (quantity > product.stock) {
        return NextResponse.json(
          { success: false, message: `Only ${product.stock} units available` },
          { status: 400 },
        );
      }

      // Vérifier si le produit est déjà dans le panier
      const existingCartItem = await Cart.findOne({
        user: user._id,
        product: productId,
      });

      if (existingCartItem) {
        // Mettre à jour la quantité
        const newQuantity = Math.min(
          existingCartItem.quantity + quantity,
          product.stock,
        );

        existingCartItem.quantity = newQuantity;
        await existingCartItem.save();
      } else {
        // Créer un nouvel item
        await Cart.create({
          user: user._id,
          product: productId,
          quantity: Math.min(quantity, product.stock),
          price: product.price, // Ajouter le prix du produit
          productName: product.name, // Ajouter le nom du produit
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

      return NextResponse.json(
        {
          success: true,
          message: 'Product added to cart',
          data: {
            cartCount,
            cartTotal,
            cart: formattedCart,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      console.error('Cart POST error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (error.code !== 11000 && !error.message?.includes('authentication')) {
        captureException(error, {
          tags: { component: 'api', route: 'cart/POST' },
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            error.code === 11000
              ? 'Product already in cart'
              : 'Failed to add to cart',
        },
        { status: error.code === 11000 ? 409 : 500 },
      );
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
          { success: false, message: 'User not found' },
          { status: 404 },
        );
      }

      // Parser les données
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          { success: false, message: 'Invalid request body' },
          { status: 400 },
        );
      }

      const cartItemId = body.product?.id;
      const action = body.value;

      // Validation
      if (!cartItemId || !/^[0-9a-fA-F]{24}$/.test(cartItemId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid cart item ID' },
          { status: 400 },
        );
      }

      if (action !== INCREASE && action !== DECREASE) {
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 },
        );
      }

      // Récupérer l'item du panier
      const cartItem = await Cart.findOne({
        _id: cartItemId,
        user: user._id,
      }).populate('product', 'stock isActive');

      if (!cartItem) {
        return NextResponse.json(
          { success: false, message: 'Cart item not found' },
          { status: 404 },
        );
      }

      // Vérifier que le produit est toujours disponible
      if (!cartItem.product || !cartItem.product.isActive) {
        // Supprimer l'item si le produit n'est plus disponible
        await Cart.findByIdAndDelete(cartItemId);

        return NextResponse.json(
          { success: false, message: 'Product no longer available' },
          { status: 400 },
        );
      }

      // Mettre à jour la quantité
      if (action === INCREASE) {
        const newQuantity = cartItem.quantity + 1;

        if (newQuantity > cartItem.product.stock) {
          return NextResponse.json(
            {
              success: false,
              message: `Only ${cartItem.product.stock} units available`,
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

      return NextResponse.json(
        {
          success: true,
          message: 'Cart updated successfully',
          data: {
            cartCount,
            cartTotal,
            cart: formattedCart,
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error('Cart PUT error:', error.message);

      // Capturer seulement les vraies erreurs système
      captureException(error, {
        tags: { component: 'api', route: 'cart/PUT' },
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Failed to update cart',
        },
        { status: 500 },
      );
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
