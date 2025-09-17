// app/api/auth/forgot-password/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/backend/config/dbConnect';
import User from '@/backend/models/user';
import { validateForgotPassword } from '@/helpers/validation/schemas/auth';
import { captureException } from '@/monitoring/sentry';
import { sendPasswordResetEmail } from '@/backend/utils/emailService';

/**
 * POST /api/auth/forgot-password
 * Génère un token de réinitialisation et envoie un email
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

    // ✅ Validation avec Yup
    const validation = await validateForgotPassword({
      email: body.email?.toLowerCase()?.trim(),
    });

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Données invalides',
          errors: validation.errors,
          code: 'VALIDATION_FAILED',
        },
        { status: 400 },
      );
    }

    const { email } = validation.data;

    // Rechercher l'utilisateur
    const user = await User.findOne({ email }).select(
      '_id name email isActive verified resetPasswordToken resetPasswordExpire updatedAt',
    );

    // ✅ SÉCURITÉ: Toujours retourner le même message (éviter l'énumération)
    const genericSuccessMessage =
      'Si cette adresse email existe dans notre système, vous recevrez un lien de réinitialisation dans quelques minutes.';

    if (!user) {
      console.log('Password reset attempt for non-existent email:', {
        email: email.substring(0, 3) + '***',
        timestamp: new Date().toISOString(),
      });

      // Ne pas révéler que l'email n'existe pas
      return NextResponse.json(
        {
          success: true,
          message: genericSuccessMessage,
          code: 'EMAIL_SENT_IF_EXISTS',
        },
        { status: 200 },
      );
    }

    // ✅ Vérifier si le compte est actif
    if (!user.isActive) {
      console.log('Password reset attempt on suspended account:', {
        userId: user._id,
        email: email.substring(0, 3) + '***',
      });

      // Ne pas révéler le statut du compte
      return NextResponse.json(
        {
          success: true,
          message: genericSuccessMessage,
          code: 'EMAIL_SENT_IF_EXISTS',
        },
        { status: 200 },
      );
    }

    // ✅ Vérifier si l'email est vérifié
    if (!user.verified) {
      console.log('Password reset attempt on unverified account:', {
        userId: user._id,
        email: email.substring(0, 3) + '***',
      });

      // Envoyer quand même l'email mais informer de vérifier d'abord
      // On pourrait aussi bloquer, selon la politique de sécurité
    }

    // ✅ Rate limiting simple - vérifier le dernier envoi
    if (user.resetPasswordExpire && user.resetPasswordExpire > Date.now()) {
      const remainingTime = Math.ceil(
        (user.resetPasswordExpire - Date.now()) / 1000 / 60,
      );

      console.log('Rate limit hit for password reset:', {
        userId: user._id,
        email: email.substring(0, 3) + '***',
        remainingMinutes: remainingTime,
      });

      // Ne pas révéler le rate limiting pour éviter l'énumération
      return NextResponse.json(
        {
          success: true,
          message: genericSuccessMessage,
          code: 'EMAIL_SENT_IF_EXISTS',
        },
        { status: 200 },
      );
    }

    // ✅ Générer un token de réinitialisation sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');

    // ✅ Hasher le token avant de le stocker (sécurité supplémentaire)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // ✅ Définir l'expiration (1 heure)
    const resetExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    // Mettre à jour l'utilisateur avec le token hashé
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: resetExpire,
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new Error('Failed to update reset token');
    }

    // ✅ Envoyer l'email avec le token NON hashé
    let emailSent = false;
    let emailError = null;

    try {
      const emailResult = await sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken, // Token non hashé pour l'URL
      );

      if (emailResult.success) {
        emailSent = true;
        console.log('📧 Password reset email sent successfully:', {
          userId: user._id,
          email: user.email?.substring(0, 3) + '***',
          messageId: emailResult.messageId,
          expiresAt: resetExpire,
        });
      } else {
        emailError = emailResult.error;
        console.warn(
          '⚠️ Failed to send password reset email:',
          emailResult.error,
        );
      }
    } catch (error) {
      emailError = error.message;
      console.error('❌ Email service error during password reset:', error);

      // Capturer l'erreur mais continuer
      captureException(error, {
        tags: {
          component: 'api',
          action: 'forgot-password',
          subAction: 'email-send',
        },
        user: { id: user._id, email: user.email?.substring(0, 3) + '***' },
        extra: {
          hashedToken: hashedToken.substring(0, 8) + '...',
        },
      });
    }

    // ✅ Log de sécurité pour audit
    console.log('🔒 Security event - Password reset requested:', {
      userId: user._id,
      email: user.email?.substring(0, 3) + '***',
      emailSent,
      expiresAt: resetExpire.toISOString(),
      timestamp: new Date().toISOString(),
      userAgent:
        request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
      ip:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown',
    });

    // ✅ Réponse générique pour éviter l'énumération
    return NextResponse.json(
      {
        success: true,
        message: genericSuccessMessage,
        code: 'EMAIL_SENT_IF_EXISTS',
        data: {
          emailSent: true,
          // En développement uniquement, pour debug
          ...(process.env.NODE_ENV === 'development' && {
            debug: {
              emailSent,
              emailError,
              expiresIn: '60 minutes',
            },
          }),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('❌ Forgot password error:', error.message);

    // Capturer l'erreur pour monitoring
    captureException(error, {
      tags: { component: 'api', route: 'auth/forgot-password' },
      extra: {
        body: body ? { email: body.email?.substring(0, 3) + '***' } : null,
        userAgent: request.headers.get('user-agent'),
        ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      },
      level: 'error',
    });

    // ✅ IMPORTANT: Même en cas d'erreur, retourner un message générique
    // pour éviter de révéler des informations
    return NextResponse.json(
      {
        success: true,
        message:
          'Si cette adresse email existe dans notre système, vous recevrez un lien de réinitialisation dans quelques minutes.',
        code: 'EMAIL_SENT_IF_EXISTS',
      },
      { status: 200 },
    );
  }
}
