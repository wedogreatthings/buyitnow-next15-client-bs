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
          ? 'onboarding@resend.dev'
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

// backend/utils/emailService.js - FONCTIONS À AJOUTER
// Ajoutez ces fonctions dans votre fichier emailService.js existant

/**
 * Envoie un email de réinitialisation de mot de passe
 * @param {string} email - L'adresse email du destinataire
 * @param {string} name - Le nom de l'utilisateur
 * @param {string} resetToken - Le token de réinitialisation (non hashé)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendPasswordResetEmail = async (email, name, resetToken) => {
  try {
    // Validation des paramètres
    if (!email || !name || !resetToken) {
      throw new Error('Missing required parameters for password reset email');
    }

    // Construction de l'URL de réinitialisation
    const resetUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/reset-password?token=${resetToken}`;

    // Template HTML professionnel
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réinitialisation de votre mot de passe - BuyItNow</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🔐 BuyItNow</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 16px;">Réinitialisation de mot de passe</p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 35px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${name} 👋</h2>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
            Vous avez demandé la réinitialisation de votre mot de passe pour votre compte <strong>BuyItNow</strong>.
            Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous :
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
              🔑 Réinitialiser mon mot de passe
            </a>
          </div>

          <!-- Warning Box -->
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; color: #92400e; font-weight: bold;">
              ⏰ Attention : Ce lien expire dans 1 heure
            </p>
            <p style="margin: 5px 0 0 0; color: #92400e; font-size: 14px;">
              Pour des raisons de sécurité, ce lien de réinitialisation sera invalide après 60 minutes.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
            <a href="${resetUrl}" style="color: #667eea; word-break: break-all; font-size: 13px;">
              ${resetUrl}
            </a>
          </p>

          <!-- Security Notice -->
          <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: bold;">
              🔒 Sécurité importante
            </p>
            <p style="margin: 5px 0 0 0; color: #991b1b; font-size: 14px;">
              Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. 
              Votre mot de passe restera inchangé et votre compte reste sécurisé.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <!-- Tips -->
          <div style="background: #f9fafb; border-radius: 6px; padding: 20px;">
            <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">
              💡 Conseils pour un mot de passe sécurisé :
            </h3>
            <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 10px 0;">
              <li>Utilisez au moins <strong>8 caractères</strong></li>
              <li>Incluez des <strong>majuscules</strong> et <strong>minuscules</strong></li>
              <li>Ajoutez des <strong>chiffres</strong> et des <strong>caractères spéciaux</strong> (@$!%*?&#)</li>
              <li>Évitez les <strong>informations personnelles</strong> (nom, date de naissance)</li>
              <li>N'utilisez pas de <strong>mots du dictionnaire</strong></li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 25px 20px 20px 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">
            Besoin d'aide ? Contactez notre support à 
            <a href="mailto:support@buyitnow.com" style="color: #667eea;">support@buyitnow.com</a>
          </p>
          <p style="margin: 0 0 8px 0;">
            📞 +253 77 00 00 00 | Du lundi au vendredi, 9h-18h
          </p>
          <p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            © 2025 BuyItNow. Tous droits réservés.<br>
            Djibouti, Djibouti
          </p>
        </div>
      </div>
    </body>
    </html>`;

    // Version texte (fallback)
    const textTemplate = `
Bonjour ${name},

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte BuyItNow.

Pour créer un nouveau mot de passe, cliquez sur le lien ci-dessous :
${resetUrl}

⏰ ATTENTION : Ce lien expire dans 1 heure pour des raisons de sécurité.

🔒 SÉCURITÉ : Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. 
Votre mot de passe restera inchangé et votre compte reste sécurisé.

💡 Conseils pour un mot de passe sécurisé :
- Utilisez au moins 8 caractères
- Incluez des majuscules et minuscules
- Ajoutez des chiffres et des caractères spéciaux (@$!%*?&#)
- Évitez les informations personnelles
- N'utilisez pas de mots du dictionnaire

Besoin d'aide ? 
Contactez notre support : support@buyitnow.com
Téléphone : +253 77 00 00 00

---
© 2025 BuyItNow. Tous droits réservés.
Djibouti, Djibouti`;

    // Configuration email avec Resend
    const emailOptions = {
      from:
        process.env.NODE_ENV === 'production'
          ? 'security@buyitnow.com' // Remplacez par votre domaine vérifié
          : 'onboarding@resend.dev',
      to: [email],
      subject: '🔐 Réinitialisation de votre mot de passe - BuyItNow',
      html: htmlTemplate,
      text: textTemplate,
      headers: {
        'X-Entity-Ref-ID': resetToken.substring(0, 8),
        'X-Priority': '1',
        Importance: 'high',
      },
    };

    // En développement, juste logger
    if (process.env.NODE_ENV === 'development') {
      console.log(`
🔐 EMAIL DE RÉINITIALISATION (DEV):
📧 To: ${email}
👤 Name: ${name}
🔑 Token: ${resetToken.substring(0, 16)}...
🌐 Link: ${resetUrl}
⏰ Expires: 1 heure
      `);
      return { success: true, messageId: 'dev-mode-reset' };
    }

    // Envoyer l'email via Resend
    const result = await resend.emails.send(emailOptions);

    console.log('✅ Password reset email sent successfully:', {
      to: email?.substring(0, 3) + '***',
      messageId: result.id || result.data?.id,
      token: resetToken.substring(0, 8) + '...',
    });

    return {
      success: true,
      messageId: result.id || result.data?.id,
      email: email,
    };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', {
      error: error.message,
      email: email?.substring(0, 3) + '***',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Capturer l'erreur pour monitoring
    captureException(error, {
      tags: { component: 'emailService', action: 'sendPasswordResetEmail' },
      extra: {
        email: email?.substring(0, 3) + '***',
        hasToken: !!resetToken,
        hasName: !!name,
      },
    });

    return {
      success: false,
      error: error.message || 'Failed to send password reset email',
      email: email,
    };
  }
};

/**
 * Envoie un email de confirmation après réinitialisation réussie du mot de passe
 * @param {string} email - L'adresse email du destinataire
 * @param {string} name - Le nom de l'utilisateur
 * @param {string} ipAddress - L'adresse IP de la demande (optionnel)
 * @param {string} userAgent - Le user agent du navigateur (optionnel)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendPasswordResetSuccessEmail = async (
  email,
  name,
  ipAddress = 'Inconnue',
  userAgent = 'Inconnu',
) => {
  try {
    // Validation des paramètres
    if (!email || !name) {
      throw new Error('Missing required parameters for success email');
    }

    // Formater la date et l'heure
    const resetDate = new Date().toLocaleString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Djibouti',
    });

    // Détecter le navigateur depuis le user agent
    let browser = 'Inconnu';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Template HTML professionnel
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mot de passe modifié avec succès - BuyItNow</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
          <h1 style="margin: 0; font-size: 28px;">Mot de passe modifié</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 16px;">Votre mot de passe a été changé avec succès</p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 35px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${name} 👋</h2>
          
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
            Nous vous confirmons que votre mot de passe <strong>BuyItNow</strong> a été modifié avec succès.
          </p>

          <!-- Details Box -->
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px;">
              📍 Détails de la modification :
            </h3>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 40%;">Date et heure :</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${resetDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Adresse IP :</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Navigateur :</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${browser}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Compte :</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${email}</td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/login" 
               style="background: #2563eb; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              🔓 Se connecter à mon compte
            </a>
          </div>

          <!-- Security Alert -->
          <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 10px 0; color: #991b1b; font-size: 16px;">
              ⚠️ Ce n'était pas vous ?
            </h3>
            <p style="margin: 0 0 15px 0; color: #991b1b; font-size: 14px; line-height: 1.5;">
              Si vous n'avez pas effectué cette modification, votre compte pourrait être compromis. 
              Prenez immédiatement les mesures suivantes :
            </p>
            <ol style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 14px; line-height: 1.8;">
              <li>Cliquez <a href="${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/forgot-password" style="color: #dc2626; font-weight: bold;">ici</a> pour réinitialiser votre mot de passe</li>
              <li>Vérifiez vos autres comptes utilisant le même mot de passe</li>
              <li>Contactez immédiatement notre support</li>
              <li>Activez l'authentification à deux facteurs</li>
            </ol>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <!-- Security Tips -->
          <div style="background: #f9fafb; border-radius: 6px; padding: 20px;">
            <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">
              🔐 Conseils de sécurité :
            </h3>
            <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 10px 0;">
              <li><strong>Mot de passe unique :</strong> Utilisez un mot de passe différent pour chaque site</li>
              <li><strong>Gestionnaire :</strong> Utilisez un gestionnaire de mots de passe sécurisé</li>
              <li><strong>Phishing :</strong> Vérifiez toujours l'URL avant de saisir vos identifiants</li>
              <li><strong>Activité suspecte :</strong> Surveillez régulièrement votre compte</li>
              <li><strong>Mises à jour :</strong> Gardez votre navigateur à jour</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 25px; padding: 15px; background: #f3f4f6; border-radius: 6px;">
            ℹ️ <strong>Note importante :</strong> Pour votre sécurité, vous devrez vous reconnecter sur tous vos appareils avec votre nouveau mot de passe.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 25px 20px 20px 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #6b7280;">
            Besoin d'aide urgente ?
          </p>
          <p style="margin: 0 0 8px 0;">
            📧 <a href="mailto:support@buyitnow.com" style="color: #667eea;">support@buyitnow.com</a> | 
            📞 +253 77 00 00 00
          </p>
          <p style="margin: 0 0 8px 0;">
            Centre d'aide : <a href="${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/help" style="color: #667eea;">buyitnow.com/help</a>
          </p>
          <p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            Cet email a été envoyé automatiquement pour des raisons de sécurité.<br>
            © 2025 BuyItNow. Tous droits réservés. Djibouti, Djibouti
          </p>
        </div>
      </div>
    </body>
    </html>`;

    // Version texte (fallback)
    const textTemplate = `
Bonjour ${name},

✅ Nous vous confirmons que votre mot de passe BuyItNow a été modifié avec succès.

📍 DÉTAILS DE LA MODIFICATION :
- Date et heure : ${resetDate}
- Adresse IP : ${ipAddress}
- Navigateur : ${browser}
- Compte : ${email}

Pour vous connecter avec votre nouveau mot de passe :
${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/login

⚠️ CE N'ÉTAIT PAS VOUS ?
Si vous n'avez pas effectué cette modification, votre compte pourrait être compromis.
Prenez immédiatement les mesures suivantes :

1. Réinitialisez votre mot de passe : ${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/forgot-password
2. Vérifiez vos autres comptes utilisant le même mot de passe
3. Contactez notre support : support@buyitnow.com
4. Activez l'authentification à deux facteurs si disponible

🔐 CONSEILS DE SÉCURITÉ :
- Utilisez un mot de passe unique pour chaque site
- Utilisez un gestionnaire de mots de passe sécurisé
- Vérifiez toujours l'URL avant de saisir vos identifiants
- Surveillez régulièrement l'activité de votre compte
- Gardez votre navigateur à jour

ℹ️ Note : Pour votre sécurité, vous devrez vous reconnecter sur tous vos appareils.

Besoin d'aide ?
Support : support@buyitnow.com
Téléphone : +253 77 00 00 00
Centre d'aide : ${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_API_URL}/help

---
Cet email a été envoyé automatiquement pour des raisons de sécurité.
© 2025 BuyItNow. Tous droits réservés.`;

    // Configuration email avec Resend
    const emailOptions = {
      from:
        process.env.NODE_ENV === 'production'
          ? 'security@buyitnow.com' // Remplacez par votre domaine vérifié
          : 'onboarding@resend.dev',
      to: [email],
      subject: '✅ Votre mot de passe BuyItNow a été modifié',
      html: htmlTemplate,
      text: textTemplate,
      headers: {
        'X-Entity-Ref-ID': new Date().getTime().toString(),
        'X-Priority': '1',
        Importance: 'high',
      },
    };

    // En développement, juste logger
    if (process.env.NODE_ENV === 'development') {
      console.log(`
✅ EMAIL DE CONFIRMATION (DEV):
📧 To: ${email}
👤 Name: ${name}
📅 Date: ${resetDate}
🌐 IP: ${ipAddress}
🖥️ Browser: ${browser}
      `);
      return { success: true, messageId: 'dev-mode-success' };
    }

    // Envoyer l'email via Resend
    const result = await resend.emails.send(emailOptions);

    console.log('✅ Password reset success email sent:', {
      to: email?.substring(0, 3) + '***',
      messageId: result.id || result.data?.id,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      messageId: result.id || result.data?.id,
      email: email,
    };
  } catch (error) {
    console.error('❌ Failed to send password reset success email:', {
      error: error.message,
      email: email?.substring(0, 3) + '***',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Ne pas capturer dans Sentry car ce n'est pas critique
    // L'email de confirmation est optionnel

    return {
      success: false,
      error: error.message || 'Failed to send password reset success email',
      email: email,
    };
  }
};
