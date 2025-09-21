'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Tag } from 'lucide-react';

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
          <Image
            src={image || '/images/default_product.png'}
            alt={name}
            title={`Image de ${name}`}
            width={80}
            height={80}
            className="object-cover w-full h-full"
            onError={(e) => {
              e.target.src = '/images/default_product.png';
            }}
          />
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
              <Tag className="mr-2" />
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
