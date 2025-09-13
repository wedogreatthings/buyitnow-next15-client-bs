import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import User from '@/backend/models/user';
import { validateRegister } from '@/helpers/validation/schemas/auth';
import { captureException } from '@/monitoring/sentry';

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
export async function POST(req) {
  try {
    // Connexion DB
    await dbConnect();

    // Parser les données
    let userData;
    try {
      userData = await req.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Valider avec Yup
    const validation = await validateRegister({
      name: userData.name,
      email: userData.email?.toLowerCase(),
      phone: userData.phone,
      password: userData.password,
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

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({
      email: validation.data.email,
    });

    if (existingUser) {
      console.log('Registration attempt with existing email');
      return NextResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 400 },
      );
    }

    // Créer l'utilisateur
    const user = await User.create({
      name: validation.data.name,
      email: validation.data.email,
      phone: validation.data.phone,
      password: validation.data.password,
      role: 'user',
      isActive: true,
      verified: false,
    });

    console.log('User registered successfully:', user.email);

    // Réponse sans données sensibles
    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error.message);

    // Gestion erreur de duplication MongoDB
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 400 },
      );
    }

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError') {
      captureException(error, {
        tags: { component: 'api', route: 'auth/register' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Registration failed. Please try again.',
      },
      { status: 500 },
    );
  }
}
