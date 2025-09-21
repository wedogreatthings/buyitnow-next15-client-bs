'use client';

import { memo, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/helpers/helpers';

/**
 * Composant d'affichage d'un article dans le résumé de livraison
 *
 * @param {Object} props
 * @param {Object} props.item - Article du panier à afficher
 */
const ItemShipping = memo(({ item }) => {
  const [imageError, setImageError] = useState(false);

  // Gestion des valeurs manquantes avec fallbacks
  const quantity = item?.quantity || 1;
  const productId = item?.productId || 'unknown';
  const productName = item?.productName || 'Produit sans nom';

  // Calcul du total avec gestion des types et valeurs manquantes
  const total = useMemo(() => {
    if (typeof item?.subtotal === 'number') {
      return item.subtotal;
    }
    const price = typeof item?.price === 'number' ? item.price : 0;
    return quantity * price;
  }, [item?.subtotal, item?.price, quantity]);

  // Source de l'image avec gestion des erreurs
  const imageSrc =
    imageError || !item?.imageUrl
      ? '/images/default_product.png'
      : item.imageUrl;

  return (
    <div className="flex items-center space-x-3 py-2 group transition-all duration-200">
      <div className="relative flex-shrink-0">
        <Link
          href={`/product/${productId}`}
          className="block relative w-16 h-16 rounded bg-gray-50 p-1 border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
        >
          <Image
            src={imageSrc}
            alt={productName}
            fill
            sizes="64px"
            className="object-contain"
            onError={() => setImageError(true)}
            priority={false}
          />

          {quantity >= 1 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-5 h-5 text-xs flex items-center justify-center text-white bg-blue-600 rounded-full"
              aria-label={`Quantité: ${quantity}`}
            >
              {quantity}
            </span>
          )}
        </Link>
      </div>

      <div className="flex-1 min-w-0">
        <Link
          href={`/product/${productId}`}
          className="text-sm font-medium text-gray-800 hover:text-blue-600 line-clamp-1 transition-colors"
        >
          {productName}
        </Link>

        <div className="flex justify-between items-baseline mt-1">
          <span className="text-xs text-gray-500">{formatPrice(total)}</span>

          {quantity >= 1 && (
            <span className="text-xs text-gray-400">
              {quantity} × {formatPrice(item?.price || 0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// Définir un displayName pour faciliter le débogage
ItemShipping.displayName = 'ItemShipping';

export default ItemShipping;
