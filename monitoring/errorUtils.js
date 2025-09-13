/**
 * Utilitaires pour la gestion centralisée des erreurs
 */

/**
 * Enrichit une erreur avec des métadonnées et la prépare pour être captée par l'ErrorBoundary
 *
 * @param {Error} error - L'objet erreur original
 * @param {string} componentName - Nom du composant source de l'erreur
 * @param {Object} contextInfo - Informations additionnelles sur le contexte de l'erreur
 * @returns {Error} Erreur enrichie prête à être lancée
 */
export const enrichError = (error, componentName, contextInfo = {}) => {
  // S'assurer que l'erreur est un objet Error
  const enrichedError =
    error instanceof Error
      ? error
      : new Error(error?.message || 'Une erreur inconnue est survenue');

  // Ajouter des métadonnées à l'erreur
  enrichedError.componentName = componentName;
  enrichedError.additionalInfo = {
    ...contextInfo,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : null,
  };

  return enrichedError;
};

/**
 * Crée et lance une erreur enrichie à destination de l'ErrorBoundary
 *
 * @param {Error|string} error - L'erreur ou le message d'erreur
 * @param {string} componentName - Nom du composant source
 * @param {Object} contextInfo - Données contextuelles sur l'erreur
 * @throws {Error} Lance toujours l'erreur enrichie
 */
export const throwEnrichedError = (error, componentName, contextInfo = {}) => {
  const enrichedError = enrichError(error, componentName, contextInfo);

  // En développement, ajouter plus de contexte dans la console pour faciliter le debugging
  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[${componentName}] Error:`,
      enrichedError.message,
      contextInfo,
    );
  }

  throw enrichedError;
};

/**
 * Gère de manière asynchrone une erreur avec possibilité de fallback
 * Utile pour les erreurs dans useEffect où throw ne fonctionnerait pas bien
 *
 * @param {Error} error - L'erreur à gérer
 * @param {string} componentName - Nom du composant source
 * @param {Object} contextInfo - Informations additionnelles
 * @param {Function} fallbackFn - Fonction à exécuter en cas d'erreur (optionnel)
 */
export const handleAsyncError = (
  error,
  componentName,
  contextInfo = {},
  fallbackFn,
) => {
  const enrichedError = enrichError(error, componentName, contextInfo);

  // Log pour debugging
  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[${componentName}] Async Error:`,
      enrichedError.message,
      contextInfo,
    );
  }

  // Exécution du fallback si fourni
  if (typeof fallbackFn === 'function') {
    try {
      fallbackFn(enrichedError);
    } catch (fallbackError) {
      console.error('Error in fallback handler:', fallbackError);
    }
  }

  // Déclencher l'erreur au prochain tick pour qu'elle soit capturée par l'ErrorBoundary
  setTimeout(() => {
    throw enrichedError;
  }, 0);
};

/**
 * Déterminer les informations d'affichage adaptées selon le type d'erreur
 *
 * @param {Error} error - Erreur à analyser
 * @returns {Object} Informations formatées pour l'affichage et le monitoring
 */
export const getErrorDisplayInfo = (error) => {
  // Mapping des composants vers des messages d'erreur spécifiques
  const componentErrorMap = {
    Header: {
      title: 'Erreur de navigation',
      message:
        'Un problème est survenu dans la barre de navigation. Veuillez réessayer.',
      level: 'warning',
      actionMap: {
        loadCart: 'Impossible de charger votre panier. Veuillez réessayer.',
        initUserData: 'Impossible de charger vos informations utilisateur.',
        handleSignOut: "La déconnexion n'a pas pu être effectuée correctement.",
      },
    },
    Search: {
      title: 'Erreur de recherche',
      message:
        'Un problème est survenu lors de votre recherche. Veuillez réessayer.',
      level: 'warning',
    },
    // Ajouter d'autres composants au besoin
  };

  // Récupérer les infos spécifiques au composant ou utiliser les valeurs par défaut
  const componentInfo = componentErrorMap[error.componentName] || {
    title: "Une erreur s'est produite",
    message:
      'Nous rencontrons un problème technique. Notre équipe a été notifiée.',
    level: 'error',
  };

  // Si l'action est spécifiée et qu'il y a un message personnalisé pour cette action
  if (
    error.additionalInfo?.action &&
    componentInfo.actionMap &&
    componentInfo.actionMap[error.additionalInfo.action]
  ) {
    componentInfo.message =
      componentInfo.actionMap[error.additionalInfo.action];
  }

  return {
    title: componentInfo.title,
    message: componentInfo.message,
    level: componentInfo.level,
    tags: {
      errorType: `${error.componentName?.toLowerCase() || 'unknown'}_error`,
      component: error.componentName || 'Unknown',
      action: error.additionalInfo?.action || 'unknown',
    },
  };
};
