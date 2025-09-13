import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import Cart from '@/backend/models/cart';
import User from '@/backend/models/user';
import { captureException } from '@/monitoring/sentry';

/**
 * DELETE /api/cart/[id]
 * Supprime un élément du panier
 */
export async function DELETE(req, { params }) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Validation de l'ID
    const { id } = params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid cart item ID' },
        { status: 400 },
      );
    }

    // Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email }).select('_id');
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );
    }

    // Vérifier que l'élément existe et appartient à l'utilisateur
    const cartItem = await Cart.findById(id);

    if (!cartItem) {
      return NextResponse.json(
        { success: false, message: 'Cart item not found' },
        { status: 404 },
      );
    }

    // Vérifier la propriété
    if (cartItem.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 },
      );
    }

    // Supprimer l'élément
    await Cart.findByIdAndDelete(id);

    // Récupérer le panier mis à jour avec les produits populés
    const cartItems = await Cart.find({ user: user._id })
      .populate('product', 'name price stock images')
      .sort({ createdAt: -1 });

    // Formater la réponse
    const formattedCart = cartItems
      .filter((item) => item.product && item.product.stock > 0)
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
        message: 'Item removed from cart',
        data: {
          cartCount,
          cartTotal,
          cart: formattedCart,
          deletedItemId: id,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Cart delete error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'CastError' && error.name !== 'ValidationError') {
      captureException(error, {
        tags: { component: 'api', route: 'cart/[id]/DELETE' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'CastError'
            ? 'Invalid cart item ID'
            : 'Something went wrong',
      },
      { status: error.name === 'CastError' ? 400 : 500 },
    );
  }
}
