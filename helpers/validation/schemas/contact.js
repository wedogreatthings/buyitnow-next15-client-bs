/**
 * Schéma de validation pour le formulaire de contact
 */

import * as yup from 'yup';
import { sanitizeString, validate, noNoSqlInjection } from '../core/utils';

// Schéma de contact
export const contactSchema = yup.object().shape({
  subject: yup
    .string()
    .transform(sanitizeString)
    .required('Sujet obligatoire')
    .min(3, 'Minimum 3 caractères')
    .max(100, 'Maximum 100 caractères')
    .matches(
      /^[a-zA-Z0-9\s\u00C0-\u017F.,!?'\-()]+$/,
      'Caractères non autorisés',
    )
    .test('no-nosql', 'Format invalide', noNoSqlInjection),

  message: yup
    .string()
    .transform(sanitizeString)
    .required('Message obligatoire')
    .min(10, 'Minimum 10 caractères')
    .max(1000, 'Maximum 1000 caractères')
    .test('no-nosql', 'Format invalide', noNoSqlInjection)
    .test('no-caps', 'Trop de majuscules', (value) => {
      if (!value) return true;
      const letters = value.replace(/[^a-zA-Z]/g, '');
      if (letters.length === 0) return true;
      const uppercaseRatio =
        letters.split('').filter((char) => char === char.toUpperCase()).length /
        letters.length;
      return uppercaseRatio <= 0.8;
    }),
});

// Fonction de validation
export const validateContactMessage = (data) => validate(contactSchema, data);

// Classification du message (optionnel)
export const classifyMessageType = (subject, message) => {
  const content = `${subject} ${message}`.toLowerCase();

  const types = {
    support: ['aide', 'problème', 'erreur', 'bug', 'support'],
    complaint: ['plainte', 'réclamation', 'insatisfait', 'remboursement'],
    question: ['question', 'comment', 'pourquoi', 'quand', 'où'],
    compliment: ['merci', 'félicitation', 'excellent', 'parfait'],
    suggestion: ['suggestion', 'amélioration', 'fonctionnalité', 'idée'],
  };

  for (const [type, keywords] of Object.entries(types)) {
    if (keywords.some((keyword) => content.includes(keyword))) {
      return type;
    }
  }

  return 'general';
};

// Vérifier si urgent
export const isMessageUrgent = (subject, message) => {
  const content = `${subject} ${message}`.toLowerCase();
  const urgentKeywords = ['urgent', 'immédiat', 'rapidement', 'asap'];
  return urgentKeywords.some((keyword) => content.includes(keyword));
};

// Formater pour email
export const formatContactEmail = (contactData, userInfo = null) => {
  const { subject, message } = contactData;
  const messageType = classifyMessageType(subject, message);
  const isUrgent = isMessageUrgent(subject, message);

  return {
    subject: `[${messageType.toUpperCase()}] ${subject}`,
    message: message,
    priority: isUrgent ? 'high' : 'normal',
    category: messageType,
    user: userInfo
      ? {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
        }
      : null,
    timestamp: new Date().toISOString(),
  };
};
