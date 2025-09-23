import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import User from '@/backend/models/user';
import { captureException } from '@/monitoring/sentry';
import { withAuthRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/auth/verify-email?token=...
 * Vérifie l'email d'un utilisateur via le token de vérification
 * Rate limit: 10 tentatives par 15 minutes par IP (protection contre token brute-force)
 * Rate limit global: 10 tentatives par 15 minutes par IP
 */
export const GET = withAuthRateLimit(
  async function (request) {
    try {
      const { searchParams } = new URL(request.url);
      const token = searchParams.get('token');

      // Validation du token
      if (!token) {
        console.warn('Verification attempt without token');
        return NextResponse.redirect(
          new URL(
            '/auth/error?error=missing_token&message=Token de vérification manquant',
            request.url,
          ),
        );
      }

      // Validation format token (doit être un hex de 64 caractères)
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        console.warn('Invalid token format:', token.substring(0, 8) + '...');
        return NextResponse.redirect(
          new URL(
            '/auth/error?error=invalid_token&message=Format de token invalide',
            request.url,
          ),
        );
      }

      // Connexion DB
      await dbConnect();

      // Rechercher l'utilisateur avec ce token
      const user = await User.findOne({
        verificationToken: token,
      }).select('_id name email verified verificationToken createdAt');

      if (!user) {
        console.warn(
          'Verification attempt with invalid token:',
          token.substring(0, 8) + '...',
        );
        return NextResponse.redirect(
          new URL(
            '/auth/error?error=invalid_token&message=Token de vérification invalide ou expiré',
            request.url,
          ),
        );
      }

      // Vérifier si l'utilisateur est déjà vérifié
      if (user.verified) {
        console.info('User already verified:', {
          userId: user._id,
          email: user.email?.substring(0, 3) + '***',
        });
        return NextResponse.redirect(
          new URL(
            '/auth/success?message=already_verified&email=' +
              encodeURIComponent(user.email),
            request.url,
          ),
        );
      }

      // Vérifier l'expiration du token (24 heures)
      const tokenAge = Date.now() - new Date(user.createdAt).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 heures

      if (tokenAge > maxAge) {
        console.warn('Expired verification token used:', {
          userId: user._id,
          email: user.email?.substring(0, 3) + '***',
          ageHours: Math.round(tokenAge / (60 * 60 * 1000)),
        });
        return NextResponse.redirect(
          new URL(
            '/auth/error?error=expired_token&message=Le lien de vérification a expiré&email=' +
              encodeURIComponent(user.email),
            request.url,
          ),
        );
      }

      // Marquer l'utilisateur comme vérifié
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          verified: true,
          verificationToken: undefined, // Supprimer le token après utilisation
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!updatedUser) {
        throw new Error('Failed to update user verification status');
      }

      // Log de succès
      console.log('✅ User email verified successfully:', {
        userId: user._id,
        email: user.email?.substring(0, 3) + '***',
        name: user.name,
      });

      // Log de sécurité pour audit
      console.log('🔒 Security event - Email verified:', {
        userId: user._id,
        email: user.email?.substring(0, 3) + '***',
        timestamp: new Date().toISOString(),
        userAgent:
          request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
        ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      // Redirection vers page de succès
      return NextResponse.redirect(
        new URL(
          '/auth/success?message=email_verified&email=' +
            encodeURIComponent(user.email),
          request.url,
        ),
      );
    } catch (error) {
      console.error('❌ Email verification error:', error.message);

      // Capturer l'erreur pour monitoring
      captureException(error, {
        tags: { component: 'api', route: 'auth/verify-email' },
        extra: {
          url: request.url,
          userAgent: request.headers.get('user-agent'),
          hasToken: !!new URL(request.url).searchParams?.get('token'),
        },
        level: 'error',
      });

      // Redirection vers page d'erreur générique
      return NextResponse.redirect(
        new URL(
          '/auth/error?error=server_error&message=Une erreur est survenue lors de la vérification',
          request.url,
        ),
      );
    }
  },
  {
    // Configuration spécifique pour verify-email
    customLimit: {
      points: 10, // 10 tentatives maximum
      duration: 900000, // par 15 minutes
      blockDuration: 1800000, // blocage de 30 minutes en cas de dépassement
    },
  },
);
