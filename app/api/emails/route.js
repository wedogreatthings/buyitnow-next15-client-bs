import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import dbConnect from '@/backend/config/dbConnect';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import User from '@/backend/models/user';
import Contact from '@/backend/models/contact';
import { validateContactMessage } from '@/helpers/validation/schemas/contact';
import { captureException } from '@/monitoring/sentry';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/emails
 * Envoie un email de contact et enregistre le message
 */
export async function POST(req) {
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
      from: 'BuyItNow <contact@votre-domaine.com>', // Remplacez par votre domaine vérifié
      reply_to: user.email,
      to: ['contact@votre-domaine.com'], // Email de destination
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

    // Envoyer l'email et sauvegarder en parallèle
    const [emailResult, contactResult] = await Promise.allSettled([
      resend.emails.send(emailOptions),
      Contact.create({
        from: user._id,
        subject: subject.trim(),
        message: message.trim(),
        status: 'sent',
      }),
    ]);

    // Gérer les résultats
    if (
      emailResult.status === 'rejected' &&
      contactResult.status === 'rejected'
    ) {
      throw new Error('Failed to send email and save message');
    }

    if (emailResult.status === 'rejected') {
      // Email échoué mais message sauvegardé
      if (contactResult.status === 'fulfilled') {
        await Contact.findByIdAndUpdate(contactResult.value._id, {
          status: 'error',
        });
      }

      return NextResponse.json(
        {
          success: false,
          message: 'Email could not be sent, but message was recorded',
        },
        { status: 500 },
      );
    }

    // Succès
    return NextResponse.json(
      {
        success: true,
        message: 'Email sent successfully',
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
}
