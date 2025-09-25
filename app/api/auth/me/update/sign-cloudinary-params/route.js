import { NextResponse } from 'next/server';
import cloudinary from 'cloudinary';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import User from '@/backend/models/user';
import { captureException, captureMessage } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * POST /api/auth/me/update/sign-cloudinary-params
 * Signe les paramètres pour l'upload Cloudinary sécurisé
 * Rate limit: 10 signatures par 5 minutes (protection contre les abus d'upload)
 */
export const POST = withApiRateLimit(
  async function (req) {
    try {
      console.log('Starting Cloudinary params signing process');
      // 1. Vérifier l'authentification
      await isAuthenticatedUser(req, NextResponse);

      console.log('User authenticated:', req.user.email);

      // 2. Vérifier les variables d'environnement
      if (
        !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
        !process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        captureMessage('Cloudinary configuration missing', {
          level: 'error',
          tags: { component: 'api', route: 'sign-cloudinary-params' },
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Server configuration error',
          },
          { status: 500 },
        );
      }

      console.log('Cloudinary configuration verified');

      // 3. Connexion DB pour vérifier l'utilisateur
      await dbConnect();

      console.log('Database connected');

      // 4. Vérifier que l'utilisateur existe et est actif
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
          },
          { status: 404 },
        );
      }

      console.log('User found:', user.email);

      if (user.isActive === false) {
        return NextResponse.json(
          {
            success: false,
            message: 'Account is deactivated',
          },
          { status: 403 },
        );
      }

      // 5. Parser et valider le body
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid request body',
          },
          { status: 400 },
        );
      }

      console.log('Request body parsed:', body);

      // 6. Valider la présence de paramsToSign
      if (
        !body ||
        !body.paramsToSign ||
        typeof body.paramsToSign !== 'object'
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Missing or invalid paramsToSign',
          },
          { status: 400 },
        );
      }

      console.log('Params to sign received:', body.paramsToSign);

      const { paramsToSign } = body;

      // 7. Valider et sanitizer les paramètres
      const allowedParams = [
        'timestamp',
        'source',
        'eager',
        'public_id',
        'upload_preset',
        // Ajouter d'autres paramètres autorisés si nécessaire
      ];

      // Filtrer les paramètres non autorisés
      const sanitizedParams = {};
      for (const [key, value] of Object.entries(paramsToSign)) {
        if (allowedParams.includes(key)) {
          sanitizedParams[key] = value;
        }
      }

      // 8. Forcer les paramètres de sécurité
      // Timestamp obligatoire pour la signature
      if (!sanitizedParams.timestamp) {
        sanitizedParams.timestamp = Math.round(new Date().getTime() / 1000);
      }

      // Configuration du dossier et restrictions
      sanitizedParams.folder = 'buyitnow/avatars';
      sanitizedParams.allowed_formats = 'jpg,jpeg,png,webp';
      sanitizedParams.max_file_size = 2000000; // 2MB
      sanitizedParams.resource_type = 'image';
      sanitizedParams.type = 'authenticated'; // Upload authentifié

      // Ajouter un public_id unique basé sur l'utilisateur
      if (!sanitizedParams.public_id) {
        const timestamp = Date.now();
        sanitizedParams.public_id = `buyitnow/avatars/${user._id}_${timestamp}`;
      }

      // Options de transformation pour optimiser les avatars
      sanitizedParams.eager = 'w_200,h_200,c_thumb,g_face,f_auto,q_auto';
      sanitizedParams.eager_async = true;

      console.log('Sanitized params for signing:', sanitizedParams);

      // 9. Générer la signature
      let signature;
      try {
        signature = cloudinary.utils.api_sign_request(
          sanitizedParams,
          process.env.CLOUDINARY_API_SECRET,
        );
      } catch (error) {
        console.error('Cloudinary signature error:', error);

        captureException(error, {
          tags: {
            component: 'api',
            route: 'sign-cloudinary-params',
            action: 'signature_generation',
          },
          extra: {
            userId: user._id,
            params: Object.keys(sanitizedParams),
          },
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Failed to generate signature',
          },
          { status: 500 },
        );
      }

      console.log('Signature generated successfully');

      // 10. Logger l'activité (sans données sensibles)
      if (process.env.NODE_ENV === 'production') {
        console.info('Cloudinary signature generated', {
          userId: user._id.toString().substring(0, 8) + '...',
          folder: sanitizedParams.folder,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log('Cloudinary params signed:', {
          userId: user._id,
          folder: sanitizedParams.folder,
          publicId: sanitizedParams.public_id,
        });
      }

      // 12. Retourner la signature avec les paramètres nécessaires
      return NextResponse.json(
        {
          success: true,
          message: 'Signature generated successfully',
          data: {
            signature,
            timestamp: sanitizedParams.timestamp,
            cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
            folder: sanitizedParams.folder,
            eager: sanitizedParams.eager,
          },
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('Sign cloudinary params error:', error);

      // Capturer l'erreur dans Sentry
      captureException(error, {
        tags: {
          component: 'api',
          route: 'sign-cloudinary-params',
        },
        extra: {
          userId: req.user?.email,
          errorName: error.name,
        },
      });

      // Retourner une erreur générique en production
      const errorMessage =
        process.env.NODE_ENV === 'production'
          ? 'Something went wrong'
          : error.message || 'Internal server error';

      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
        },
        { status: error.status || 500 },
      );
    }
  },
  {
    // Configuration du rate limit personnalisé
    customLimit: {
      points: 10, // 10 signatures maximum
      duration: 300000, // par période de 5 minutes
      blockDuration: 600000, // blocage de 10 minutes en cas de dépassement
    },
  },
);
