'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  Mail,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  Shield,
  Zap,
} from 'lucide-react';

/**
 * Composant principal de vérification email
 */
const VerifyEmail = ({ user }) => {
  // États du composant
  const [isResending, setIsResending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastSentTime, setLastSentTime] = useState(null);

  // Effet pour gérer le countdown de renvoi
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  // ✅ UTILISE L'API EXISTANTE: /api/auth/resend-verification
  const handleResendEmail = useCallback(async () => {
    // Vérifier le rate limiting côté client
    if (lastSentTime && Date.now() - lastSentTime < 60000) {
      // 1 minute
      const remainingSeconds = Math.ceil(
        (60000 - (Date.now() - lastSentTime)) / 1000,
      );
      toast.warning(
        `Veuillez attendre ${remainingSeconds} secondes avant de renvoyer l'email`,
      );
      return;
    }

    setIsResending(true);

    try {
      // ✅ APPEL À L'API EXISTANTE
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Succès
        setEmailSent(true);
        setLastSentTime(Date.now());
        setCountdown(60); // 60 secondes avant prochain renvoi
        toast.success(
          data.message || 'Email de vérification envoyé avec succès !',
        );

        // Log pour développement
        if (process.env.NODE_ENV === 'development') {
          console.log('Verification email resent successfully:', {
            email: user.email?.substring(0, 3) + '***',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Gestion des erreurs spécifiques
        switch (data.code) {
          case 'ALREADY_VERIFIED':
            toast.info(data.message);
            // Rediriger car l'utilisateur est maintenant vérifié
            setTimeout(() => {
              window.location.href = '/?message=already_verified';
            }, 2000);
            break;
          case 'RATE_LIMITED':
            setCountdown(data.retryAfterMinutes * 60 || 120);
            toast.warning(data.message);
            break;
          case 'EMAIL_SENT_IF_EXISTS':
            toast.success(data.message);
            setEmailSent(true);
            setLastSentTime(Date.now());
            break;
          default:
            toast.error(data.message || "Erreur lors de l'envoi de l'email");
        }
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsResending(false);
    }
  }, [user.email, lastSentTime]);

  // Calculer le temps d'inscription
  const getMemberSinceText = () => {
    if (!user.memberSince) return 'Récemment';
    if (user.memberSince === 0) return "Aujourd'hui";
    if (user.memberSince === 1) return 'Hier';
    if (user.memberSince < 7) return `Il y a ${user.memberSince} jours`;
    if (user.memberSince < 30)
      return `Il y a ${Math.floor(user.memberSince / 7)} semaine(s)`;
    return `Il y a ${Math.floor(user.memberSince / 30)} mois`;
  };

  // Fonctionnalités limitées pour utilisateurs non vérifiés
  const restrictedFeatures = [
    { name: 'Ajouter au panier', icon: '🛒' },
    { name: 'Passer commande', icon: '💳' },
    { name: 'Sauvegarder favoris', icon: '❤️' },
    { name: 'Contacter vendeurs', icon: '📞' },
    { name: 'Laisser avis', icon: '⭐' },
  ];

  // Avantages de la vérification
  const verificationBenefits = [
    { name: 'Accès complet aux achats', icon: <Shield className="w-4 h-4" /> },
    { name: 'Sécurité renforcée', icon: <CheckCircle className="w-4 h-4" /> },
    { name: 'Support prioritaire', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête utilisateur */}
      <div className="text-center">
        <div className="relative mx-auto w-20 h-20 mb-4">
          <Image
            src={user.avatar?.url || '/images/default.png'}
            alt={`Photo de profil de ${user.name}`}
            fill
            className="rounded-full object-cover border-2 border-gray-200"
          />
          {/* Badge non vérifié */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white">
            <AlertCircle className="w-3 h-3 text-white" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Bonjour {user.name} ! 👋
        </h2>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-center space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-orange-800">
                Votre email n&apos;est pas encore vérifié
              </p>
              <p className="text-xs text-orange-700">
                Membre depuis {getMemberSinceText()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Adresse email */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Adresse email</p>
            <p className="text-sm text-gray-600 font-mono">{user.email}</p>
          </div>
          <div className="text-orange-500">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Bouton de renvoi */}
      <div className="space-y-3">
        <button
          onClick={handleResendEmail}
          disabled={isResending || countdown > 0}
          className={`w-full flex items-center justify-center px-4 py-3 rounded-md font-medium transition-colors ${
            isResending || countdown > 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isResending ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : countdown > 0 ? (
            <>
              <Clock className="w-4 h-4 mr-2" />
              Réessayer dans {countdown}s
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 mr-2" />
              {emailSent ? "Renvoyer l'email" : 'Envoyer email de vérification'}
            </>
          )}
        </button>

        {emailSent && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-800 font-medium">
                Email envoyé avec succès !
              </p>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Vérifiez votre boîte de réception et vos spams.
            </p>
          </div>
        )}
      </div>

      {/* Fonctionnalités limitées */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          Fonctionnalités actuellement limitées :
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {restrictedFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex items-center space-x-2 text-sm text-red-700"
            >
              <span>{feature.icon}</span>
              <span className="line-through opacity-75">{feature.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Avantages de la vérification */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          Après vérification, vous pourrez :
        </h3>
        <div className="space-y-2">
          {verificationBenefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-center space-x-2 text-sm text-green-700"
            >
              {benefit.icon}
              <span>{benefit.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions supplémentaires */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        <Link
          href="/help/verification"
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Aide à la vérification
        </Link>

        <Link
          href="/"
          className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Continuer la navigation
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>

      {/* Informations de sécurité */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-blue-800">
              Pourquoi vérifier votre email ?
            </p>
            <ul className="text-xs text-blue-700 mt-1 space-y-1">
              <li>• Sécuriser votre compte contre les accès non autorisés</li>
              <li>• Recevoir les notifications de commandes importantes</li>
              <li>• Récupérer votre mot de passe si nécessaire</li>
              <li>• Accéder à toutes les fonctionnalités de BuyItNow</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
