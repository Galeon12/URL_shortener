/**
 * URL Cache Service (Phase 1 & 4)
 *
 * Cache-aside strategy:
 *   Read:  check Redis → hit: return cached; miss: query Mongo, populate Redis, return
 *   Write: populate/invalidate Redis on create/delete
 *
 * Key format: url:<urlCode>
 * TTL:        24 hours by default (overridden for URLs with expiration set)
 */
import { getRedisClient, isRedisReady } from '../config/redis.js';

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 h
const KEY_PREFIX = 'url:';

function buildKey(code) {
  return `${KEY_PREFIX}${code}`;
}

/**
 * Get a cached URL record by short code.
 * Returns parsed object or null on miss/error.
 */
export async function getCachedUrl(code) {
  if (!isRedisReady()) return null;
  try {
    const raw = await getRedisClient().get(buildKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[Cache] GET error:', err.message);
    return null;
  }
}

/**
 * Store a URL record in the cache.
 * If the record has an expiresAt field, the TTL is derived from it.
 */
export async function setCachedUrl(code, record) {
  if (!isRedisReady()) return;
  try {
    const ttl = computeTTL(record);
    if (ttl <= 0) return; // already expired — do not cache
    await getRedisClient().setex(buildKey(code), ttl, JSON.stringify(record));
  } catch (err) {
    console.warn('[Cache] SET error:', err.message);
  }
}

/**
 * Remove a URL from the cache (called on delete or expiration).
 */
export async function invalidateCachedUrl(code) {
  if (!isRedisReady()) return;
  try {
    await getRedisClient().del(buildKey(code));
  } catch (err) {
    console.warn('[Cache] DEL error:', err.message);
  }
}

function computeTTL(record) {
  if (record && record.expiresAt) {
    const remaining = Math.floor((new Date(record.expiresAt) - Date.now()) / 1000);
    return Math.min(remaining, DEFAULT_TTL_SECONDS);
  }
  return DEFAULT_TTL_SECONDS;
}
