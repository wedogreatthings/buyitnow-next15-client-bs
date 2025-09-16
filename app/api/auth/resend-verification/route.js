import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/backend/config/dbConnect';
import User from '@/backend/models/user';
import { captureException } from '@/monitoring/sentry';
import { sendVerificationEmail } from '@/backend/utils/emailService';

/**
 * POST /api/auth/resend-verification
 * Renvoie un email de vérification pour un utilisateur non vérifié
 */
export async function POST(request) {
  try {
    // Connexion DB
    await dbConnect();

    // Parser les données
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: 'Corps de requête invalide',
          code: 'INVALID_REQUEST_BODY',
        },
        { status: 400 },
      );
    }

    const { email } = body;

    // Validation de l'email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Adresse email requise',
          code: 'MISSING_EMAIL',
        },
        { status: 400 },
      );
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: "Format d'email invalide",
          code: 'INVALID_EMAIL_FORMAT',
        },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rechercher l'utilisateur
    const user = await User.findOne({
      email: normalizedEmail,
    }).select('_id name email verified verificationToken createdAt');

    if (!user) {
      // Pour la sécurité, ne pas révéler que l'email n'existe pas
      return NextResponse.json(
        {
          success: true,
          message:
            'Si cet email existe dans notre système, un nouveau lien de vérification a été envoyé.',
          code: 'EMAIL_SENT_IF_EXISTS',
        },
        { status: 200 },
      );
    }

    // Vérifier si l'utilisateur est déjà vérifié
    if (user.verified) {
      return NextResponse.json(
        {
          success: false,
          message: 'Cet email est déjà vérifié',
          code: 'ALREADY_VERIFIED',
        },
        { status: 400 },
      );
    }

    // Rate limiting simple - vérifier le dernier renvoi (éviter le spam)
    const timeSinceCreation = Date.now() - new Date(user.createdAt).getTime();
    const minIntervalBetweenResends = 2 * 60 * 1000; // 2 minutes

    if (timeSinceCreation < minIntervalBetweenResends) {
      const remainingTime = Math.ceil(
        (minIntervalBetweenResends - timeSinceCreation) / 1000 / 60,
      );
      return NextResponse.json(
        {
          success: false,
          message: `Veuillez attendre ${remainingTime} minute(s) avant de demander un nouveau lien`,
          code: 'RATE_LIMITED',
          retryAfterMinutes: remainingTime,
        },
        { status: 429 },
      );
    }

    // Générer un nouveau token de vérification
    const newVerificationToken = crypto.randomBytes(32).toString('hex');

    // Mettre à jour le token en base de données
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        verificationToken: newVerificationToken,
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new Error('Failed to update verification token');
    }

    // Envoyer le nouvel email de vérification
    let emailSent = false;
    let emailError = null;

    try {
      const emailResult = await sendVerificationEmail(
        user.email,
        user.name,
        newVerificationToken,
      );

      if (emailResult.success) {
        emailSent = true;
        console.log('📧 Verification email resent successfully:', {
          userId: user._id,
          email: user.email?.substring(0, 3) + '***',
          messageId: emailResult.messageId,
        });
      } else {
        emailError = emailResult.error;
        console.warn(
          '⚠️ Failed to resend verification email:',
          emailResult.error,
        );
      }
    } catch (error) {
      emailError = error.message;
      console.error('❌ Email service error during resend:', error);

      // Capturer l'erreur mais ne pas faire échouer la requête
      captureException(error, {
        tags: {
          component: 'api',
          action: 'resend-verification',
          subAction: 'email-send',
        },
        user: { id: user._id, email: user.email?.substring(0, 3) + '***' },
        extra: {
          verificationToken: newVerificationToken.substring(0, 8) + '...',
        },
      });
    }

    // Log de sécurité
    console.log('🔒 Security event - Verification email resent:', {
      userId: user._id,
      email: user.email?.substring(0, 3) + '***',
      emailSent,
      timestamp: new Date().toISOString(),
      userAgent:
        request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
      ip:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown',
    });

    // Réponse selon le succès de l'envoi d'email
    if (emailSent) {
      return NextResponse.json(
        {
          success: true,
          message:
            'Un nouveau lien de vérification a été envoyé à votre adresse email.',
          code: 'VERIFICATION_EMAIL_SENT',
          data: {
            email: user.email,
            emailSent: true,
          },
        },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message:
            "Le lien de vérification a été généré mais l'email n'a pas pu être envoyé. Veuillez réessayer.",
          code: 'EMAIL_SEND_FAILED',
          data: {
            email: user.email,
            emailSent: false,
            ...(process.env.NODE_ENV === 'development' && { emailError }),
          },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('❌ Resend verification error:', error.message);

    // Capturer l'erreur pour monitoring
    captureException(error, {
      tags: { component: 'api', route: 'auth/resend-verification' },
      extra: {
        body: body ? { email: body.email?.substring(0, 3) + '***' } : null,
        userAgent: request.headers.get('user-agent'),
        ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      },
      level: 'error',
    });

    return NextResponse.json(
      {
        success: false,
        message:
          "Une erreur est survenue lors du renvoi de l'email de vérification.",
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 },
    );
  }
}
