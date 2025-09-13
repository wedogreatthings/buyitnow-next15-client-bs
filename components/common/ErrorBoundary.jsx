'use client';

import React from 'react';
import { getErrorDisplayInfo } from '@/monitoring/errorUtils';
import { captureException } from '@/monitoring/sentry';

/**
 * ErrorBoundary personnalisé qui peut être utilisé à différents niveaux de l'application
 * pour isoler et mieux gérer les erreurs des composants
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Mettre à jour l'état pour afficher l'UI de fallback
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Enrichir l'erreur avec le nom du composant si spécifié
    if (this.props.componentName && !error.componentName) {
      error.componentName = this.props.componentName;
    }

    // Obtenir les informations formatées pour l'affichage
    const displayInfo = getErrorDisplayInfo(error);

    // Envoyer à Sentry
    captureException(error, {
      tags: {
        ...displayInfo.tags,
        boundary: this.props.name || 'unnamed',
        ...this.props.tags,
      },
      extra: {
        componentStack: errorInfo?.componentStack,
        additionalInfo: error.additionalInfo || {},
        props: {
          ...(this.props.captureProps
            ? JSON.parse(JSON.stringify(this.props))
            : {}),
        },
      },
      level: error.fatal ? 'fatal' : displayInfo.level,
    });

    // Mettre à jour l'état avec les informations d'erreur complètes
    this.setState({
      errorInfo: {
        ...displayInfo,
        componentStack: errorInfo?.componentStack,
      },
    });

    // Appeler le gestionnaire onError si fourni
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Appeler le gestionnaire onReset si fourni
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    // Si une erreur est survenue, afficher le composant de fallback
    if (this.state.hasError) {
      // Si un FallbackComponent personnalisé est fourni, l'utiliser
      if (this.props.FallbackComponent) {
        return (
          <this.props.FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            reset={this.handleReset}
          />
        );
      }

      // Sinon, utiliser le fallback par défaut
      const errorInfo =
        this.state.errorInfo || getErrorDisplayInfo(this.state.error);

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center mb-3">
            <svg
              className="w-6 h-6 text-red-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <h3 className="text-lg font-medium text-red-700">
              {errorInfo.title || 'Une erreur est survenue'}
            </h3>
          </div>

          <p className="text-gray-700 mb-4">
            {errorInfo.message ||
              'Veuillez réessayer ou contacter le support si le problème persiste.'}
          </p>

          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            {this.props.resetButtonText || 'Réessayer'}
          </button>

          {/* Afficher les détails de l'erreur en mode développement */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md text-xs">
              <p className="font-medium">Détails (dev uniquement):</p>
              <p className="text-red-600">{this.state.error?.message}</p>
              {this.state.error?.componentName && (
                <p>Composant: {this.state.error.componentName}</p>
              )}
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-2 overflow-auto max-h-32 text-xs">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    // Sinon, rendre normalement les enfants
    return this.props.children;
  }
}

/**
 * HOC pour envelopper un composant dans un ErrorBoundary
 */
export const withErrorBoundary = (Component, options = {}) => {
  const WithErrorBoundary = (props) => (
    <ErrorBoundary
      componentName={Component.displayName || Component.name}
      {...options}
    >
      <Component {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WithErrorBoundary;
};

export default ErrorBoundary;
