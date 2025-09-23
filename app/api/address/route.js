import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Address from '@/backend/models/address';
import User from '@/backend/models/user';
import PaymentType from '@/backend/models/paymentType';
import DeliveryPrice from '@/backend/models/deliveryPrice';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import { validateAddress } from '@/helpers/validation/schemas/address';
import { sanitizeAddress, hasRequiredFields } from '@/utils/addressSanitizer';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/address
 * Récupère toutes les adresses d'un utilisateur
 * Rate limit: 60 req/min (public) ou 120 req/min (authenticated)
 */
export const GET = withApiRateLimit(async function (req) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Récupérer le contexte (optionnel)
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || 'shipping';

    // Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email }).select('_id');
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );
    }

    // Récupérer les adresses de l'utilisateur
    const addresses = await Address.find({ user: user._id }).select(
      'street city state zipCode country isDefault additionalInfo',
    );

    // Données additionnelles pour le contexte shipping
    let responseData = { addresses };

    if (context === 'shipping') {
      try {
        // Récupérer les types de paiement et prix de livraison en parallèle
        const [paymentTypes, deliveryPrice] = await Promise.all([
          PaymentType.find().catch(() => []),
          DeliveryPrice.find().catch(() => []),
        ]);

        responseData = {
          addresses,
          paymentTypes,
          deliveryPrice,
        };
      } catch (error) {
        // Si erreur, continuer avec juste les adresses
        console.warn('Error fetching payment/delivery data:', error.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('GET addresses error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (
      error.name !== 'ValidationError' &&
      !error.message?.includes('authentication')
    ) {
      captureException(error, {
        tags: { component: 'api', route: 'address/GET' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message?.includes('authentication')
          ? 'Authentication failed'
          : 'Something went wrong',
      },
      { status: error.message?.includes('authentication') ? 401 : 500 },
    );
  }
});

/**
 * POST /api/address
 * Ajoute une nouvelle adresse
 * Rate limit: 10 créations par 5 minutes (protection anti-spam)
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

      // Vérifier le nombre d'adresses existantes
      const addressCount = await Address.countDocuments({ user: user._id });
      if (addressCount >= 10) {
        return NextResponse.json(
          { success: false, message: 'Maximum 10 addresses allowed' },
          { status: 400 },
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

      // Vérification rapide des champs requis
      if (!hasRequiredFields(addressData)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Missing required fields',
            errors: { general: 'Street, city, state and country are required' },
          },
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

      // Si c'est la nouvelle adresse par défaut, désactiver les autres
      if (validation.data.isDefault === true) {
        await Address.updateMany(
          { user: user._id, isDefault: true },
          { isDefault: false },
        );
      }

      // Créer l'adresse
      const address = await Address.create({
        ...validation.data,
        user: user._id,
      });

      return NextResponse.json(
        {
          success: true,
          data: { address },
          message: 'Address added successfully',
        },
        { status: 201 },
      );
    } catch (error) {
      console.error('POST address error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (error.name !== 'ValidationError' && error.code !== 11000) {
        captureException(error, {
          tags: { component: 'api', route: 'address/POST' },
        });
      }

      // Gestion simple des erreurs
      let status = 500;
      let message = 'Something went wrong';

      if (error.name === 'ValidationError') {
        status = 400;
        message = 'Invalid address data';
      } else if (error.code === 11000) {
        status = 409;
        message = 'This address already exists';
      }

      return NextResponse.json({ success: false, message }, { status });
    }
  },
  {
    customLimit: {
      points: 10, // 10 créations d'adresse maximum
      duration: 300000, // par période de 5 minutes
      blockDuration: 600000, // blocage de 10 minutes en cas de dépassement
    },
  },
);
