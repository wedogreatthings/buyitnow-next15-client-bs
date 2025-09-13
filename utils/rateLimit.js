/**
 * Rate limiting ultra-simple pour Next.js API Routes
 * Adapté pour ~500 visiteurs/jour
 */

import { NextResponse } from 'next/server';

// Cache simple en mémoire
const requests = new Map();
const blocked = new Map();

/**
 * Whitelist des IPs qui ne sont pas soumises au rate limiting
 */
const WHITELIST = new Set([
  '127.0.0.1',
  // IPs de monitoring, partenaires, etc.
]);

/**
 * Configurations pour votre e-commerce
 */
const LIMITS = {
  auth: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 tentatives/15min
  api: { max: 60, windowMs: 60 * 1000 }, // 60 req/min
  payment: { max: 3, windowMs: 5 * 60 * 1000 }, // 3 paiements/5min
};

/**
 * Vérifier si une IP est privée
 */
function isPrivateIP(ip) {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
}

/**
 * Obtenir l'IP client de manière robuste
 */
function getIP(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    // Prendre la première IP non-privée
    const publicIP = ips.find((ip) => !isPrivateIP(ip));
    if (publicIP) return publicIP;
  }

  return req.headers.get('x-real-ip') || req.socket?.remoteAddress || '0.0.0.0';
}

/**
 * Middleware de rate limiting simple
 */
export function withRateLimit(handler, type = 'api') {
  return async function rateLimitedHandler(req) {
    const ip = getIP(req);

    // Skip rate limiting pour IPs whitelistées
    if (WHITELIST.has(ip)) {
      return handler(req);
    }

    const config = LIMITS[type] || LIMITS.api;
    const key = `${type}:${ip}`;
    const now = Date.now();

    // Vérifier si IP bloquée
    const blockUntil = blocked.get(ip);
    if (blockUntil && now < blockUntil) {
      return NextResponse.json(
        {
          error: 'Trop de tentatives',
          retryAfter: Math.ceil((blockUntil - now) / 1000),
        },
        { status: 429 },
      );
    }

    // Nettoyer les anciennes requêtes
    const requestTimes = (requests.get(key) || []).filter(
      (time) => now - time < config.windowMs,
    );

    // Vérifier la limite
    if (requestTimes.length >= config.max) {
      // Bloquer temporairement si abus
      if (requestTimes.length > config.max * 2) {
        blocked.set(ip, now + 30 * 60 * 1000); // 30min
        console.warn(`IP bloquée pour abus: ${ip}`);
      }

      return NextResponse.json(
        {
          error: 'Limite de requêtes dépassée',
          limit: config.max,
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.max.toString(),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // Enregistrer cette requête
    requestTimes.push(now);
    requests.set(key, requestTimes);

    // Continuer avec le handler original
    const response = await handler(req);

    // Ajouter headers informatifs
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', config.max.toString());
      response.headers.set(
        'X-RateLimit-Remaining',
        (config.max - requestTimes.length).toString(),
      );
    }

    return response;
  };
}

/**
 * Helpers pour différents types d'endpoints
 */
export const withAuthRateLimit = (handler) => withRateLimit(handler, 'auth');
export const withApiRateLimit = (handler) => withRateLimit(handler, 'api');
export const withPaymentRateLimit = (handler) =>
  withRateLimit(handler, 'payment');

/**
 * Usage dans vos API Routes:
 *
 * // pages/api/auth/login.js
 * export default withAuthRateLimit(async function handler(req) {
 *   // Votre logique de login
 * });
 *
 * // pages/api/products.js
 * export default withApiRateLimit(async function handler(req) {
 *   // Votre logique API
 * });
 *
 * // pages/api/payment.js
 * export default withPaymentRateLimit(async function handler(req) {
 *   // Votre logique de paiement
 * });
 */

// Nettoyage périodique (optionnel)
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now();

      // Nettoyer les requêtes expirées
      for (const [key, times] of requests.entries()) {
        const validTimes = times.filter((time) => now - time < 60 * 60 * 1000); // 1h
        if (validTimes.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, validTimes);
        }
      }

      // Nettoyer les IPs bloquées expirées
      for (const [ip, blockUntil] of blocked.entries()) {
        if (now >= blockUntil) {
          blocked.delete(ip);
        }
      }
    },
    5 * 60 * 1000,
  ); // Toutes les 5 minutes
}

export default {
  withRateLimit,
  withAuthRateLimit,
  withApiRateLimit,
  withPaymentRateLimit,
};
