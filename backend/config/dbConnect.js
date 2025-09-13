import mongoose from 'mongoose';
import { captureException, captureMessage } from '@/monitoring/sentry';
import { isValidMongoURI } from '../utils/validation';
import logger from '@/utils/logger';

// ===== CIRCUIT BREAKER IMPLEMENTATION =====
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 60 secondes

    // États possibles : CLOSED, OPEN, HALF_OPEN
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error(
          `Circuit breaker OPEN - MongoDB unavailable (failed ${this.failureCount} times)`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      // En état HALF_OPEN, redevenir CLOSED après quelques succès
      if (this.successCount >= 2) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info('Circuit breaker CLOSED - Recovery confirmed');
      }
    } else if (this.state === 'CLOSED') {
      // Reset le compteur d'échecs après un succès
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';

      logger.error(`Circuit breaker OPENED - ${this.failureCount} failures`, {
        error: error.message,
      });

      // Capturer l'événement critique
      captureMessage(`Circuit breaker OPENED for MongoDB`, {
        level: 'error',
        tags: {
          component: 'circuit-breaker',
          service: 'mongodb',
        },
        extra: {
          failureCount: this.failureCount,
          lastError: error.message,
        },
      });
    } else if (this.state === 'HALF_OPEN') {
      // Retourner à OPEN si échec en HALF_OPEN
      this.state = 'OPEN';
      logger.warn('Circuit breaker returned to OPEN from HALF_OPEN');
    }
  }

  getState() {
    return {
      currentState: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

// ===== VARIABLES GLOBALES =====
const MONGODB_URI = process.env.DB_URI;

// Variables globales et système de cache
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
    circuitBreaker: null,
    isConnecting: false,
    lastHealthCheck: null,
    healthCheckInterval: null,
  };
}

// Initialiser le circuit breaker
if (!cached.circuitBreaker) {
  cached.circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
  });
}

// ===== FONCTIONS DE SANTÉ =====

/**
 * Vérifie l'état de santé de la connexion MongoDB
 * @returns {Promise<Object>} État de santé
 */
export const checkDbHealth = async () => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'unknown',
    healthy: false,
    latency: null,
  };

  try {
    const startTime = Date.now();

    if (!cached.conn) {
      healthCheck.status = 'disconnected';
      return healthCheck;
    }

    // Test de ping avec timeout
    const pingPromise = cached.conn.connection.db.admin().ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), 5000),
    );

    await Promise.race([pingPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    // Vérifier l'état de la connexion
    const readyState = cached.conn.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    healthCheck.status = stateMap[readyState] || 'unknown';
    healthCheck.healthy = readyState === 1 && latency < 1000; // Sain si connecté et latence < 1s
    healthCheck.latency = latency;

    cached.lastHealthCheck = Date.now();

    return healthCheck;
  } catch (error) {
    logger.error('MongoDB health check failed', {
      error: error.message,
    });

    healthCheck.status = 'unhealthy';
    healthCheck.healthy = false;
    healthCheck.error = error.message;

    return healthCheck;
  }
};

/**
 * Démarre un monitoring de santé périodique
 */
export const startHealthMonitoring = () => {
  if (cached.healthCheckInterval) return;

  // Check toutes les 5 minutes au lieu de toutes les minutes
  cached.healthCheckInterval = setInterval(async () => {
    try {
      const health = await checkDbHealth();

      // Alerter si problème détecté
      if (!health.healthy) {
        captureMessage('MongoDB health check failed', {
          level: 'warning',
          tags: {
            component: 'database',
            service: 'health-monitor',
          },
          extra: health,
        });
      }

      // Log uniquement en développement
      if (process.env.NODE_ENV === 'development') {
        logger.info('MongoDB Health Check', {
          status: health.status,
          healthy: health.healthy,
          latency: health.latency,
        });
      }
    } catch (error) {
      logger.error('Health monitoring error', { error: error.message });
    }
  }, 300000); // 5 minutes

  // Éviter que l'intervalle bloque le processus
  if (
    cached.healthCheckInterval &&
    typeof cached.healthCheckInterval === 'object'
  ) {
    cached.healthCheckInterval.unref?.();
  }
};

/**
 * Arrête le monitoring de santé
 */
export const stopHealthMonitoring = () => {
  if (cached.healthCheckInterval) {
    clearInterval(cached.healthCheckInterval);
    cached.healthCheckInterval = null;
  }
};

/**
 * Ferme proprement la connexion à MongoDB
 */
export const closeDbConnection = async () => {
  if (cached.conn) {
    try {
      stopHealthMonitoring();

      await cached.conn.connection.close();
      cached.conn = null;
      cached.promise = null;

      logger.info('MongoDB connection closed successfully');
    } catch (error) {
      logger.error('Error closing MongoDB connection', {
        error: error.message,
      });
      captureException(error, {
        tags: { service: 'database', action: 'disconnect' },
      });
    }
  }
};

/**
 * Fonction principale de connexion à MongoDB avec circuit breaker
 * @param {boolean} forceNew - Force une nouvelle connexion
 * @returns {Promise<Mongoose>} - Instance de connexion Mongoose
 */
const dbConnect = async (forceNew = false) => {
  // Vérifier l'URI
  if (!MONGODB_URI) {
    const error = new Error(
      'MongoDB URI is not defined in environment variables',
    );
    logger.error('Missing MongoDB URI');
    captureException(error, {
      tags: { service: 'database', action: 'connect' },
      level: 'fatal',
    });
    throw error;
  }

  if (!isValidMongoURI(MONGODB_URI)) {
    const error = new Error('Invalid MongoDB URI format');
    logger.error('Invalid MongoDB URI format');
    captureException(error, {
      tags: { service: 'database', action: 'connect' },
      level: 'fatal',
    });
    throw error;
  }

  // Si déjà connecté et pas de force, vérifier la santé
  if (cached.conn && !forceNew) {
    try {
      // Vérification rapide de la connexion existante
      await cached.conn.connection.db.admin().ping();
      return cached.conn;
    } catch (error) {
      logger.warn('Existing connection is not responding, will reconnect', {
        error: error.message,
      });
      await closeDbConnection();
    }
  }

  // Éviter les connexions simultanées
  if (cached.isConnecting) {
    return cached.promise;
  }

  cached.isConnecting = true;

  // Options de connexion optimisées pour 500 visiteurs/jour
  const opts = {
    bufferCommands: false,
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 25,
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 20000,
    serverSelectionTimeoutMS: 20000,
    family: 4,
    heartbeatFrequencyMS: 20000,
    autoIndex: process.env.NODE_ENV !== 'production',
    retryWrites: true,
    ssl: process.env.NODE_ENV === 'production',
  };

  mongoose.set('strictQuery', true);

  // Nettoyer les écouteurs existants
  mongoose.connection.removeAllListeners('connected');
  mongoose.connection.removeAllListeners('error');
  mongoose.connection.removeAllListeners('disconnected');

  // Configuration des événements
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
    startHealthMonitoring(); // Démarrer le monitoring
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', {
      error: err.message,
      code: err.code,
      name: err.name,
    });
    captureException(err, {
      tags: { service: 'database', event: 'connection-error' },
    });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');

    // Reconnecter automatiquement en production
    if (!cached.isConnecting && process.env.NODE_ENV === 'production') {
      logger.info('Attempting to reconnect to MongoDB...');
      setTimeout(() => {
        dbConnect(true).catch((err) => {
          logger.error('Failed to reconnect to MongoDB', {
            error: err.message,
          });
        });
      }, 5000);
    }
  });

  // Gestion propre de l'arrêt
  const handleShutdown = async (signal) => {
    logger.info(`Received ${signal} signal, closing MongoDB connection`);
    await closeDbConnection();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Fonction de connexion avec circuit breaker
  const connectOperation = async () => {
    try {
      logger.info('Attempting to connect to MongoDB via circuit breaker');

      const mongooseInstance = await mongoose.connect(MONGODB_URI, opts);

      logger.info('MongoDB connection established successfully', {
        host: mongooseInstance.connection.host,
        name: mongooseInstance.connection.name,
      });

      return mongooseInstance;
    } catch (err) {
      logger.error('MongoDB connection attempt failed', {
        error: err.message,
        code: err.code,
        name: err.name,
      });

      // Informations détaillées sur l'erreur
      if (err.name === 'MongoServerSelectionError') {
        logger.error('Server selection error - check network or IP whitelist');
      }
      if (err.name === 'MongoNetworkError') {
        logger.error('Network error - check connectivity');
      }

      captureException(err, {
        tags: { service: 'database', action: 'connect' },
        level: 'error',
        extra: { circuitBreakerState: cached.circuitBreaker.getState() },
      });

      throw err;
    }
  };

  try {
    // Exécuter la connexion via le circuit breaker
    cached.promise = cached.circuitBreaker.execute(connectOperation);
    cached.conn = await cached.promise;

    return cached.conn;
  } catch (error) {
    cached.promise = null;

    // Log spécifique si le circuit breaker est ouvert
    if (error.message.includes('Circuit breaker OPEN')) {
      logger.error('MongoDB connection blocked by circuit breaker', {
        state: cached.circuitBreaker.getState(),
      });
    }

    throw error;
  } finally {
    cached.isConnecting = false;
  }
};

/**
 * Obtient l'état du circuit breaker
 * @returns {Object} État du circuit breaker
 */
export const getCircuitBreakerState = () => {
  return cached.circuitBreaker ? cached.circuitBreaker.getState() : null;
};

export default dbConnect;
