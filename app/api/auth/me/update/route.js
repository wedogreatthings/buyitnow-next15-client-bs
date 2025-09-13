import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import User from '@/backend/models/user';
import { validateProfile } from '@/helpers/validation/schemas/user';
import { captureException } from '@/monitoring/sentry';

/**
 * PUT /api/auth/me/update
 * Met à jour le profil utilisateur
 */
export async function PUT(req) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );
    }

    // Parser les données
    let profileData;
    try {
      profileData = await req.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Valider avec Yup
    const validation = await validateProfile(profileData);
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

    // Extraire seulement les champs autorisés
    const allowedFields = ['name', 'phone', 'avatar'];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (validation.data[field] !== undefined) {
        updateData[field] = validation.data[field];
      }
    });

    // Vérifier qu'il y a des champs à mettre à jour
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No fields to update' },
        { status: 400 },
      );
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await User.findOneAndUpdate(
      { email: req.user.email },
      updateData,
      {
        new: true,
        runValidators: true,
        select: '-password',
      },
    );

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: 'Update failed' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully',
        data: {
          updatedUser: {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            avatar: updatedUser.avatar,
            role: updatedUser.role,
            isActive: updatedUser.isActive || false,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Profile update error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError') {
      captureException(error, {
        tags: { component: 'api', route: 'auth/me/update' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'ValidationError'
            ? 'Invalid profile data'
            : 'Something went wrong',
      },
      { status: error.name === 'ValidationError' ? 400 : 500 },
    );
  }
}
