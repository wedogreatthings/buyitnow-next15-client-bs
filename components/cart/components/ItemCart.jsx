'use client';

import { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/helpers/helpers';

const ItemCart = memo(
  ({
    cartItem,
    deleteItemFromCart,
    decreaseQty,
    increaseQty,
    deleteInProgress,
  }) => {
    const [totalPrice, setTotalPrice] = useState(0);
    const [isStockLow, setIsStockLow] = useState(false);
    const [isOutOfStock, setIsOutOfStock] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isImageError, setIsImageError] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      // Calculs pour l'affichage
      setTotalPrice(cartItem?.subtotal);
      setIsStockLow(cartItem?.stock <= 5 && cartItem?.stock > 0);
      setIsOutOfStock(cartItem?.stock === 0);
    }, [cartItem]);

    // Gestion optimisée de la suppression
    const handleDelete = async () => {
      if (deleteInProgress) return;

      setIsDeleting(true);
      await deleteItemFromCart(cartItem.id);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    };

    // Source de l'image avec fallback
    const imageSource =
      isImageError || !cartItem?.imageUrl
        ? '/images/default_product.png'
        : cartItem?.imageUrl;

    return (
      <div className="group relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 transition-all duration-200 hover:bg-gray-50 rounded-lg p-2">
          <div className="w-full sm:w-2/5 flex">
            <div className="flex-shrink-0">
              <Link
                href={`/product/${cartItem?.productId}`}
                className="block relative h-24 w-24 rounded border overflow-hidden transition-shadow hover:shadow-md"
              >
                <Image
                  src={imageSource}
                  alt={cartItem?.productName || 'Produit'}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 96px, 96px"
                  onError={() => setIsImageError(true)}
                  priority={false}
                />
              </Link>
            </div>

            <div className="ml-4 flex flex-col">
              <Link
                href={`/product/${cartItem?.productId}`}
                className="text-gray-800 font-semibold text-sm sm:text-base hover:text-blue-600 line-clamp-2 transition-colors"
              >
                {cartItem?.productName}
              </Link>

              <div className="flex items-center mt-1">
                {isOutOfStock ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                    Rupture de stock
                  </span>
                ) : isStockLow ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                    Stock limité: {cartItem?.stock}
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    En stock
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <div className="inline-flex items-center h-10 rounded-lg border border-gray-200 bg-gray-50">
              <button
                type="button"
                className="w-10 h-full flex items-center justify-center rounded-l-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => decreaseQty(cartItem)}
                disabled={cartItem.quantity <= 1 || isOutOfStock}
                aria-label="Diminuer la quantité"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20 12H4"
                  />
                </svg>
              </button>

              <input
                type="text"
                className="h-full w-12 border-transparent text-center text-sm font-medium text-gray-900 focus:ring-0 focus:outline-none bg-transparent"
                value={cartItem?.quantity}
                readOnly
                aria-label="Quantité"
              />

              <button
                type="button"
                className="w-10 h-full flex items-center justify-center rounded-r-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => increaseQty(cartItem)}
                disabled={cartItem.quantity >= cartItem?.stock || isOutOfStock}
                aria-label="Augmenter la quantité"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end ml-auto">
            <div className="text-blue-600 font-medium text-base sm:text-lg">
              {formatPrice(totalPrice)}
            </div>
            <div className="text-gray-500 text-sm">
              {formatPrice(cartItem?.price)} l&apos;unité
            </div>

            <div className="mt-3 relative">
              {showDeleteConfirm ? (
                <div className="flex items-center space-x-2 transition-all duration-200 ease-in-out">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Suppression...' : 'Confirmer'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-2 rounded transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="text-xs text-red-600 hover:text-red-800 transition-colors flex items-center disabled:opacity-50 group-hover:underline"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 my-2"></div>
      </div>
    );
  },
);

ItemCart.displayName = 'ItemCart';
export default ItemCart;
