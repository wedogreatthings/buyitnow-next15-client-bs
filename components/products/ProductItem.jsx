import { memo, useCallback, useContext } from 'react';
import { toast } from 'react-toastify';
import Link from 'next/link';
import Image from 'next/image';

import CartContext from '@/context/CartContext';
import { INCREASE } from '@/helpers/constants';
import AuthContext from '@/context/AuthContext';

const ProductItem = memo(({ product }) => {
  const { addItemToCart, updateCart, cart } = useContext(CartContext);
  const { user } = useContext(AuthContext);

  // Vérification de sécurité pour s'assurer que product est un objet valide
  if (!product || typeof product !== 'object') {
    return null;
  }

  const inStock = product.stock > 0;
  const productId = product._id || '';
  const productName = product.name || 'Produit sans nom';
  const productDescription = product.description || '';
  const productPrice = product.price || 0;
  const productCategory = product.category?.categoryName || 'Non catégorisé';

  // URL de l'image avec fallback
  const imageUrl = product.images?.[0]?.url || '/images/default_product.png';

  // Optimisation avec useCallback pour éviter les recréations à chaque rendu
  const addToCartHandler = useCallback(
    (e) => {
      e.preventDefault();

      try {
        if (!user) {
          return toast.error(
            'Connectez-vous pour ajouter des articles à votre panier !',
          );
        }

        const isProductInCart = cart.find((i) => i?.productId === productId);

        if (isProductInCart) {
          updateCart(isProductInCart, INCREASE);
        } else {
          addItemToCart({
            product: productId,
          });
        }
      } catch (error) {
        toast.error("Impossible d'ajouter au panier. Veuillez réessayer.");
        console.error("Erreur d'ajout au panier:", error);
      }
    },
    [user, cart, productId],
  );

  return (
    <article className="border border-gray-200 overflow-hidden bg-white shadow-xs rounded-sm mb-5">
      <Link
        href={`/product/${productId}`}
        className="flex flex-col md:flex-row hover:bg-blue-50"
        aria-label={`Voir les détails du produit: ${productName}`}
      >
        <div className="md:w-1/4 flex p-3">
          <div className="relative w-full aspect-square">
            <Image
              src={imageUrl}
              alt={productName}
              title={productName}
              width={240}
              height={240}
              onError={(e) => {
                e.currentTarget.src = '/images/default_product.png';
                e.currentTarget.onerror = null;
              }}
              style={{ objectFit: 'contain' }}
              priority={false}
              loading="lazy"
              sizes="(max-width: 768px) 80vw, 240px"
            />
          </div>
        </div>
        <div className="md:w-2/4">
          <div className="p-4">
            <h3
              className="font-semibold text-xl text-gray-800 line-clamp-2"
              title={productName}
            >
              {productName}
            </h3>
            <div className="mt-4 md:text-xs lg:text-sm text-gray-700">
              <p className="mb-1" title={productCategory}>
                <span className="font-semibold mr-3">Catégorie: </span>
                <span>{productCategory}</span>
              </p>
              <p className="mb-1" title="Description">
                <span className="font-semibold mr-3">Description: </span>
                <span className="line-clamp-2">
                  {productDescription
                    ? productDescription.substring(0, 45) + '...'
                    : 'Aucune description disponible'}
                </span>
              </p>
              <p className="mb-1" title="Stock">
                <span className="font-semibold mr-3">Stock: </span>
                {inStock ? (
                  <span className="text-green-700 font-medium">En stock</span>
                ) : (
                  <span className="text-red-700 font-medium">
                    Rupture de stock
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="md:w-1/4 border-t lg:border-t-0 lg:border-l border-gray-200">
          <div className="p-5">
            <span
              className="text-xl font-semibold text-black flex items-center justify-center md:justify-start"
              data-testid="Price"
            >
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              }).format(productPrice)}
            </span>

            <p
              className="text-green-700 md:text-xs lg:text-sm text-center md:text-left"
              title="Livraison gratuite"
            >
              Livraison gratuite
            </p>
            <div className="my-3 flex justify-center md:justify-start">
              <button
                disabled={!inStock}
                className={`px-2 lg:px-4 py-2 inline-block md:text-xs lg:text-sm text-white rounded-md hover:bg-blue-700 transition
                  ${inStock ? 'bg-blue-600' : 'bg-gray-400 cursor-not-allowed'}`}
                onClick={(e) => inStock && addToCartHandler(e)}
                aria-label={
                  inStock ? 'Ajouter au panier' : 'Produit indisponible'
                }
                aria-disabled={!inStock}
              >
                {inStock ? 'Ajouter au panier' : 'Indisponible'}
              </button>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
});

// Ajouter displayName pour faciliter le débogage
ProductItem.displayName = 'ProductItem';

export default ProductItem;
