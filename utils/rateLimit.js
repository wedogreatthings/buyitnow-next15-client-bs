/**
 * Rate Limiter moderne avec LRU Cache pour Next.js 15
 * Optimisé pour ~500 visiteurs/jour sur VPS Ubuntu avec PM2 (mono-processus)
 *
 * Features 2025:
 * - Algorithme Sliding Window Log pour une précision optimale
 * - LRU Cache pour limiter la consommation mémoire
 * - Headers standard RFC 6585 et draft-ietf-httpapi-ratelimit
 * - Protection DDoS avec détection de patterns d'attaque
 * - Support différencié par rôle utilisateur
 * - Métriques exportables vers Sentry
 *
 * @version 2.0.0
 * @date 2025-09-22
 */

import { NextResponse } from 'next/server';

/**
 * Classe LRU Cache optimisée pour le rate limiting
 * Limite automatiquement la taille des Maps pour éviter les memory leaks
 */
class LRUCache extends Map {
  constructor(maxSize = 1000, ttl = 3600000) {
    super();
    this.maxSize = maxSize;
    this.ttl = ttl; // Time to live en ms
    this.timestamps = new Map();
  }

  set(key, value) {
    // Supprimer les entrées expirées
    this.cleanup();

    // Si la taille max est atteinte, supprimer le plus ancien
    if (this.size >= this.maxSize && !this.has(key)) {
      const firstKey = this.keys().next().value;
      this.delete(firstKey);
      this.timestamps.delete(firstKey);
    }

    this.timestamps.set(key, Date.now());
    return super.set(key, value);
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() - timestamp > this.ttl) {
      this.delete(key);
      this.timestamps.delete(key);
      return undefined;
    }
    return super.get(key);
  }

  delete(key) {
    this.timestamps.delete(key);
    return super.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.ttl) {
        this.delete(key);
      }
    }
  }

  clear() {
    this.timestamps.clear();
    return super.clear();
  }
}

/**
 * Configuration des limites par endpoint et par rôle
 * Basé sur les recommandations 2025 pour Next.js
 */
const RATE_LIMITS = {
  // Endpoints publics
  public: {
    api: { points: 60, duration: 60000, blockDuration: 60000 }, // 60 req/min
    search: { points: 20, duration: 60000, blockDuration: 120000 }, // 20 req/min
  },
  // Endpoints authentifiés
  authenticated: {
    api: { points: 120, duration: 60000, blockDuration: 60000 }, // 120 req/min
    upload: { points: 10, duration: 300000, blockDuration: 600000 }, // 10/5min
  },
  // Endpoints critiques
  critical: {
    auth: { points: 5, duration: 900000, blockDuration: 1800000 }, // 5/15min
    payment: { points: 3, duration: 300000, blockDuration: 3600000 }, // 3/5min
    password: { points: 3, duration: 3600000, blockDuration: 3600000 }, // 3/h
  },
  // Utilisateurs premium (si applicable)
  premium: {
    api: { points: 500, duration: 60000, blockDuration: 30000 }, // 500 req/min
  },
};

/**
 * Sliding Window Log - Algorithme recommandé en 2025
 * Plus précis que Fixed Window, moins complexe que Sliding Window Counter
 */
class SlidingWindowRateLimiter {
  constructor(maxRequests = 2000, maxBlocked = 500) {
    // LRU Caches avec limites de taille
    this.requests = new LRUCache(maxRequests, 3600000); // TTL 1h
    this.blocked = new LRUCache(maxBlocked, 1800000); // TTL 30min
    this.metrics = new LRUCache(100, 300000); // Métriques, TTL 5min

    // Whitelist et configuration
    this.whitelist = new Set([
      '127.0.0.1',
      '::1',
      // Ajouter IPs de monitoring, CDN, etc.
    ]);

    // Pattern detection pour anti-DDoS
    this.suspiciousPatterns = new Map();

    // Cleanup automatique
    this.startCleanupInterval();
  }

  /**
   * Extraction d'IP robuste avec support IPv6
   */
  extractIP(req) {
    // Headers dans l'ordre de priorité
    const headers = [
      'cf-connecting-ip', // Cloudflare
      'x-real-ip', // Nginx proxy
      'x-forwarded-for', // Standard proxy
      'x-client-ip', // Autres proxies
    ];

    for (const header of headers) {
      const value = req.headers.get(header);
      if (value) {
        // Prendre la première IP valide (IPv4 ou IPv6)
        const ips = value.split(',').map((ip) => ip.trim());
        const validIP = ips.find((ip) => this.isValidIP(ip));
        if (validIP) return validIP;
      }
    }

    // Fallback
    return req.ip || '0.0.0.0';
  }

  /**
   * Validation d'IP (IPv4 et IPv6)
   */
  isValidIP(ip) {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 simplifié
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Génération d'un identifiant unique pour le rate limiting
   */
  generateKey(ip, userId = null, endpoint = 'api') {
    if (userId) {
      // Pour les utilisateurs authentifiés, combiner IP + userId
      return `${endpoint}:user:${userId}:${ip}`;
    }
    return `${endpoint}:ip:${ip}`;
  }

  /**
   * Algorithme Sliding Window Log
   */
  isRateLimited(key, limit) {
    const now = Date.now();
    const windowStart = now - limit.duration;

    // Récupérer ou initialiser le log des requêtes
    let requestLog = this.requests.get(key) || [];

    // Filtrer les requêtes dans la fenêtre courante
    requestLog = requestLog.filter((timestamp) => timestamp > windowStart);

    // Vérifier la limite
    if (requestLog.length >= limit.points) {
      return {
        limited: true,
        remaining: 0,
        resetAt: Math.min(...requestLog) + limit.duration,
        retryAfter: Math.ceil(
          (Math.min(...requestLog) + limit.duration - now) / 1000,
        ),
      };
    }

    // Ajouter la requête actuelle
    requestLog.push(now);
    this.requests.set(key, requestLog);

    return {
      limited: false,
      remaining: limit.points - requestLog.length,
      resetAt: windowStart + limit.duration,
      retryAfter: 0,
    };
  }

  /**
   * Détection de patterns d'attaque
   */
  detectSuspiciousActivity(ip) {
    const pattern = this.suspiciousPatterns.get(ip) || {
      count: 0,
      firstSeen: Date.now(),
    };
    pattern.count++;

    // Reset après 1 minute
    if (Date.now() - pattern.firstSeen > 60000) {
      pattern.count = 1;
      pattern.firstSeen = Date.now();
    }

    this.suspiciousPatterns.set(ip, pattern);

    // Seuil d'activité suspecte : plus de 200 requêtes/minute
    return pattern.count > 200;
  }

  /**
   * Vérification du blocage
   */
  isBlocked(ip) {
    const blockInfo = this.blocked.get(ip);
    if (!blockInfo) return null;

    const now = Date.now();
    if (now < blockInfo.until) {
      return {
        blocked: true,
        until: blockInfo.until,
        reason: blockInfo.reason,
        retryAfter: Math.ceil((blockInfo.until - now) / 1000),
      };
    }

    this.blocked.delete(ip);
    return null;
  }

  /**
   * Bloquer une IP
   */
  blockIP(ip, duration, reason = 'rate_limit_exceeded') {
    const until = Date.now() + duration;
    this.blocked.set(ip, {
      until,
      reason,
      count: (this.blocked.get(ip)?.count || 0) + 1,
    });

    // Log pour Sentry
    this.logMetric('ip_blocked', { ip, reason, duration });
  }

  /**
   * Enregistrement des métriques
   */
  logMetric(event, data) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `metrics:${minute}`;
    const metrics = this.metrics.get(key) || {
      events: [],
      timestamp: Date.now(),
    };

    metrics.events.push({
      event,
      data,
      timestamp: Date.now(),
    });

    this.metrics.set(key, metrics);

    // Hook pour Sentry (à implémenter selon votre config)
    if (event === 'ip_blocked' || event === 'ddos_detected') {
      console.warn(`[RATE_LIMIT] ${event}:`, data);
      // TODO: Sentry.captureMessage(`Rate limit: ${event}`, 'warning', { extra: data });
    }
  }

  /**
   * Export des métriques pour monitoring
   */
  getMetrics() {
    const metrics = {
      requests_cache_size: this.requests.size,
      blocked_ips_count: this.blocked.size,
      suspicious_ips_count: this.suspiciousPatterns.size,
      events: [],
    };

    for (const [_, data] of this.metrics.entries()) {
      metrics.events.push(...data.events);
    }

    return metrics;
  }

  /**
   * Nettoyage automatique périodique
   */
  startCleanupInterval() {
    if (typeof setInterval === 'undefined') return;

    // Nettoyage toutes les 2 minutes
    setInterval(() => {
      // Cleanup des LRU caches
      this.requests.cleanup();
      this.blocked.cleanup();
      this.metrics.cleanup();

      // Cleanup des patterns suspects anciens
      const now = Date.now();
      for (const [ip, pattern] of this.suspiciousPatterns.entries()) {
        if (now - pattern.firstSeen > 300000) {
          // 5 minutes
          this.suspiciousPatterns.delete(ip);
        }
      }

      // Log de santé
      if (this.requests.size > this.requests.maxSize * 0.8) {
        console.warn('[RATE_LIMIT] Cache requests proche de la limite:', {
          current: this.requests.size,
          max: this.requests.maxSize,
        });
      }
    }, 120000); // 2 minutes
  }
}

// Instance singleton
const rateLimiter = new SlidingWindowRateLimiter();

/**
 * Middleware principal de rate limiting
 */
export function withRateLimit(handler, options = {}) {
  const {
    type = 'public',
    endpoint = 'api',
    customLimit = null,
    getUserRole = null,
    skipWhitelist = false,
  } = options;

  return async function rateLimitedHandler(req) {
    try {
      const ip = rateLimiter.extractIP(req);

      // Skip pour whitelist (sauf si explicitement désactivé)
      if (!skipWhitelist && rateLimiter.whitelist.has(ip)) {
        return handler(req);
      }

      // Vérifier si IP bloquée
      const blockInfo = rateLimiter.isBlocked(ip);
      if (blockInfo) {
        return NextResponse.json(
          {
            error: 'Access temporarily blocked',
            reason: blockInfo.reason,
            retryAfter: blockInfo.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': blockInfo.retryAfter.toString(),
              'X-RateLimit-Policy': '429-blocked',
            },
          },
        );
      }

      // Détection d'activité suspecte
      if (rateLimiter.detectSuspiciousActivity(ip)) {
        rateLimiter.blockIP(ip, 1800000, 'suspicious_activity'); // 30min
        rateLimiter.logMetric('ddos_detected', { ip });

        return NextResponse.json(
          { error: 'Suspicious activity detected' },
          { status: 429 },
        );
      }

      // Déterminer le rôle et les limites
      let userRole = type;
      let userId = null;

      if (getUserRole && typeof getUserRole === 'function') {
        const roleInfo = await getUserRole(req);
        if (roleInfo) {
          userRole = roleInfo.role || type;
          userId = roleInfo.userId;
        }
      }

      // Sélectionner la limite appropriée
      const limit =
        customLimit ||
        RATE_LIMITS[userRole]?.[endpoint] ||
        RATE_LIMITS.public.api;

      // Générer la clé unique
      const key = rateLimiter.generateKey(ip, userId, endpoint);

      // Vérifier le rate limit
      const result = rateLimiter.isRateLimited(key, limit);

      if (result.limited) {
        // Incrémenter le compteur de violations
        const violations =
          (rateLimiter.requests.get(`violations:${ip}`) || 0) + 1;
        rateLimiter.requests.set(`violations:${ip}`, violations);

        // Bloquer si trop de violations
        if (violations > 10) {
          rateLimiter.blockIP(ip, limit.blockDuration, 'repeated_violations');
        }

        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            limit: limit.points,
            window: `${limit.duration / 1000}s`,
            retryAfter: result.retryAfter,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.points.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
              'Retry-After': result.retryAfter.toString(),
              // Headers draft-ietf-httpapi-ratelimit (2025 standard)
              'RateLimit-Limit': limit.points.toString(),
              'RateLimit-Remaining': '0',
              'RateLimit-Reset': result.retryAfter.toString(),
              'RateLimit-Policy': `${limit.points};w=${limit.duration / 1000}`,
            },
          },
        );
      }

      // Exécuter le handler
      const response = await handler(req);

      // Ajouter les headers de rate limit à la réponse
      if (response instanceof NextResponse) {
        response.headers.set('X-RateLimit-Limit', limit.points.toString());
        response.headers.set(
          'X-RateLimit-Remaining',
          result.remaining.toString(),
        );
        response.headers.set(
          'X-RateLimit-Reset',
          new Date(result.resetAt).toISOString(),
        );
        // Headers modernes
        response.headers.set('RateLimit-Limit', limit.points.toString());
        response.headers.set(
          'RateLimit-Remaining',
          result.remaining.toString(),
        );
        response.headers.set(
          'RateLimit-Reset',
          Math.ceil(result.resetAt / 1000).toString(),
        );
      }

      return response;
    } catch (error) {
      console.error('[RATE_LIMIT] Error:', error);
      rateLimiter.logMetric('error', {
        message: error.message,
        stack: error.stack,
      });

      // En cas d'erreur, laisser passer la requête
      return handler(req);
    }
  };
}

/**
 * Helpers pré-configurés pour différents cas d'usage
 */
export const withAuthRateLimit = (handler, options = {}) =>
  withRateLimit(handler, { ...options, type: 'critical', endpoint: 'auth' });

export const withApiRateLimit = (handler, options = {}) =>
  withRateLimit(handler, { ...options, type: 'public', endpoint: 'api' });

export const withPaymentRateLimit = (handler, options = {}) =>
  withRateLimit(handler, { ...options, type: 'critical', endpoint: 'payment' });

export const withUploadRateLimit = (handler, options = {}) =>
  withRateLimit(handler, {
    ...options,
    type: 'authenticated',
    endpoint: 'upload',
  });

/**
 * Fonction pour récupérer les métriques (utile pour monitoring)
 */
export function getRateLimitMetrics() {
  return rateLimiter.getMetrics();
}

/**
 * Fonction pour débloquer manuellement une IP (admin)
 */
export function unblockIP(ip) {
  return rateLimiter.blocked.delete(ip);
}

/**
 * Configuration pour middleware global Next.js
 */
export function createRateLimitMiddleware(config = {}) {
  return async function middleware(req) {
    const { pathname } = req.nextUrl;

    // Déterminer le type d'endpoint basé sur le path
    let type = 'public';
    let endpoint = 'api';

    if (pathname.startsWith('/api/auth')) {
      type = 'critical';
      endpoint = 'auth';
    } else if (pathname.startsWith('/api/payment')) {
      type = 'critical';
      endpoint = 'payment';
    } else if (pathname.startsWith('/api/upload')) {
      type = 'authenticated';
      endpoint = 'upload';
    }

    // Appliquer le rate limiting
    const mockHandler = async () => NextResponse.next();
    const limited = await withRateLimit(mockHandler, { type, endpoint })(req);

    return limited;
  };
}

/**
 * Export par défaut
 */
export default {
  withRateLimit,
  withAuthRateLimit,
  withApiRateLimit,
  withPaymentRateLimit,
  withUploadRateLimit,
  getRateLimitMetrics,
  unblockIP,
  createRateLimitMiddleware,
};

/**
 * USAGE EXAMPLES:
 *
 * // app/api/auth/login/route.js (App Router)
 * import { withAuthRateLimit } from '@/utils/rateLimit';
 *
 * export const POST = withAuthRateLimit(async (req) => {
 *   // Logique de login
 *   return NextResponse.json({ success: true });
 * });
 *
 * // app/api/products/route.js
 * import { withApiRateLimit } from '@/utils/rateLimit';
 *
 * export const GET = withApiRateLimit(async (req) => {
 *   // Logique API
 *   return NextResponse.json({ products: [] });
 * });
 *
 * // Avec rôle utilisateur personnalisé
 * export const GET = withRateLimit(handler, {
 *   getUserRole: async (req) => {
 *     const session = await getSession(req);
 *     return {
 *       role: session?.user?.plan || 'public',
 *       userId: session?.user?.id
 *     };
 *   }
 * });
 *
 * // middleware.js (pour protection globale)
 * import { createRateLimitMiddleware } from '@/utils/rateLimit';
 *
 * export const middleware = createRateLimitMiddleware();
 *
 * export const config = {
 *   matcher: '/api/:path*'
 * };
 */
