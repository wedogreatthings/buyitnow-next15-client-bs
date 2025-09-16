'use client';

import { memo } from 'react';
import Image from 'next/image';

/**
 * Composant d'affichage d'un produit commandé
 * Version améliorée avec tous les champs du orderItemSchema
 */
const OrderedProduct = memo(({ item }) => {
  // Validation de base
  if (!item) return null;

  // Extraction des données avec valeurs par défaut
  const {
    name = 'Produit',
    category = 'Non catégorisé',
    image,
    price = 0,
    quantity = 1,
    subtotal,
  } = item;

  // Calcul du sous-total si non fourni
  const calculatedSubtotal = subtotal || price * quantity;

  // Fonction pour tronquer le texte intelligemment
  const truncateText = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Fonction pour formater le prix
  const formatPrice = (amount) => {
    return `$${(amount || 0).toFixed(2)}`;
  };

  return (
    <figure
      className="flex flex-row p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 bg-white"
      aria-label={`Produit commandé: ${name}`}
    >
      {/* Image du produit */}
      <div className="flex-shrink-0">
        <div className="w-20 h-20 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
          {image ? (
            <Image
              src={image}
              alt={name}
              title={`Image de ${name}`}
              width={80}
              height={80}
              className="object-cover w-full h-full"
              onError={(e) => {
                e.target.src = '/images/default_product.png';
              }}
            />
          ) : (
            <div className="text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Détails du produit */}
      <figcaption className="ml-3 flex-1 flex flex-col justify-between">
        <div>
          {/* Nom du produit */}
          <h4 className="font-semibold text-sm text-gray-900 mb-1" title={name}>
            {truncateText(name, 35)}
          </h4>

          {/* Catégorie */}
          <p className="text-xs text-gray-500 mb-1">
            <span className="inline-flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              {category}
            </span>
          </p>

          {/* Prix unitaire */}
          <p className="text-sm text-gray-600">
            Prix unitaire:{' '}
            <span className="font-medium">{formatPrice(price)}</span>
          </p>
        </div>

        {/* Quantité et sous-total */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <div className="text-sm">
              <span className="text-gray-600">Quantité:</span>{' '}
              <span className="font-semibold text-gray-900">{quantity}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Sous-total</p>
              <p className="font-bold text-blue-600">
                {formatPrice(calculatedSubtotal)}
              </p>
            </div>
          </div>
        </div>
      </figcaption>
    </figure>
  );
});

// Ajouter un displayName pour faciliter le débogage
OrderedProduct.displayName = 'OrderedProduct';

export default OrderedProduct;
