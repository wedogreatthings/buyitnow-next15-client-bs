import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcryptjs from 'bcryptjs';
import dbConnect from '@/backend/config/dbConnect';
import User from '@/backend/models/user';
import { validateLogin } from '@/helpers/validation/schemas/auth';
import { captureException } from '@/monitoring/sentry';
import { withAuthRateLimit } from '@/utils/rateLimit';

/**
 * Configuration NextAuth améliorée avec sécurité enterprise
 * Authentification par email/mot de passe avec anti-bruteforce
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/auth/* :
 * - Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
 * - Pragma: no-cache
 * - Expires: 0
 * - Surrogate-Control: no-store
 * - X-Content-Type-Options: nosniff
 * - X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
 * - X-Download-Options: noopen
 *
 * Headers globaux de sécurité appliqués :
 * - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
 * - X-Frame-Options: SAMEORIGIN
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: [configuration restrictive]
 * - Content-Security-Policy: [configuration complète]
 */
const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        try {
          // 1. Validation Yup des données d'entrée
          const validation = await validateLogin({
            email: credentials?.email || '',
            password: credentials?.password || '',
          });

          if (!validation.isValid) {
            const firstError = Object.values(validation.errors)[0];
            console.log('Login validation failed:', validation.errors);
            throw new Error(firstError || 'Invalid credentials');
          }

          const { email, password } = validation.data;

          // 2. Connexion DB
          await dbConnect();

          // 3. Recherche utilisateur avec mot de passe
          const user = await User.findOne({
            email: email,
          }).select('+password');

          if (!user) {
            console.log('Login failed: User not found');
            throw new Error('Invalid email or password');
          }

          // Vérifier si le compte est verrouillé
          if (user.isLocked()) {
            const lockUntilFormatted = new Date(user.lockUntil).toLocaleString(
              'fr-FR',
            );
            console.log('Login failed: Account locked for user:', email);
            throw new Error(
              `Compte temporairement verrouillé jusqu'à ${lockUntilFormatted}`,
            );
          }

          // Vérifier si le compte est actif
          if (!user.isActive) {
            console.log('Login failed: Account suspended for user:', email);
            throw new Error("Compte suspendu. Contactez l'administrateur.");
          }

          // 4. Vérification du mot de passe
          const isPasswordValid = await bcryptjs.compare(
            password,
            user.password,
          );

          if (!isPasswordValid) {
            console.log('Login failed: Invalid password for user:', email);

            // Incrémenter tentatives échouées
            await user.incrementLoginAttempts();

            const attemptsLeft = Math.max(0, 5 - user.loginAttempts - 1);
            if (attemptsLeft > 0) {
              throw new Error(
                `Mot de passe incorrect. ${attemptsLeft} tentative(s) restante(s).`,
              );
            } else {
              throw new Error(
                'Trop de tentatives échouées. Compte temporairement verrouillé.',
              );
            }
          }

          // Connexion réussie - Reset tentatives + update lastLogin
          await user.resetLoginAttempts();

          // 5. Retourner l'utilisateur avec tous les champs utiles
          return {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role || 'user',
            avatar: user.avatar,
            verified: user.verified || false,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
          };
        } catch (error) {
          console.error('Authentication error:', error.message);

          // Capturer seulement les vraies erreurs système
          const systemErrors = [
            'Database connection failed',
            'Internal server error',
            'Connection timeout',
          ];

          const isSystemError = systemErrors.some((sysErr) =>
            error.message.toLowerCase().includes(sysErr.toLowerCase()),
          );

          if (isSystemError) {
            captureException(error, {
              tags: { component: 'auth', action: 'login' },
              extra: { email: credentials?.email },
            });
          }

          // Renvoyer l'erreur pour NextAuth
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    // Callback JWT enrichi
    jwt: async ({ token, user }) => {
      if (user) {
        token.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          verified: user.verified,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        };

        // Marquer comme nouvelle connexion
        token.isNewLogin = true;
        token.loginTime = Date.now();

        // Mettre à jour lastLogin en base de données
        try {
          await dbConnect();
          await User.findByIdAndUpdate(user._id, {
            lastLogin: new Date(),
            $unset: { lockUntil: 1 }, // Nettoyer le verrou
            loginAttempts: 0,
          });
        } catch (error) {
          console.error('Failed to update lastLogin:', error);
          captureException(error, {
            tags: { component: 'auth', action: 'lastLogin-update' },
            user: { id: user._id, email: user.email },
          });
        }
      }

      // Marquer que ce n'est plus une nouvelle connexion après 5 secondes
      if (token.loginTime && Date.now() - token.loginTime > 5000) {
        token.isNewLogin = false;
      }

      return token;
    },

    // Session enrichie avec plus de données
    session: async ({ session, token }) => {
      if (token?.user) {
        session.user = {
          ...token.user,
          // Informations supplémentaires pour l'interface
          memberSince: token.user.createdAt,
          isVerified: token.user.verified,
          accountStatus: token.user.isActive ? 'active' : 'suspended',
        };
        session.isNewLogin = token.isNewLogin || false;
      }
      return session;
    },

    // Callback redirect inchangé
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  // Cookies sécurisés avec options étendues
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? `__Secure-next-auth.session-token`
          : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60, // 24 heures
      },
    },
  },

  // Configuration de session JWT
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 heures
    updateAge: 24 * 60 * 60, // Mettre à jour toutes les 24 heures
  },

  // Pages personnalisées
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  // Secret pour JWT
  secret: process.env.NEXTAUTH_SECRET,

  // Debug seulement en développement
  debug: process.env.NODE_ENV === 'development',
  useSecureCookies: process.env.NODE_ENV === 'production',

  // Events pour tracking
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User signed in: ${user.email}`);
      // Optionnel: Log analytics ou événements personnalisés
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.user?.email}`);
    },
  },
};

// Créer le handler NextAuth de base
const baseHandler = NextAuth(authOptions);

/**
 * Wrapper avec rate limiting pour les endpoints d'authentification
 *
 * IMPORTANT: Les headers de sécurité sont appliqués automatiquement
 * par next.config.mjs, pas besoin de les ajouter ici
 */

// Handler GET avec rate limiting modéré (pour session, csrf, providers)
export const GET = withAuthRateLimit(
  async (...args) => {
    return baseHandler(...args);
  },
  {
    // Configuration plus permissive pour les GET (session checks fréquents)
    customLimit: {
      points: 30, // 30 requêtes
      duration: 60000, // par minute
      blockDuration: 60000, // blocage 1 minute si dépassement
    },
  },
);

// Handler POST avec rate limiting strict (pour signin)
export const POST = withAuthRateLimit(
  async (...args) => {
    // Log pour monitoring des tentatives de connexion
    try {
      const req = args[0];
      if (req && req.url && req.url.includes('/signin')) {
        const body = await req.clone().text();
        // Extraire l'email sans logger le mot de passe
        const email = body.match(/email=([^&]*)/)?.[1];
        if (email) {
          console.log('[AUTH] Login attempt for:', decodeURIComponent(email));
        }
      }
    } catch (err) {
      // Ignorer les erreurs de logging
    }

    return baseHandler(...args);
  },
  {
    // Configuration très stricte pour les POST (tentatives de connexion)
    customLimit: {
      points: 5, // Seulement 5 tentatives
      duration: 900000, // par 15 minutes
      blockDuration: 1800000, // blocage 30 minutes si dépassement
    },
  },
);

// Export de authOptions pour utilisation dans d'autres fichiers
export { authOptions as auth };
