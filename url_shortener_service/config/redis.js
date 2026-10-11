/**
 * Redis client configuration.
 *
 * Uses ioredis with lazy connect so the app boots even if Redis is not available.
 * All consumers should call `isRedisReady()` before performing cache operations.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let client = null;
let redisReady = false;

function createClient() {
  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectTimeout: 3000,
    retryStrategy(times) {
      // Back off exponentially, cap at 30 seconds. Stop retrying after 5 failed attempts.
      if (times > 5) return null;
      return Math.min(times * 500, 30000);
    },
  });

  redis.on('connect', () => {
    console.log('[Redis] Connected');
    redisReady = true;
  });

  redis.on('ready', () => {
    redisReady = true;
  });

  redis.on('error', (err) => {
    if (redisReady) {
      console.warn('[Redis] Connection error:', err.message);
    }
    redisReady = false;
  });

  redis.on('close', () => {
    redisReady = false;
  });

  return redis;
}

export function getRedisClient() {
  if (!client) {
    client = createClient();
    // Fire and forget — if Redis is unavailable, app continues without it.
    client.connect().catch(() => {});
  }
  return client;
}

export function isRedisReady() {
  return redisReady && client !== null;
}
