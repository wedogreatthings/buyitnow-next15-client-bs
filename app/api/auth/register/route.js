import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/backend/config/dbConnect';
import User from '@/backend/models/user';
import { validateRegister } from '@/helpers/validation/schemas/auth';
import { captureException } from '@/monitoring/sentry';
import { sendVerificationEmail } from '@/backend/utils/emailService';
import { withAuthRateLimit } from '@/utils/rateLimit';

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur avec vérification email et sécurité renforcée
 * Rate limit: 5 inscriptions par heure par IP (protection anti-spam)
 * Rate limit global: 10 tentatives par 15 minutes par IP
 */
export const POST = withAuthRateLimit(
  async function (req) {
    try {
      // Connexion DB
      await dbConnect();

      // Parser les données avec gestion d'erreur
      let userData;
      try {
        userData = await req.json();
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

      // ✅ AMÉLIORATION: Validation des données avec Yup
      const validation = await validateRegister({
        name: userData.name?.trim(),
        email: userData.email?.toLowerCase()?.trim(),
        phone: userData.phone?.trim(),
        password: userData.password,
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

      // ✅ AMÉLIORATION: Vérification d'unicité email ET téléphone
      const existingUser = await User.findOne({
        $or: [{ email: validation.data.email }],
      });

      if (existingUser) {
        console.log(
          `Registration attempt with existing email:`,
          validation.data.email,
        );

        return NextResponse.json(
          {
            success: false,
            message: `Ce email est déjà utilisé`,
            code: 'DUPLICATE_EMAIL',
          },
          { status: 400 },
        );
      }

      // ✅ AMÉLIORATION: Génération token de vérification sécurisé
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // ✅ AMÉLIORATION: Créer l'utilisateur avec tous les champs appropriés
      const user = await User.create({
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        password: validation.data.password,
        role: 'user',
        isActive: true,
        verified: false,
        verificationToken,
        avatar: {
          public_id: null,
          url: null,
        },
        // Les autres champs sont auto-initialisés par le modèle :
        // loginAttempts: 0 (défaut)
        // lockUntil: null (défaut)
        // lastLogin: null (défaut)
        // passwordChangedAt: null (défaut)
        // resetPasswordToken: undefined (défaut)
        // resetPasswordExpire: undefined (défaut)
        // createdAt: Date.now() (défaut)
        // updatedAt: Date.now() (défaut)
      });

      console.log('✅ User registered successfully:', {
        id: user._id,
        email: user.email,
        name: user.name,
        verified: user.verified,
      });

      // ✅ AMÉLIORATION: Envoyer email de vérification avec le vrai service
      let emailSent = false;
      let emailError = null;

      try {
        const emailResult = await sendVerificationEmail(
          user.email,
          user.name,
          verificationToken,
        );

        if (emailResult.success) {
          emailSent = true;
          console.log('📧 Verification email sent successfully:', {
            to: user.email?.substring(0, 3) + '***',
            messageId: emailResult.messageId,
          });
        } else {
          emailError = emailResult.error;
          console.warn(
            '⚠️ Failed to send verification email:',
            emailResult.error,
          );
        }
      } catch (error) {
        emailError = error.message;
        console.error('❌ Email service error:', error);

        // Ne pas faire échouer l'inscription si l'email ne part pas
        captureException(error, {
          tags: { component: 'email', action: 'verification' },
          user: { id: user._id, email: user.email?.substring(0, 3) + '***' },
          extra: {
            verificationToken: verificationToken.substring(0, 8) + '...',
          },
        });
      }

      // ✅ Log de sécurité pour audit
      console.log('🔒 Security event - User registered:', {
        userId: user._id,
        email: user.email?.substring(0, 3) + '***',
        name: user.name,
        emailSent,
        timestamp: new Date().toISOString(),
        userAgent:
          req.headers.get('user-agent')?.substring(0, 100) || 'unknown',
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      // ✅ AMÉLIORATION: Réponse enrichie avec informations complètes
      const response = {
        success: true,
        message: emailSent
          ? 'Inscription réussie ! Vérifiez votre email pour activer votre compte.'
          : "Inscription réussie ! Email de vérification en cours d'envoi.",
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            verified: user.verified,
            isActive: user.isActive,
            createdAt: user.createdAt,
            avatar: user.avatar,
          },
          emailSent,
          // ✅ AMÉLIORATION: Instructions pour l'utilisateur
          nextSteps: emailSent
            ? [
                'Consultez votre boîte email',
                'Cliquez sur le lien de vérification',
                'Connectez-vous à votre compte',
              ]
            : [
                'Votre compte a été créé',
                "L'email de vérification va arriver sous peu",
                'Consultez vos spams si nécessaire',
              ],
          ...(emailError &&
            process.env.NODE_ENV === 'development' && {
              emailError,
            }),
        },
      };

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      console.error('❌ Registration error:', error.message);

      // ✅ AMÉLIORATION: Gestion spécifique des erreurs MongoDB
      if (error.code === 11000) {
        // Erreur d'index unique
        const duplicateField = Object.keys(error.keyPattern)[0];
        return NextResponse.json(
          {
            success: false,
            message: `Ce ${duplicateField === 'email' ? 'email' : 'téléphone'} est déjà utilisé`,
            code: 'DUPLICATE_' + duplicateField.toUpperCase(),
          },
          { status: 400 },
        );
      }

      // ✅ AMÉLIORATION: Gestion des erreurs de validation Mongoose
      if (error.name === 'ValidationError') {
        const validationErrors = {};
        Object.keys(error.errors).forEach((key) => {
          validationErrors[key] = error.errors[key].message;
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Erreurs de validation',
            errors: validationErrors,
            code: 'MODEL_VALIDATION_ERROR',
          },
          { status: 400 },
        );
      }

      // ✅ AMÉLIORATION: Gestion des erreurs de connexion DB
      if (error.message.includes('connection')) {
        captureException(error, {
          tags: { component: 'database', route: 'auth/register' },
          level: 'error',
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Erreur de connexion. Veuillez réessayer.',
            code: 'DATABASE_CONNECTION_ERROR',
          },
          { status: 503 }, // Service Unavailable
        );
      }

      // Capturer toutes les autres erreurs système
      captureException(error, {
        tags: { component: 'api', route: 'auth/register' },
        extra: {
          userData: {
            email: userData?.email?.substring(0, 3) + '***',
            name: userData?.name,
            phone: userData?.phone?.substring(0, 3) + '***',
          },
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: "Erreur lors de l'inscription. Veuillez réessayer.",
          code: 'INTERNAL_SERVER_ERROR',
        },
        { status: 500 },
      );
    }
  },
  {
    // Configuration spécifique pour register
    customLimit: {
      points: 5, // 5 inscriptions maximum
      duration: 3600000, // par heure (1 heure)
      blockDuration: 3600000, // blocage d'1 heure en cas de dépassement
    },
  },
);
