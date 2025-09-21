'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { Mail, CheckCircle, AlertCircle, LoaderCircle } from 'lucide-react';

/**
 * Composant bouton pour renvoyer un email de vérification
 */
const ResendVerificationButton = ({
  email,
  className = '',
  variant = 'primary',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState(email || '');
  const [showEmailInput, setShowEmailInput] = useState(!email);

  // Validation email simple
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Gestionnaire de renvoi d'email
  const handleResend = async () => {
    // Validation de l'email
    if (!userEmail || !isValidEmail(userEmail)) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEmailSent(true);
        toast.success(
          data.message || 'Email de vérification envoyé avec succès !',
        );

        // Cacher le formulaire email si il était affiché
        setShowEmailInput(false);
      } else {
        // Gestion des différents types d'erreur
        switch (data.code) {
          case 'ALREADY_VERIFIED':
            toast.info(data.message);
            break;
          case 'RATE_LIMITED':
            toast.warning(data.message);
            break;
          case 'INVALID_EMAIL_FORMAT':
            toast.error("Format d'email invalide");
            break;
          case 'EMAIL_SENT_IF_EXISTS':
            toast.success(data.message);
            setEmailSent(true);
            break;
          default:
            toast.error(data.message || "Erreur lors de l'envoi de l'email");
        }
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // Classes CSS selon le variant
  const getButtonClasses = () => {
    const baseClasses =
      'w-full font-semibold py-3 px-4 rounded-md transition duration-200 text-center flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';

    switch (variant) {
      case 'secondary':
        return `${baseClasses} bg-gray-100 hover:bg-gray-200 text-gray-800 ${className}`;
      case 'success':
        return `${baseClasses} bg-green-600 hover:bg-green-700 text-white ${className}`;
      case 'outline':
        return `${baseClasses} bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 ${className}`;
      default: // primary
        return `${baseClasses} bg-blue-600 hover:bg-blue-700 text-white ${className}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Champ email si pas fourni ou si on veut le modifier */}
      {showEmailInput && (
        <div>
          <label
            htmlFor="resend-email"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Adresse email pour la vérification
          </label>
          <input
            id="resend-email"
            type="email"
            placeholder="votre@email.com"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
            required
          />
        </div>
      )}

      {/* Email affiché si fourni et pas en mode édition */}
      {!showEmailInput && userEmail && (
        <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Email :</span>
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm font-mono text-gray-800">{userEmail}</p>
            <button
              onClick={() => setShowEmailInput(true)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
              disabled={isLoading}
            >
              Modifier
            </button>
          </div>
        </div>
      )}

      {/* Bouton de renvoi */}
      {!emailSent ? (
        <button
          onClick={handleResend}
          disabled={isLoading || !userEmail}
          className={getButtonClasses()}
        >
          {isLoading ? (
            <>
              <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Mail className="mr-2 w-4 h-4" />
              Renvoyer l&apos;email de vérification
            </>
          )}
        </button>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <p className="text-green-800 font-medium text-sm">
                Email envoyé !
              </p>
              <p className="text-green-700 text-xs mt-1">
                Vérifiez votre boîte de réception (et vos spams).
              </p>
            </div>
          </div>

          {/* Bouton pour renvoyer à nouveau */}
          <button
            onClick={() => {
              setEmailSent(false);
              setIsLoading(false);
            }}
            className="mt-3 text-xs text-green-700 hover:text-green-800 underline"
          >
            Renvoyer à nouveau
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start">
          <AlertCircle className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-800 text-xs font-medium">
              Conseils pour recevoir l&apos;email :
            </p>
            <ul className="text-blue-700 text-xs mt-1 space-y-1">
              <li>• Vérifiez votre dossier spam/courrier indésirable</li>
              <li>• L&apos;email peut prendre quelques minutes à arriver</li>
              <li>• Le lien de vérification expire après 24 heures</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResendVerificationButton;
