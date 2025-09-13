import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import User from '@/backend/models/user';
import { validatePasswordUpdate } from '@/helpers/validation/schemas/auth';
import { captureException } from '@/monitoring/sentry';

/**
 * PUT /api/auth/me/update_password
 * Met à jour le mot de passe utilisateur
 */
export async function PUT(req) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Parser les données
    let passwordData;
    try {
      passwordData = await req.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Valider avec Yup
    const validation = await validatePasswordUpdate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
      confirmPassword: passwordData.confirmPassword,
    });

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

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findOne({ email: req.user.email }).select(
      '+password',
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcryptjs.compare(
      validation.data.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      console.log('Invalid current password attempt:', req.user.email);
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 400 },
      );
    }

    // Vérifier que le nouveau mot de passe est différent
    if (validation.data.currentPassword === validation.data.newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'New password must be different from current password',
        },
        { status: 400 },
      );
    }

    // Mettre à jour le mot de passe
    user.password = validation.data.newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    console.log('Password updated successfully for:', req.user.email);

    return NextResponse.json(
      {
        success: true,
        message: 'Password updated successfully',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Password update error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (
      error.name !== 'ValidationError' &&
      !error.message?.includes('bcrypt')
    ) {
      captureException(error, {
        tags: { component: 'api', route: 'auth/me/update_password' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'ValidationError'
            ? 'Invalid password data'
            : 'Something went wrong',
      },
      { status: error.name === 'ValidationError' ? 400 : 500 },
    );
  }
}
