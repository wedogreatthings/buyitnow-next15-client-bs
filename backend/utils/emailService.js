import { Resend } from 'resend';
import { captureException } from '@/monitoring/sentry';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Service d'envoi d'emails de vérification avec template HTML professionnel
 */
export const sendVerificationEmail = async (email, name, token) => {
  try {
    if (!email || !name || !token) {
      throw new Error('Missing required parameters for verification email');
    }

    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

    // Template HTML professionnel
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vérification de votre email - BuyItNow</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <!-- Header -->
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">BuyItNow</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Vérification de votre adresse email</p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${name} ! 👋</h2>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Merci de vous être inscrit(e) sur <strong>BuyItNow</strong> ! 
            Pour finaliser la création de votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              ✉️ Vérifier mon email
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">
              ${verificationUrl}
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            🔒 Ce lien est valide pendant <strong>24 heures</strong><br>
            🚫 Si vous n'avez pas créé de compte, ignorez cet email<br>
            ❓ Besoin d'aide ? Contactez-nous à support@buyitnow.com
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          © 2025 BuyItNow. Tous droits réservés.
        </div>
      </div>
    </body>
    </html>`;

    // Version texte (fallback)
    const textTemplate = `
Bonjour ${name} !

Merci de vous être inscrit(e) sur BuyItNow !

Pour finaliser la création de votre compte, cliquez sur ce lien :
${verificationUrl}

Ce lien est valide pendant 24 heures.

Si vous n'avez pas créé de compte, ignorez cet email.

Besoin d'aide ? Contactez-nous à support@buyitnow.com

---
BuyItNow - © 2025`;

    // Configuration email
    const emailOptions = {
      from:
        process.env.NODE_ENV === 'production'
          ? 'noreply@buyitnow.com'
          : 'onboarding@resend.dev',
      to: [email],
      subject: '✉️ Vérifiez votre adresse email - BuyItNow',
      html: htmlTemplate,
      text: textTemplate,
      headers: {
        'X-Entity-Ref-ID': token.substring(0, 8),
      },
    };

    // En développement, juste logger
    if (process.env.NODE_ENV === 'development') {
      console.log(`
🔗 EMAIL DE VÉRIFICATION (DEV):
📧 To: ${email}
👤 Name: ${name}
🔑 Token: ${token}
🌐 Link: ${verificationUrl}
      `);
      return { success: true, messageId: 'dev-mode' };
    }

    // Envoyer l'email via Resend
    const result = await resend.emails.send(emailOptions);

    console.log('✅ Verification email sent successfully:', {
      to: email,
      messageId: result.id || result.messageId,
      token: token.substring(0, 8) + '...',
    });

    return {
      success: true,
      messageId: result.id || result.messageId,
      email: email,
    };
  } catch (error) {
    console.error('❌ Failed to send verification email:', {
      error: error.message,
      email: email?.substring(0, 3) + '***',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Capturer l'erreur pour monitoring
    captureException(error, {
      tags: { component: 'emailService', action: 'sendVerificationEmail' },
      extra: {
        email: email?.substring(0, 3) + '***',
        hasToken: !!token,
        hasName: !!name,
      },
    });

    return {
      success: false,
      error: error.message,
      email: email,
    };
  }
};

/**
 * Service de renvoi d'email de vérification
 */
export const resendVerificationEmail = async (email, name, token) => {
  console.log(
    '📧 Resending verification email to:',
    email?.substring(0, 3) + '***',
  );
  return await sendVerificationEmail(email, name, token);
};

/**
 * Validation d'email simple
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
