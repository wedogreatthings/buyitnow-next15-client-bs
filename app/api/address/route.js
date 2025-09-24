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
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/address/* :
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

    // Récupérer le contexte (optionnel)
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || 'shipping';

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

    // Récupérer les adresses de l'utilisateur
    const addresses = await Address.find({ user: user._id })
      .select('street city state zipCode country isDefault additionalInfo')
      .sort({ createdAt: -1 }) // Adresse par défaut en premier
      .lean();

    // Données additionnelles pour le contexte shipping
    let responseData = {
      addresses,
    };

    if (context === 'shipping') {
      try {
        // Récupérer les types de paiement et prix de livraison en parallèle
        const [paymentTypes, deliveryPrice] = await Promise.all([
          PaymentType.find()
            .lean()
            .catch(() => []),
          DeliveryPrice.find()
            .lean()
            .catch(() => []),
        ]);

        responseData = {
          addresses,
          paymentTypes,
          deliveryPrice,
          meta: {
            context,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        // Si erreur, continuer avec juste les adresses
        console.warn('Error fetching payment/delivery data:', error.message);
      }
    }

    // ============================================
    // NOUVELLE IMPLÉMENTATION : Headers de sécurité
    //
    // Les headers sont maintenant gérés de manière centralisée
    // par next.config.mjs pour garantir la cohérence et la sécurité
    //
    // Pour /api/address/* sont appliqués automatiquement :
    // - Cache privé uniquement (données sensibles utilisateur)
    // - Pas de cache navigateur (no-store, no-cache)
    // - Protection contre l'indexation (X-Robots-Tag)
    // - Protection téléchargements (X-Download-Options)
    // - Protection MIME (X-Content-Type-Options)
    //
    // Ces headers garantissent que les données d'adresse
    // ne sont jamais mises en cache publiquement ou indexées
    // ============================================

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      {
        status: 200,
        // Pas de headers manuels - gérés par next.config.mjs
      },
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
          : 'Failed to fetch addresses',
        code: error.message?.includes('authentication')
          ? 'AUTH_FAILED'
          : 'FETCH_ERROR',
      },
      { status: error.message?.includes('authentication') ? 401 : 500 },
    );
  }
});

/**
 * POST /api/address
 * Ajoute une nouvelle adresse
 * Rate limit: 10 créations par 5 minutes (protection anti-spam)
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

      // Vérifier le nombre d'adresses existantes
      const addressCount = await Address.countDocuments({ user: user._id });
      if (addressCount >= 10) {
        return NextResponse.json(
          {
            success: false,
            message: 'Maximum 10 addresses allowed',
            code: 'MAX_ADDRESSES_REACHED',
            data: { currentCount: addressCount, maxAllowed: 10 },
          },
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
          {
            success: false,
            message: 'Invalid request body',
            code: 'INVALID_BODY',
          },
          { status: 400 },
        );
      }

      // Vérification rapide des champs requis
      if (!hasRequiredFields(addressData)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Missing required fields',
            code: 'MISSING_FIELDS',
            errors: {
              general: 'Street, city, state and country are required',
              fields: ['street', 'city', 'state', 'country'],
            },
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
            code: 'VALIDATION_FAILED',
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

      // Log de sécurité pour audit
      console.log('🔒 Security event - Address created:', {
        userId: user._id,
        addressId: address._id,
        isDefault: address.isDefault,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Address added successfully',
          data: {
            address: {
              _id: address._id,
              street: address.street,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode,
              country: address.country,
              isDefault: address.isDefault,
              additionalInfo: address.additionalInfo,
              createdAt: address.createdAt,
            },
            totalAddresses: addressCount + 1,
          },
        },
        {
          status: 201,
          // Headers de sécurité appliqués automatiquement
        },
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
      let code = 'INTERNAL_ERROR';

      if (error.name === 'ValidationError') {
        status = 400;
        message = 'Invalid address data';
        code = 'VALIDATION_ERROR';
      } else if (error.code === 11000) {
        status = 409;
        message = 'This address already exists';
        code = 'DUPLICATE_ADDRESS';
      }

      return NextResponse.json({ success: false, message, code }, { status });
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
