'use client';

import {
  useContext,
  useEffect,
  useState,
  useCallback,
  memo,
  useMemo,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import * as Sentry from '@sentry/nextjs';
import CartContext from '@/context/CartContext';
import { signOut, useSession } from 'next-auth/react';
import AuthContext from '@/context/AuthContext';
import { Menu, ShoppingCart, User, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

// Chargement dynamique optimisé du composant Search
const Search = dynamic(() => import('./Search'), {
  loading: () => (
    <div className="h-10 w-full max-w-xl bg-gray-100 animate-pulse rounded-md"></div>
  ),
  ssr: true,
});

// Constantes pour éviter les recréations
const CART_LOAD_DELAY = 500;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ✅ NOUVEAU: Bouton panier avec gestion des utilisateurs non vérifiés
const CartButton = memo(({ cartCount, isVerified = true }) => {
  const handleCartClick = (e) => {
    if (!isVerified) {
      e.preventDefault();
      toast.warning('Veuillez vérifier votre email pour accéder au panier');
      return false;
    }
  };

  return (
    <Link
      href="/cart"
      onClick={handleCartClick}
      className={`px-3 py-2 flex flex-row text-gray-700 bg-white shadow-sm border border-gray-200 rounded-md transition-colors relative ${
        isVerified
          ? 'hover:bg-blue-50 hover:border-blue-200 cursor-pointer'
          : 'opacity-60 cursor-not-allowed hover:bg-gray-50'
      }`}
      aria-label="Panier"
      data-testid="cart-button"
      title={
        isVerified
          ? 'Accéder au panier'
          : 'Vérifiez votre email pour accéder au panier'
      }
    >
      <ShoppingCart className="text-gray-400 w-5" />
      <span className="ml-1">Panier ({cartCount > 0 ? cartCount : 0})</span>
      {cartCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          {cartCount}
        </span>
      )}
      {/* ✅ NOUVEAU: Icône d'avertissement pour utilisateurs non vérifiés */}
      {!isVerified && (
        <AlertCircle className="absolute -top-1 -right-1 w-4 h-4 text-orange-500 bg-white rounded-full" />
      )}
    </Link>
  );
});

CartButton.displayName = 'CartButton';

// ✅ NOUVEAU: Dropdown utilisateur avec gestion vérification
const UserDropdown = memo(({ user, isVerified = true }) => {
  // Menus différents selon le statut de vérification
  const verifiedMenuItems = useMemo(
    () => [
      { href: '/me', label: 'Mon profil' },
      { href: '/me/orders', label: 'Mes commandes' },
      { href: '/me/contact', label: 'Contactez le vendeur' },
    ],
    [],
  );

  const unverifiedMenuItems = useMemo(
    () => [
      {
        href: '/auth/verify',
        label: '📧 Vérifier mon email',
        className: 'text-orange-600 font-medium bg-orange-50',
      },
      {
        href: '/help/verification',
        label: 'Aide à la vérification',
        className: 'text-blue-600',
      },
    ],
    [],
  );

  const menuItems = isVerified ? verifiedMenuItems : unverifiedMenuItems;

  return (
    <div className="relative group">
      <Link
        href={isVerified ? '/me' : '/auth/verify'}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
          isVerified
            ? 'hover:bg-blue-50'
            : 'hover:bg-orange-50 border border-orange-200'
        }`}
        aria-expanded="false"
        aria-haspopup="true"
        id="user-menu-button"
        title={
          isVerified
            ? 'Menu utilisateur'
            : 'Email non vérifié - Cliquez pour vérifier'
        }
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
          <Image
            data-testid="profile image"
            alt={`Photo de profil de ${user?.name || 'utilisateur'}`}
            src={user?.avatar ? user?.avatar?.url : '/images/default.png'}
            fill
            sizes="32px"
            className="object-cover"
            priority={false}
          />
          {/* ✅ NOUVEAU: Badge de vérification */}
          {!isVerified && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <div className="hidden lg:block">
          <div className="flex items-center space-x-1">
            <p className="text-sm font-medium text-gray-700">{user?.name}</p>
            {!isVerified && (
              <span className="text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded">
                Non vérifié
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate max-w-[150px]">
            {user?.email}
          </p>
        </div>
      </Link>

      <div
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="user-menu-button"
        className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50"
      >
        <div className="py-1">
          {/* ✅ NOUVEAU: Message pour utilisateurs non vérifiés */}
          {!isVerified && (
            <div className="px-4 py-2 border-b border-orange-100 bg-orange-50">
              <p className="text-xs text-orange-700 font-medium">
                ⚠️ Email non vérifié
              </p>
              <p className="text-xs text-orange-600">
                Fonctionnalités limitées
              </p>
            </div>
          )}

          {menuItems.map((item, index) => (
            <Link
              key={`menu-item-${index}`}
              href={item.href}
              className={`block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 ${item.className || ''}`}
              role="menuitem"
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="block cursor-pointer w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
});

UserDropdown.displayName = 'UserDropdown';

const Header = () => {
  const {
    user,
    setLoading: setAuthLoading,
    setUser,
    clearUser,
  } = useContext(AuthContext);
  const { setCartToState, cartCount, clearCartOnLogout } =
    useContext(CartContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoadingCart, setIsLoadingCart] = useState(false);
  const { data } = useSession();

  // Refs pour gérer les timeouts
  const loadCartTimeoutRef = useRef(null);
  const signOutTimeoutRef = useRef(null);
  const mobileMenuTimeoutRef = useRef(null);

  console.log('Header render - user:', user);
  console.log('Session data:', data);

  // Flag pour éviter les chargements multiples
  const isCartLoadingRef = useRef(false);

  // ✅ NOUVEAU: Déterminer si l'utilisateur est vérifié
  const isUserVerified = useMemo(() => {
    return user?.isActive === true;
  }, [user?.isActive]);

  // Cleanup des timeouts au démontage
  useEffect(() => {
    return () => {
      if (loadCartTimeoutRef.current) clearTimeout(loadCartTimeoutRef.current);
      if (signOutTimeoutRef.current) clearTimeout(signOutTimeoutRef.current);
      if (mobileMenuTimeoutRef.current)
        clearTimeout(mobileMenuTimeoutRef.current);
    };
  }, []);

  // Fonction loadCart optimisée avec debounce
  const loadCart = useCallback(async () => {
    // ✅ NOUVEAU: Ne charger le panier que pour les utilisateurs vérifiés
    if (!isUserVerified) return;

    // Éviter les chargements multiples
    if (isCartLoadingRef.current) return;

    try {
      isCartLoadingRef.current = true;
      setIsLoadingCart(true);
      await setCartToState();
    } catch (error) {
      if (!IS_PRODUCTION) {
        console.error('Error loading cart:', error);
      }
      Sentry.captureException(error, {
        tags: {
          component: 'Header',
          action: 'loadCart',
        },
        level: 'warning', // Pas critique
      });
    } finally {
      setIsLoadingCart(false);
      isCartLoadingRef.current = false;
    }
  }, [setCartToState, isUserVerified]);

  // useEffect optimisé pour la gestion de session
  useEffect(() => {
    let mounted = true;

    if (data && mounted) {
      try {
        setUser(data?.user);

        // Nettoyer l'ancien timeout s'il existe
        if (loadCartTimeoutRef.current) {
          clearTimeout(loadCartTimeoutRef.current);
        }

        // ✅ MODIFICATION: Charger le panier seulement si vérifié
        if (isUserVerified) {
          if (data?.isNewLogin) {
            loadCartTimeoutRef.current = setTimeout(() => {
              if (mounted) loadCart();
            }, CART_LOAD_DELAY);
          } else {
            loadCart();
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'Header',
            action: 'initUserData',
          },
        });
      }
    } else if (data === null && mounted) {
      setUser(null);
    }

    return () => {
      mounted = false;
    };
  }, [data, setUser, loadCart, isUserVerified]);

  // Fermer le menu mobile si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      const mobileMenu = document.getElementById('mobile-menu');
      const menuButton = event.target.closest(
        'button[aria-controls="mobile-menu"]',
      );

      if (
        mobileMenu &&
        !mobileMenu.contains(event.target) &&
        !menuButton &&
        mobileMenuOpen
      ) {
        setMobileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [mobileMenuOpen]);

  // handleSignOut optimisé
  const handleSignOut = useCallback(async () => {
    try {
      clearUser();
      clearCartOnLogout();
      await signOut({ callbackUrl: '/login' });

      signOutTimeoutRef.current = setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      if (!IS_PRODUCTION) {
        console.error('Erreur lors de la déconnexion:', error);
      }
      window.location.href = '/login';
    }
  }, [clearUser, clearCartOnLogout]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // ✅ NOUVEAU: Handler pour les clics sur le panier mobile
  const handleMobileCartClick = (e) => {
    if (!isUserVerified) {
      e.preventDefault();
      toast.warning('Veuillez vérifier votre email pour accéder au panier');
      return false;
    }
  };

  return (
    <header className="bg-white py-2 border-b sticky top-0 z-50 shadow-sm">
      <div className="container max-w-[1440px] mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between">
          {/* Logo */}
          <div className="shrink-0 mr-5">
            <Link href="/" aria-label="Accueil Buy It Now">
              <Image
                priority={true}
                src="/images/logo.png"
                height={40}
                width={120}
                alt="BuyItNow"
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            {user && (
              <Link
                href="/cart"
                onClick={handleMobileCartClick}
                className={`px-3 py-2 inline-block text-center text-gray-700 bg-white shadow-sm border border-gray-200 rounded-md mr-2 relative ${
                  isUserVerified
                    ? 'hover:bg-blue-50'
                    : 'opacity-60 cursor-not-allowed hover:bg-gray-50'
                }`}
                aria-label="Panier"
                title={
                  isUserVerified
                    ? 'Accéder au panier'
                    : 'Vérifiez votre email pour accéder au panier'
                }
              >
                <ShoppingCart className="text-gray-400 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {cartCount}
                  </span>
                )}
                {!isUserVerified && (
                  <AlertCircle className="absolute -top-1 -right-1 w-3 h-3 text-orange-500 bg-white rounded-full" />
                )}
              </Link>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              className="px-3 py-2 border border-gray-200 rounded-md text-gray-700"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>

          {/* Search - Desktop */}
          <div className="hidden md:block md:flex-1 max-w-xl mx-4">
            <Search setLoading={setAuthLoading} />
          </div>

          {/* User navigation - Desktop */}
          <div className="hidden md:flex items-center space-x-3">
            {user && (
              <CartButton
                cartCount={cartCount}
                isVerified={isUserVerified}
                userEmail={user?.email}
              />
            )}

            {!user ? (
              <Link
                href="/login"
                className="px-3 py-2 flex flex-row text-gray-700 bg-white shadow-sm border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-200 transition-colors"
                data-testid="login"
              >
                <User className="text-gray-400 w-5" />
                <span className="ml-1">Connexion</span>
              </Link>
            ) : (
              <UserDropdown user={user} isVerified={isUserVerified} />
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden mt-4 border-t pt-4"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
          >
            <div className="mb-4">
              <Search setLoading={setAuthLoading} />
            </div>
            {user ? (
              <div className="space-y-3">
                {/* ✅ NOUVEAU: Alerte pour utilisateurs non vérifiés en mobile */}
                {!isUserVerified && (
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">
                          Email non vérifié
                        </p>
                        <p className="text-xs text-orange-700">
                          Accès limité aux fonctionnalités
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Link
                  href={isUserVerified ? '/me' : '/auth/verify'}
                  onClick={closeMobileMenu}
                  className={`flex items-center space-x-2 px-2 py-2 rounded-md ${
                    isUserVerified
                      ? 'hover:bg-blue-50'
                      : 'hover:bg-orange-50 bg-orange-50'
                  }`}
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                    <Image
                      alt={`Photo de profil de ${user?.name || 'utilisateur'}`}
                      src={
                        user?.avatar ? user?.avatar?.url : '/images/default.png'
                      }
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                    {!isUserVerified && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full"></div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {user?.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">
                      {user?.email}
                      {!isUserVerified && (
                        <span className="ml-1 text-orange-600">
                          (Non vérifié)
                        </span>
                      )}
                    </p>
                  </div>
                </Link>

                {/* ✅ NOUVEAU: Menu conditionnel selon le statut de vérification */}
                {isUserVerified ? (
                  <>
                    <Link
                      href="/me/orders"
                      onClick={closeMobileMenu}
                      className="block px-2 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded-md"
                    >
                      Mes commandes
                    </Link>
                    <Link
                      href="/me/contact"
                      onClick={closeMobileMenu}
                      className="block px-2 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded-md"
                    >
                      Contactez le vendeur
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/verify"
                      onClick={closeMobileMenu}
                      className="block px-2 py-2 text-sm text-orange-600 font-medium bg-orange-50 hover:bg-orange-100 rounded-md"
                    >
                      📧 Vérifier mon email
                    </Link>
                    <Link
                      href="/help/verification"
                      onClick={closeMobileMenu}
                      className="block px-2 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                    >
                      Aide à la vérification
                    </Link>
                  </>
                )}

                <button
                  onClick={async () => {
                    closeMobileMenu();
                    await handleSignOut();
                  }}
                  className="block cursor-pointer w-full text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={closeMobileMenu}
                className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Connexion
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
