// monitoring/sentry.js - VERSION REFACTORISÉE
import * as Sentry from '@sentry/nextjs';

/**
 * NE PAS initialiser Sentry ici !
 * L'initialisation se fait dans instrumentation.js / sentry.server.config.js
 */

const captureClientError = (error, component, action, isCritical = false) => {
  // Ne capturer que si Sentry est initialisé
  if (typeof window === 'undefined') return;

  // Pour 500 users/jour, être sélectif
  if (!isCritical && Math.random() > 0.3) return; // 30% sampling non-critique

  captureException(error, {
    tags: {
      component,
      action,
      critical: isCritical,
      client_side: true,
    },
    fingerprint: [component, action, error.name], // Grouper les erreurs similaires
  });
};

/**
 * Capture une exception avec des informations contextuelles supplémentaires
 * @param {Error} error - L'erreur à capturer
 * @param {Object} context - Contexte supplémentaire sur l'erreur
 */
export const captureException = (error, context = {}) => {
  // Vérifier que Sentry est initialisé
  if (!Sentry.getCurrentScope()) {
    console.error('Sentry not initialized:', error);
    return;
  }

  Sentry.withScope((scope) => {
    // Ajouter des tags pour faciliter le filtrage dans Sentry
    Object.entries(context.tags || {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    // Ajouter des données supplémentaires
    Object.entries(context.extra || {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // Définir le niveau de l'erreur
    if (context.level) {
      scope.setLevel(context.level);
    }

    // Capturer l'exception
    Sentry.captureException(error);
  });
};

/**
 * Capture un message avec des informations contextuelles supplémentaires
 * @param {string} message - Le message à capturer
 * @param {Object} context - Contexte supplémentaire sur le message
 */
export const captureMessage = (message, context = {}) => {
  // Vérifier que Sentry est initialisé
  if (!Sentry.getCurrentScope()) {
    console.warn('Sentry not initialized:', message);
    return;
  }

  Sentry.withScope((scope) => {
    // Ajouter des tags pour faciliter le filtrage dans Sentry
    Object.entries(context.tags || {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    // Ajouter des données supplémentaires
    Object.entries(context.extra || {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // Définir le niveau du message
    if (context.level) {
      scope.setLevel(context.level);
    }

    // Capturer le message
    Sentry.captureMessage(message);
  });
};

/**
 * Enregistre l'utilisateur actuel dans Sentry pour le suivi des erreurs
 * @param {Object} user - Informations de l'utilisateur à enregistrer
 */
export const setUser = (user) => {
  if (!Sentry.getCurrentScope()) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  // Ne jamais envoyer d'informations sensibles à Sentry
  Sentry.setUser({
    id: user.id || user._id,
    // Anonymiser l'email en ne conservant que son hachage
    email: user.email ? `${hashCode(user.email)}@anonymized.user` : undefined,
    role: user.role || 'user',
  });
};

/**
 * Fonction auxiliaire pour créer un hachage simple d'une chaîne
 * @param {string} str - La chaîne à hacher
 * @returns {string} - Le hachage en hexadécimal
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Conversion en 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Export par défaut pour compatibilité
export default {
  captureClientError,
  captureException,
  captureMessage,
  setUser,
};
