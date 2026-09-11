// backend/src/config/redis.js
const Redis = require('ioredis');

let redisClient = null;
let redisSubscriber = null;
let isRedisEnabled = false;

/**
 * Vérifie si Redis est disponible
 * Redis n'est activé QUE si :
 *   - DISABLE_REDIS !== 'true'
 *   - NODE_ENV !== 'test'
 *   - REDIS_URL est défini dans .env  ← condition ajoutée
 */
const isRedisAvailable = () => {
  if (process.env.DISABLE_REDIS === 'true') return false;
  if (process.env.NODE_ENV === 'test') return false;
  if (!process.env.REDIS_URL) return false; // ✅ Nouveau : pas de REDIS_URL = désactivé
  return true;
};

/**
 * Initialise la connexion Redis
 */
const initRedis = () => {
  if (!isRedisAvailable()) {
    if (!isRedisEnabled) {
      console.log('ℹ️ Redis désactivé (mode synchrone)');
      isRedisEnabled = false;
    }
    return null;
  }

  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          console.log('⚠️ Redis indisponible - Mode synchrone');
          return null;
        }
        return Math.min(times * 50, 1000);
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.log('⚠️ Redis non disponible - Mode synchrone');
        isRedisEnabled = false;
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connecté');
      isRedisEnabled = true;
    });

    redisClient.connect().catch(() => {
      // Ignorer l'erreur de connexion
    });
  } catch (error) {
    console.log('⚠️ Redis non disponible - Mode synchrone');
    isRedisEnabled = false;
    return null;
  }

  return redisClient;
};

/**
 * Récupère le client Redis
 */
const getRedisClient = () => {
  if (!isRedisAvailable()) {
    return null;
  }

  if (!redisClient) {
    return initRedis();
  }

  return redisClient;
};

/**
 * Récupère le subscriber Redis
 */
const getRedisSubscriber = () => {
  if (!isRedisAvailable()) {
    return null;
  }

  if (!redisSubscriber) {
    const redisUrl = process.env.REDIS_URL;
    try {
      redisSubscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });
      redisSubscriber.connect().catch(() => {});
    } catch (error) {
      return null;
    }
  }
  return redisSubscriber;
};

/**
 * Ferme les connexions Redis
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
    redisSubscriber = null;
  }
  isRedisEnabled = false;
  console.log('🔴 Redis déconnecté');
};

module.exports = {
  initRedis,
  getRedisClient,
  getRedisSubscriber,
  closeRedis,
  isRedisAvailable,
};