'use client';

import Link from 'next/link';
import { CheckCircle, Mail, ArrowRight } from 'lucide-react';

const AuthSuccessContent = ({ message, email }) => {
  // Déterminer le type de succès et le message à afficher
  const getSuccessInfo = () => {
    switch (message) {
      case 'email_verified':
        return {
          title: 'Email vérifié avec succès !',
          subtitle: 'Félicitations ! Votre adresse email a été vérifiée.',
          description:
            'Votre compte est maintenant actif. Vous pouvez vous connecter et commencer à utiliser BuyItNow.',
          icon: <CheckCircle className="w-16 h-16 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          buttonText: 'Se connecter maintenant',
          buttonHref: '/login',
          showResendButton: false,
        };

      case 'already_verified':
        return {
          title: 'Email déjà vérifié',
          subtitle: 'Votre adresse email était déjà vérifiée.',
          description:
            'Votre compte est actif. Vous pouvez vous connecter directement.',
          icon: <Mail className="w-16 h-16 text-blue-600" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          buttonText: 'Se connecter',
          buttonHref: '/login',
          showResendButton: false,
        };

      default:
        return {
          title: 'Opération réussie',
          subtitle: 'Votre demande a été traitée avec succès.',
          description: 'Vous pouvez maintenant continuer à utiliser BuyItNow.',
          icon: <CheckCircle className="w-16 h-16 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          buttonText: 'Continuer',
          buttonHref: '/',
          showResendButton: false,
        };
    }
  };

  const successInfo = getSuccessInfo();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div
          className={`${successInfo.bgColor} ${successInfo.borderColor} border rounded-lg p-8 shadow-sm`}
        >
          {/* Icône */}
          <div className="flex justify-center mb-6">{successInfo.icon}</div>

          {/* Titre */}
          <h1
            className={`text-2xl font-bold ${successInfo.textColor} text-center mb-4`}
          >
            {successInfo.title}
          </h1>

          {/* Sous-titre */}
          <p
            className={`${successInfo.textColor} text-center mb-6 font-medium`}
          >
            {successInfo.subtitle}
          </p>

          {/* Description */}
          <p className="text-gray-700 text-center mb-8 text-sm leading-relaxed">
            {successInfo.description}
          </p>

          {/* Email affiché si disponible */}
          {email && (
            <div className="bg-white rounded-md p-3 mb-6 border border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                <span className="font-medium">Email vérifié :</span>
              </p>
              <p className="text-sm font-mono text-center text-gray-800 mt-1">
                {email}
              </p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="space-y-3">
            <Link
              href={successInfo.buttonHref}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition duration-200 text-center flex items-center justify-center group"
            >
              {successInfo.buttonText}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/"
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-md transition duration-200 text-center"
            >
              Retour à l&apos;accueil
            </Link>
          </div>

          {/* Informations supplémentaires */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">
                Vous n&apos;arrivez pas à vous connecter ?
              </p>
              <Link
                href="/help"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Contactez notre support
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2025 BuyItNow. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthSuccessContent;
