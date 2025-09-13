/**
 * Vérifie si une chaîne est une URI MongoDB valide
 * @param {string} uri - URI à valider
 * @returns {boolean} - True si l'URI est valide
 */
export function isValidMongoURI(uri) {
  if (!uri || typeof uri !== 'string') {
    return false;
  }

  // Vérifier si l'URI commence par mongodb:// ou mongodb+srv://
  const validProtocols = ['mongodb://', 'mongodb+srv://'];
  const hasValidProtocol = validProtocols.some((protocol) =>
    uri.startsWith(protocol),
  );

  if (!hasValidProtocol) {
    return false;
  }

  try {
    // Vérifier si l'URI peut être construite en URL valide
    // Note: cette vérification est assez permissive
    const url = new URL(uri);

    // Vérifier qu'il y a un hôte valide
    if (!url.hostname) {
      return false;
    }

    // Vérifications supplémentaires spécifiques à MongoDB
    // Si l'URI contient des paramètres d'authentification, ils doivent être correctement formatés
    if (url.username && !url.password) {
      // MongoDB nécessite généralement un mot de passe si un nom d'utilisateur est spécifié
      // Mais certaines configurations pourraient ne pas en avoir besoin
      // donc nous ne considérons pas cela comme une erreur fatale
    }

    // Vérifier si un nom de base de données est spécifié (après le premier slash)
    // Non obligatoire, mais typique dans une URI MongoDB
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) {
      // C'est OK, pas de base de données spécifiée
    }

    return true;
  } catch (error) {
    return false;
  }
}
