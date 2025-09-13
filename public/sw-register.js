// Script pour enregistrer le service worker

// Ne s'exécute que dans un navigateur compatible et en production
if ('serviceWorker' in navigator) {
  // Effectuer une vérification plus complète de compatibilité
  const isSWSupported = 'serviceWorker' in navigator;
  const isLocalStorageSupported = (function () {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  })();

  // Utiliser la variable exposée par EnvInit ou détecter l'environnement
  const isProduction =
    typeof window !== 'undefined' &&
    (window.NEXT_PUBLIC_NODE_ENV === 'production' ||
      // Détection plus robuste de l'environnement
      (window.location.hostname !== 'localhost' &&
        !window.location.hostname.includes('127.0.0.1') &&
        !window.location.hostname.includes('.local') &&
        !window.location.hostname.includes('dev.') &&
        !window.location.hostname.includes('staging.')));

  // Créer une fonction de log qui enregistre les erreurs critiques même en production
  const logInfo = isProduction ? () => {} : console.log;
  const logError = (message, error) => {
    if (!isProduction) {
      console.error(message, error);
    } else if (
      error &&
      (error instanceof TypeError || error.name === 'SecurityError')
    ) {
      // Enregistrer uniquement les erreurs critiques en production
      console.error('[SW] Erreur critique:', message);
    }
  };

  if (isProduction && isSWSupported && isLocalStorageSupported) {
    window.addEventListener('load', function () {
      // Utiliser requestIdleCallback si disponible, sinon setTimeout
      const registerWhenIdle = window.requestIdleCallback || setTimeout;

      registerWhenIdle(
        () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then(function (registration) {
              logInfo(
                'Service Worker enregistré avec succès:',
                registration.scope,
              );

              // Vérifier si un nouveau service worker est en attente d'installation
              if (registration.waiting) {
                // Notifier l'utilisateur de la mise à jour
                notifyUpdate(registration);
              }

              // Écouter les mises à jour du service worker
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                  if (
                    newWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    notifyUpdate(registration);
                  }
                });
              });
            })
            .catch(function (error) {
              logError("Échec de l'enregistrement du Service Worker:", error);
            });
        },
        { timeout: 5000 },
      );

      // Recharger la page lors d'un changement de service worker contrôlant la page
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

// Fonction pour notifier l'utilisateur d'une mise à jour
function notifyUpdate(registration) {
  // Préfixe unique pour éviter les conflits de styles
  const prefix = 'buyitnow-sw';

  // Créer la notification de mise à jour avec des méthodes DOM sécurisées
  const updateNotification = document.createElement('div');
  updateNotification.className = `${prefix}-update-notification`;

  const content = document.createElement('div');
  content.className = `${prefix}-update-content`;

  const message = document.createElement('p');
  message.textContent = "Une nouvelle version de l'application est disponible!";

  const button = document.createElement('button');
  button.id = `${prefix}-update-button`;
  button.textContent = 'Mettre à jour';

  content.appendChild(message);
  content.appendChild(button);
  updateNotification.appendChild(content);

  // Ajouter le style de la notification
  const style = document.createElement('style');
  style.textContent = `
      .${prefix}-update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #2563eb;
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        max-width: 300px;
        animation: ${prefix}-notification-fadein 0.5s;
      }
      
      .${prefix}-update-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }
      
      .${prefix}-update-content p {
        margin: 0 0 12px 0;
        font-size: 14px;
      }
      
      #${prefix}-update-button {
        padding: 8px 16px;
        background-color: white;
        color: #2563eb;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
      }
      
      #${prefix}-update-button:hover {
        background-color: #f3f4f6;
      }
      
      @keyframes ${prefix}-notification-fadein {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;

  // Ajouter la notification et le style au document
  document.head.appendChild(style);
  document.body.appendChild(updateNotification);

  // Ajouter l'événement de clic pour mettre à jour
  document
    .getElementById(`${prefix}-update-button`)
    .addEventListener('click', () => {
      if (registration.waiting) {
        // Demander au service worker en attente de prendre le contrôle
        registration.waiting.postMessage({ action: 'skipWaiting' });
      }

      // Nettoyer la notification
      updateNotification.remove();
      style.remove();
    });

  // Ajouter la possibilité de fermer la notification après un certain temps
  const autoCloseTimeout = 5 * 60 * 1000; // 5 minutes
  const timeoutId = setTimeout(() => {
    if (document.body.contains(updateNotification)) {
      updateNotification.remove();
      style.remove();
    }
  }, autoCloseTimeout);

  // S'assurer que le timeout est nettoyé si la notification est fermée manuellement
  button.addEventListener('click', () => {
    clearTimeout(timeoutId);
  });
}
