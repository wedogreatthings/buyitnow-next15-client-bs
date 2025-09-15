'use client';

import {
  useContext,
  useState,
  useEffect,
  useCallback,
  memo,
  useMemo,
} from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types'; // Pour la validation des props
import Image from 'next/image';
import Link from 'next/link';

import AuthContext from '@/context/AuthContext';
import CartContext from '@/context/CartContext';
import { isArrayEmpty } from '@/helpers/helpers';
import { INCREASE } from '@/helpers/constants';

// Pour la sécurité - nécessite d'installer cette dépendance
// npm install dompurify
import DOMPurify from 'dompurify';
import { Share2, ShoppingCart, Star, Truck } from 'lucide-react';

// Chargement dynamique des composants
const BreadCrumbs = dynamic(() => import('@/components/layouts/BreadCrumbs'), {
  ssr: true, // Enable SSR for SEO
  loading: () => (
    <div className="h-8 bg-gray-100 rounded-lg animate-pulse"></div>
  ),
});

// Formatter le prix avec séparateur de milliers et devise
const formatPrice = (price) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price || 0);
};

const ProductImageGallery = memo(function ProductImageGallery({
  product,
  selectedImage,
  onImageSelect,
}) {
  // Si pas d'images disponibles, utiliser l'image par défaut
  const defaultImage = '/images/default_product.png';
  const productImages =
    product?.images?.length > 0 ? product.images : [{ url: defaultImage }];

  return (
    <aside aria-label="Product images">
      <div
        className="border border-gray-200 shadow-sm p-3 text-center rounded-lg mb-5 bg-white relative h-auto max-h-[500px] flex items-center justify-center overflow-hidden"
        role="img"
        aria-label={`Main image of ${product?.name || 'product'}`}
      >
        <div className="w-full h-full transition-transform duration-300 hover:scale-110">
          <Image
            className="object-contain max-h-[450px] inline-block transition-opacity"
            src={selectedImage || defaultImage}
            alt={product?.name || 'Product image'}
            width={400}
            height={400}
            priority={true} // Load this image early
            quality={85}
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAEtAJJXIDTiQAAAABJRU5ErkJggg=="
          />
        </div>

        {/* Overlay de zoom (à implémenter avec une librairie comme react-medium-image-zoom) */}
        <button
          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Zoom image"
          onClick={() => {
            /* Intégrer une fonction de zoom ici */
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </button>
      </div>

      {/* Thumbnails gallery */}
      <div
        className="space-x-2 overflow-x-auto pb-3 flex flex-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 -mx-2 px-2 hide-scrollbar sm:flex-wrap"
        aria-label="Product thumbnail images"
        role="group"
      >
        {productImages.map((img, index) => (
          <button
            key={img?.url || `img-${index}`}
            className={`inline-block border ${
              selectedImage === img?.url
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200'
            } cursor-pointer p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all`}
            onClick={() => onImageSelect(img?.url)}
            aria-label={`View product image ${index + 1}`}
            aria-pressed={selectedImage === img?.url}
          >
            <Image
              className="w-14 h-14 object-contain"
              src={img?.url || defaultImage}
              alt={`${product?.name || 'Product'} - thumbnail ${index + 1}`}
              width={56}
              height={56}
              onError={(e) => {
                e.target.src = defaultImage;
              }}
            />
          </button>
        ))}
      </div>
    </aside>
  );
});

const ProductInfo = memo(function ProductInfo({
  product,
  inStock,
  onAddToCart,
  isAddingToCart,
  onShare,
}) {
  // Formattage du prix mémoïsé
  const formattedPrice = useMemo(
    () => formatPrice(product?.price),
    [product?.price],
  );

  return (
    <main>
      <h1 className="font-semibold text-xl sm:text-2xl mb-4 text-gray-800">
        {product?.name || 'Product Not Available'}
      </h1>

      <div className="flex flex-wrap items-center space-x-2 mb-2">
        {product?.verified && (
          <span className="text-green-700 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Vérifié
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline mb-4">
        <p
          className="font-semibold text-xl sm:text-2xl text-blue-600 mr-3"
          aria-label="Prix"
        >
          {formattedPrice}
        </p>

        {/* Afficher un prix barré si c'est pertinent */}
        {product?.oldPrice && (
          <p className="text-sm sm:text-base text-gray-500 line-through">
            {formatPrice(product.oldPrice)}
          </p>
        )}
      </div>

      {/* Description sécurisée contre XSS */}
      {product?.description ? (
        <div
          className="mb-6 text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(product.description),
          }}
        />
      ) : (
        <p className="mb-6 text-gray-600">
          Aucune description disponible pour ce produit.
        </p>
      )}

      {/* Bouton d'ajout au panier */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          className={`w-full sm:w-auto px-6 py-3 inline-block text-white font-medium text-center rounded-lg transition-colors 
            ${
              inStock
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 focus:outline-none cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          onClick={onAddToCart}
          disabled={!inStock || isAddingToCart}
          aria-label={inStock ? 'Ajouter au panier' : 'Produit indisponible'}
        >
          {isAddingToCart ? (
            <span className="inline-flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Ajout en cours...
            </span>
          ) : (
            <div className="flex flex-row">
              <ShoppingCart />
              {inStock ? 'Ajouter au panier' : 'Indisponible'}
            </div>
          )}
        </button>

        <button
          className="w-full sm:w-auto px-4 py-2 flex flex-row text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-colors"
          aria-label="Partager ce produit"
          onClick={onShare}
        >
          <Share2 className="mr-1" />
          Partager
        </button>
      </div>

      {/* Informations supplémentaires */}
      <ul className="mb-5 text-gray-600">
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Disponibilité:</span>
          {inStock ? (
            <span className="text-green-600 font-medium flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              En stock
            </span>
          ) : (
            <span className="text-red-600 font-medium flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Rupture de stock
            </span>
          )}
        </li>
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Quantité:</span>
          <span>{product?.stock || 0} unité(s)</span>
        </li>
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Catégorie:</span>
          <span>{product?.category?.categoryName || 'Non catégorisé'}</span>
        </li>
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Référence:</span>
          <span className="font-mono text-sm">{product?._id || 'N/A'}</span>
        </li>
      </ul>

      {/* Badge livraison */}
      {inStock && (
        <div className="inline-block bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-green-700 text-sm">
          <i className="fas fa-truck mr-1" aria-hidden="true"></i>
          Livraison gratuite à partir de 50€
        </div>
      )}

      {/* Badge de popularité basé sur les ventes */}
      {product?.sold > 10 && (
        <div className="mt-4 flex flex-row bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-700 text-sm mr-2">
          <Truck className="mr-1" />
          {product.sold > 100 ? 'Très populaire' : 'Populaire'}
        </div>
      )}

      {/* Indiquer quand le produit est récent (moins de 30 jours) */}
      {product?.createdAt &&
        new Date(product.createdAt) >
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
          <div className="mt-4 flex flex-row bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-blue-700 text-sm">
            <Star className="mr-1" />
            Nouveau
          </div>
        )}
    </main>
  );
});

const RelatedProductsCarousel = memo(function RelatedProductsCarousel({
  products,
  currentProductId,
}) {
  // États pour la gestion du carrousel
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [slidesPerView, setSlidesPerView] = useState(4);

  // Filtrer les produits pour exclure le produit actuel
  const filteredProducts = useMemo(
    () =>
      products?.filter((product) => product?._id !== currentProductId) || [],
    [products, currentProductId],
  );

  // Si aucun produit similaire, ne pas afficher la section
  if (isArrayEmpty(filteredProducts)) {
    return null;
  }

  // Gestion responsive du nombre de slides visibles par vue
  useEffect(() => {
    const updateSlidesPerView = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setSlidesPerView(1); // Mobile: 1 slide visible
      } else if (width < 768) {
        setSlidesPerView(2); // Small tablet: 2 slides visibles
      } else if (width < 1024) {
        setSlidesPerView(3); // Tablet: 3 slides visibles
      } else {
        setSlidesPerView(4); // Desktop: 4 slides visibles
      }
    };

    updateSlidesPerView();
    window.addEventListener('resize', updateSlidesPerView);
    return () => window.removeEventListener('resize', updateSlidesPerView);
  }, []);

  // Calculer l'index maximum pour la navigation
  const maxSlideIndex = useMemo(() => {
    return Math.max(0, filteredProducts.length - slidesPerView);
  }, [filteredProducts.length, slidesPerView]);

  // Auto-scroll (optionnel - activé par défaut)
  useEffect(() => {
    if (!isAutoScrolling || filteredProducts.length <= slidesPerView) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => {
        // Retour au début après le dernier slide
        if (prevSlide >= maxSlideIndex) {
          return 0;
        }
        return prevSlide + 1;
      });
    }, 4000); // 4 secondes entre chaque défilement

    return () => clearInterval(interval);
  }, [isAutoScrolling, maxSlideIndex, filteredProducts.length, slidesPerView]);

  // Calculer le décalage pour l'animation
  const translateX = useMemo(() => {
    // Chaque produit occupe (100 / slidesPerView)% de la largeur visible
    // On déplace d'un produit à la fois
    const slideWidth = 100 / slidesPerView;
    return -(currentSlide * slideWidth);
  }, [currentSlide, slidesPerView]);

  // Reprendre l'auto-scroll après 10 secondes d'inactivité
  useEffect(() => {
    if (!isAutoScrolling) {
      const timeout = setTimeout(() => {
        setIsAutoScrolling(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isAutoScrolling]);

  // Calculer le nombre de "pages" pour les indicateurs (dots)
  const totalDots = useMemo(() => {
    // Si on a moins de produits que de slides visibles, pas besoin de pagination
    if (filteredProducts.length <= slidesPerView) return 0;
    // Sinon, on a autant de dots que de positions possibles
    return maxSlideIndex + 1;
  }, [filteredProducts.length, slidesPerView, maxSlideIndex]);

  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2
          id="related-heading"
          className="font-bold text-xl sm:text-2xl text-gray-800"
        >
          Produits similaires
        </h2>

        {/* Indicateur du nombre de produits */}
        <span className="text-sm text-gray-500">
          {filteredProducts.length} produit
          {filteredProducts.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Container du carrousel */}
      <div className="relative group">
        {/* Container avec overflow hidden */}
        <div className="overflow-hidden rounded-lg">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(${translateX}%)`,
            }}
          >
            {/* CHAQUE PRODUIT = UN SLIDE INDIVIDUEL */}
            {filteredProducts.map((product) => (
              <div
                key={product?._id}
                className="flex-shrink-0 px-2"
                style={{
                  // Chaque slide occupe exactement la largeur nécessaire selon slidesPerView
                  width: `${100 / slidesPerView}%`,
                }}
              >
                <Link
                  href={`/product/${product?._id}`}
                  className="group/card block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-blue-100 transform hover:-translate-y-1 h-full"
                >
                  {/* Image du produit */}
                  <div className="aspect-square mb-4 bg-gray-100 rounded-lg overflow-hidden relative">
                    <Image
                      src={
                        product?.images?.[0]?.url ||
                        '/images/default_product.png'
                      }
                      alt={product?.name || 'Produit similaire'}
                      fill
                      className="object-contain group-hover/card:scale-105 transition-transform duration-300"
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      onError={(e) => {
                        e.target.src = '/images/default_product.png';
                      }}
                    />

                    {/* Badge si le produit est nouveau */}
                    {product?.createdAt &&
                      new Date(product.createdAt) >
                        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                          Nouveau
                        </div>
                      )}

                    {/* Badge si rupture de stock */}
                    {product?.stock === 0 && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                        Épuisé
                      </div>
                    )}
                  </div>

                  {/* Informations du produit */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-800 group-hover/card:text-blue-600 transition-colors line-clamp-2 text-sm leading-tight min-h-[2.5rem]">
                      {product?.name || 'Produit sans nom'}
                    </h3>

                    <div className="flex items-center justify-between">
                      <p className="font-bold text-blue-600 text-lg">
                        {formatPrice(product?.price)}
                      </p>

                      {/* Indicateur de stock */}
                      {product?.stock > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          En stock
                        </span>
                      )}
                    </div>

                    {/* Catégorie */}
                    {product?.category?.categoryName && (
                      <p className="text-xs text-gray-500">
                        {product.category.categoryName}
                      </p>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs de pagination (dots) - Seulement si navigation nécessaire */}
        {totalDots > 1 && (
          <div className="flex justify-center mt-4 space-x-2">
            {Array.from({ length: totalDots }).map((_, dotIndex) => (
              <button
                key={dotIndex}
                onClick={() => {
                  setCurrentSlide(dotIndex);
                  setIsAutoScrolling(false);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  dotIndex === currentSlide
                    ? 'bg-blue-600 w-6'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Aller à la position ${dotIndex + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Message si tous les produits sont visibles */}
      {filteredProducts.length <= slidesPerView &&
        filteredProducts.length > 0 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Tous les produits similaires sont affichés
          </p>
        )}
    </section>
  );
});

// Composant principal
function ProductDetails({ product, sameCategoryProducts }) {
  const { user } = useContext(AuthContext);
  const { addItemToCart, updateCart, cart, error, clearError } =
    useContext(CartContext);

  // État pour l'image sélectionnée
  const [selectedImage, setSelectedImage] = useState(null);

  // État pour le feedback d'ajout au panier
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Définir l'image sélectionnée au chargement ou quand le produit change
  useEffect(() => {
    if (product?.images && product.images.length > 0) {
      setSelectedImage(product.images[0]?.url);
    } else {
      setSelectedImage('/images/default_product.png');
    }
  }, [product]);

  // Handle auth context updates
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Vérifier si le produit est en stock - memoized
  const inStock = useMemo(() => {
    if (!product || product?.stock === undefined) return false;
    return product.stock >= 1;
  }, [product]);

  // Définir les breadcrumbs une seule fois
  const breadCrumbs = useMemo(() => {
    if (!product) return null;

    return [
      { name: 'Accueil', url: '/' },
      { name: 'Produits', url: '/products' },
      {
        name: product.category?.categoryName || 'Catégorie',
        url: `/category/${product.category?._id || 'all'}`,
      },
      {
        name: product.name
          ? product.name.length > 40
            ? `${product.name.substring(0, 40)}...`
            : product.name
          : 'Produit',
        url: `/product/${product._id}`,
      },
    ];
  }, [product]);

  // Gérer l'ajout au panier
  const handleAddToCart = useCallback(() => {
    // Sécurité et validation
    if (!product || !product._id) {
      toast.error('Produit invalide');
      return;
    }

    if (!user) {
      toast.info(
        'Veuillez vous connecter pour ajouter des articles à votre panier',
      );
      return;
    }

    if (!inStock) {
      toast.warning('Ce produit est en rupture de stock');
      return;
    }

    if (isAddingToCart) return; // Éviter les clics multiples

    setIsAddingToCart(true);

    try {
      const isProductInCart = cart.find((i) => i?.productId === product._id);

      if (isProductInCart) {
        updateCart(isProductInCart, INCREASE);
        toast.success('Quantité mise à jour dans votre panier');
      } else {
        addItemToCart({
          product: product._id,
        });
        toast.success('Produit ajouté à votre panier');
      }
    } catch (error) {
      console.error('Error adding item to cart:', error);
      toast.error("Erreur lors de l'ajout au panier. Veuillez réessayer.");
    } finally {
      // Ajouter un délai minimum pour éviter le flickering de l'UI
      setTimeout(() => {
        setIsAddingToCart(false);
      }, 500);
    }
  }, [product, user, cart, inStock, addItemToCart, updateCart, isAddingToCart]);

  // Fonction pour partager le produit
  const handleShare = useCallback(() => {
    // Vérifier si l'API Web Share est disponible
    if (navigator.share) {
      // Utiliser l'API Web Share (mobile)
      navigator
        .share({
          title: product?.name || 'Découvrez ce produit',
          text: `Découvrez ${product?.name} sur notre boutique.`,
          url: window.location.href,
        })
        .then(() => console.log('Produit partagé avec succès'))
        .catch((error) => console.error('Erreur lors du partage:', error));
    } else {
      // Fallback pour les navigateurs qui ne supportent pas l'API Web Share
      // Copier l'URL dans le presse-papier
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          toast.success('Lien copié dans le presse-papier !');
        })
        .catch(() => {
          // Si clipboard API n'est pas supportée, créer un élément temporaire
          const tempInput = document.createElement('input');
          tempInput.value = window.location.href;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          toast.success('Lien copié dans le presse-papier !');
        });
    }
  }, [product?.name]);

  // Gérer la sélection d'image
  const handleImageSelect = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
  }, []);

  // État de chargement ou d'erreur
  if (!product) {
    return (
      <div className="container max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white shadow-md rounded-lg p-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Produit non disponible
          </h2>
          <p className="text-gray-600 mb-6">
            Le produit demandé n&apos;existe pas ou a été retiré de notre
            catalogue.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-6 sm:py-10">
      {breadCrumbs && <BreadCrumbs breadCrumbs={breadCrumbs} />}

      <div className="container max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Galerie d'images */}
            <ProductImageGallery
              product={product}
              selectedImage={selectedImage}
              onImageSelect={handleImageSelect}
            />

            {/* Informations produit */}
            <ProductInfo
              product={product}
              inStock={inStock}
              onAddToCart={handleAddToCart}
              isAddingToCart={isAddingToCart}
              onShare={handleShare}
            />
          </div>

          {/* Spécifications produit */}
          {product.specifications && (
            <div className="border-t border-gray-200 pt-8 mt-8">
              <h2 className="text-xl font-semibold mb-4">Spécifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium w-36">{key}:</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Produits connexes */}
        <RelatedProductsCarousel
          products={sameCategoryProducts}
          currentProductId={product._id}
        />
      </div>
    </div>
  );
}

// Validation des props pour une meilleure robustesse
ProductDetails.propTypes = {
  product: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    price: PropTypes.number,
    oldPrice: PropTypes.number,
    description: PropTypes.string,
    stock: PropTypes.number,
    sold: PropTypes.number,
    createdAt: PropTypes.string,
    images: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
    category: PropTypes.shape({
      _id: PropTypes.string,
      categoryName: PropTypes.string,
    }),
    specifications: PropTypes.object,
    verified: PropTypes.bool,
  }),
  sameCategoryProducts: PropTypes.array,
};

// Valeurs par défaut pour éviter les erreurs
ProductDetails.defaultProps = {
  product: null,
  sameCategoryProducts: [],
};

export default memo(ProductDetails);
