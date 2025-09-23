import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import User from '@/backend/models/user';
import { validateContactMessage } from '@/helpers/validation/schemas/contact';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/emails
 * Envoie un email de contact
 * Rate limit: 3 emails par 15 minutes (protection anti-spam strict)
 */
export const POST = withApiRateLimit(
  async function (req) {
    try {
      // Vérifier l'authentification
      await isAuthenticatedUser(req, NextResponse);

      // Connexion DB
      await dbConnect();

      // Récupérer l'utilisateur
      const user = await User.findOne({ email: req.user.email }).select(
        '_id name email',
      );

      if (!user) {
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 },
        );
      }

      // Parser et valider les données
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          { success: false, message: 'Invalid request body' },
          { status: 400 },
        );
      }

      const { subject, message } = body;

      // Validation avec Yup
      const validation = await validateContactMessage({ subject, message });

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

      // Options de l'email pour Resend
      const emailOptions = {
        from: 'onboarding@resend.dev', // Remplacez par votre domaine vérifié
        reply_to: user.email,
        to: ['fathismael@gmail.com'], // Email de destination
        subject: `[Contact] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Message de contact</h2>
            <p><strong>De:</strong> ${user.name} (${user.email})</p>
            <p><strong>Sujet:</strong> ${subject}</p>
            <hr style="border: 1px solid #eee;">
            <div style="white-space: pre-wrap;">${message}</div>
            <hr style="border: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              Message envoyé depuis BuyItNow
            </p>
          </div>
        `,
        text: `De: ${user.name} (${user.email})\nSujet: ${subject}\n\n${message}`,
      };

      // Envoyer l'email
      const emailResult = await resend.emails.send(emailOptions);

      // Succès
      return NextResponse.json(
        {
          success: true,
          message: 'Email sent successfully',
          data: emailResult,
        },
        {
          status: 201,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    } catch (error) {
      console.error('Email send error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (!error.message?.includes('authentication')) {
        captureException(error, {
          tags: { component: 'api', route: 'emails/POST' },
        });
      }

      // Gestion simple des erreurs
      let status = 500;
      let message = 'Failed to send email';

      if (error.message?.includes('authentication')) {
        status = 401;
        message = 'Authentication failed';
      } else if (error.name === 'ValidationError') {
        status = 400;
        message = 'Invalid data';
      }

      return NextResponse.json({ success: false, message }, { status });
    }
  },
  {
    customLimit: {
      points: 3, // 3 emails maximum
      duration: 900000, // par période de 15 minutes
      blockDuration: 1800000, // blocage de 30 minutes en cas de dépassement
    },
  },
);
