import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Address from '@/backend/models/address';
import User from '@/backend/models/user';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import { validateAddress } from '@/helpers/validation/schemas/address';
import { sanitizeAddress } from '@/utils/addressSanitizer';
import { captureException } from '@/monitoring/sentry';

/**
 * GET /api/address/[id]
 * Récupère une adresse spécifique
 */
export async function GET(req, { params }) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Validation de l'ID
    const { id } = params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid address ID' },
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

    // Récupérer l'adresse
    const address = await Address.findById(id);

    if (!address) {
      return NextResponse.json(
        { success: false, message: 'Address not found' },
        { status: 404 },
      );
    }

    // Vérifier la propriété
    if (address.user?.toString() !== user._id.toString()) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: true, data: { address } },
      { status: 200 },
    );
  } catch (error) {
    console.error('GET address error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError' && error.name !== 'CastError') {
      captureException(error, {
        tags: { component: 'api', route: 'address/[id]/GET' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'CastError'
            ? 'Invalid address ID format'
            : 'Something went wrong',
      },
      { status: error.name === 'CastError' ? 400 : 500 },
    );
  }
}

/**
 * PUT /api/address/[id]
 * Met à jour une adresse
 */
export async function PUT(req, { params }) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Validation de l'ID
    const { id } = params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid address ID' },
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

    // Parser et sanitiser les données
    let addressData;
    try {
      const rawData = await req.json();
      addressData = sanitizeAddress(rawData);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Valider avec Yup
    const validation = await validateAddress(addressData);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    // Vérifier que l'adresse existe et appartient à l'utilisateur
    const existingAddress = await Address.findById(id);
    if (!existingAddress) {
      return NextResponse.json(
        { success: false, message: 'Address not found' },
        { status: 404 },
      );
    }

    if (existingAddress.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 },
      );
    }

    // Si c'est la nouvelle adresse par défaut, désactiver les autres
    if (validation.data.isDefault === true) {
      await Address.updateMany(
        { user: user._id, isDefault: true, _id: { $ne: id } },
        { isDefault: false },
      );
    }

    // Mettre à jour l'adresse
    const updatedAddress = await Address.findByIdAndUpdate(
      id,
      { ...validation.data, user: user._id },
      { new: true, runValidators: true },
    );

    return NextResponse.json(
      {
        success: true,
        data: { address: updatedAddress },
        message: 'Address updated successfully',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('PUT address error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError' && error.name !== 'CastError') {
      captureException(error, {
        tags: { component: 'api', route: 'address/[id]/PUT' },
      });
    }

    // Gestion simple des erreurs
    let status = 500;
    let message = 'Something went wrong';

    if (error.name === 'ValidationError') {
      status = 400;
      message = 'Invalid address data';
    } else if (error.name === 'CastError') {
      status = 400;
      message = 'Invalid address ID format';
    } else if (error.code === 11000) {
      status = 409;
      message = 'This address already exists';
    }

    return NextResponse.json({ success: false, message }, { status });
  }
}

/**
 * DELETE /api/address/[id]
 * Supprime une adresse
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
        { success: false, message: 'Invalid address ID' },
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

    // Vérifier que l'adresse existe et appartient à l'utilisateur
    const address = await Address.findById(id);
    if (!address) {
      return NextResponse.json(
        { success: false, message: 'Address not found' },
        { status: 404 },
      );
    }

    if (address.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 },
      );
    }

    // Supprimer l'adresse
    await Address.findByIdAndDelete(id);

    return NextResponse.json(
      {
        success: true,
        message: 'Address deleted successfully',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('DELETE address error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError' && error.name !== 'CastError') {
      captureException(error, {
        tags: { component: 'api', route: 'address/[id]/DELETE' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'CastError'
            ? 'Invalid address ID format'
            : 'Something went wrong',
      },
      { status: error.name === 'CastError' ? 400 : 500 },
    );
  }
}
