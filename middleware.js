import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Configuration
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

// Routes protégées
const PROTECTED_PATHS = [
  '/api/:path*',
  '/me/:path*',
  '/address/:path*',
  '/cart',
  '/shipping',
  '/shipping-choice',
  '/payment',
  '/confirmation',
];
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/product',
  '/_next/',
  '/favicon.ico',
  '/images/',
];

// Cache pour les chemins (micro-optimisation)
const pathCache = new Map();

export async function middleware(req) {
  const path = req.nextUrl.pathname;

  // Debug conditionnel
  if (!IS_PRODUCTION && DEBUG) {
    console.log('[Middleware] Path:', path);
  }

  // Vérification rapide avec cache
  if (pathCache.has(path)) {
    const cached = pathCache.get(path);
    if (cached === 'public') return NextResponse.next();
  }

  // Routes publiques - sortie rapide
  const isPublic = PUBLIC_PATHS.some((publicPath) =>
    path.startsWith(publicPath),
  );
  if (isPublic) {
    pathCache.set(path, 'public');
    return NextResponse.next();
  }

  // Vérifier si c'est une route protégée
  const isProtected = PROTECTED_PATHS.some((protectedPath) =>
    path.startsWith(protectedPath),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  try {
    // Configuration du cookie selon l'environnement
    const cookieName = IS_PRODUCTION
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    // Une seule vérification de token
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName,
    });

    if (!token) {
      // Redirection vers login avec callback
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', path);

      // Headers de sécurité pour la redirection
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('X-Redirect-Reason', 'authentication-required');

      return response;
    }

    // Token valide - ajouter des headers de sécurité
    const response = NextResponse.next();
    response.headers.set('X-User-Authenticated', 'true');

    // Optional: Ajouter l'ID utilisateur pour les logs
    if (token.sub) {
      response.headers.set('X-User-Id', token.sub);
    }

    return response;
  } catch (error) {
    // Log d'erreur uniquement en production pour Sentry
    if (IS_PRODUCTION) {
      console.error('[Middleware] Authentication error:', {
        path,
        error: error.message,
      });
    }

    // Redirection sécurisée vers login en cas d'erreur
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'auth_error');
    return NextResponse.redirect(loginUrl);
  }
}

// Configuration optimisée du matcher
export const config = {
  matcher: [
    /*
     * Exécuter le middleware uniquement sur :
     * - Routes protégées
     * - Pages dynamiques
     * Exclure :
     * - Fichiers statiques (_next/static, _next/image)
     * - API routes d'auth (api/auth)
     * - Assets publics (favicon, robots, sitemap)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images|fonts|public).*)',
  ],
};
