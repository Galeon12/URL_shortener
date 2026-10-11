/**
 * Distributed Token Bucket Rate Limiter (Phase 1 & 7)
 *
 * Primary:  Redis-backed — state is shared across all Node.js instances,
 *           enabling true horizontal rate limiting.
 *
 * Fallback: In-process Map — used when Redis is unavailable so the API
 *           does NOT silently remove security if the cache layer is down.
 *           The fallback is per-instance and therefore does not share state
 *           across scaled replicas, but it still protects each individual node.
 *
 * Algorithm: Fixed-window refill (atomic Lua script on Redis for correctness).
 *
 * Configuration (via environment variables or defaults):
 *   RATE_LIMIT_CAPACITY         — max tokens per IP (default 10)
 *   RATE_LIMIT_REFILL_RATE      — tokens added per second (default 1)
 */
import { getRedisClient, isRedisReady } from '../config/redis.js';

const CAPACITY = parseInt(process.env.RATE_LIMIT_CAPACITY, 10) || 10;
const REFILL_RATE_PER_SECOND = parseFloat(process.env.RATE_LIMIT_REFILL_RATE) || 1;
const KEY_PREFIX = 'rl:';

// ─── In-memory fallback ──────────────────────────────────────────────────────
const fallbackBuckets = new Map();

function consumeFallback(ip) {
  const now = Date.now();
  if (!fallbackBuckets.has(ip)) {
    fallbackBuckets.set(ip, { tokens: CAPACITY - 1, lastRefill: now });
    return { allowed: true, remaining: CAPACITY - 1 };
  }
  const bucket = fallbackBuckets.get(ip);
  const timePassed = (now - bucket.lastRefill) / 1000;
  const refillTokens = Math.floor(timePassed * REFILL_RATE_PER_SECOND);
  if (refillTokens > 0) {
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + refillTokens);
    bucket.lastRefill = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: bucket.tokens };
  }
  return { allowed: false, remaining: 0 };
}

// ─── Redis Lua script ────────────────────────────────────────────────────────
// Atomic token-bucket consume. Returns [allowed (0/1), remaining_tokens].
const CONSUME_SCRIPT = `
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill   = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])
local ttl      = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens    = tonumber(data[1])
local lastRefill = tonumber(data[2])

if tokens == nil then
  -- First request from this IP
  redis.call('HMSET', key, 'tokens', capacity - 1, 'lastRefill', now)
  redis.call('EXPIRE', key, ttl)
  return {1, capacity - 1}
end

local timePassed = (now - lastRefill) / 1000
local refillTokens = math.floor(timePassed * refill)
if refillTokens > 0 then
  tokens = math.min(capacity, tokens + refillTokens)
  lastRefill = now
end

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, ttl)
  return {1, tokens}
else
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, ttl)
  return {0, 0}
end
`;

async function consumeRedis(ip) {
  const redis = getRedisClient();
  const now = Date.now();
  // TTL = enough seconds for the bucket to fully refill from empty
  const ttl = Math.ceil(CAPACITY / REFILL_RATE_PER_SECOND) + 60;
  try {
    const result = await redis.eval(
      CONSUME_SCRIPT,
      1,
      `${KEY_PREFIX}${ip}`,
      CAPACITY,
      REFILL_RATE_PER_SECOND,
      now,
      ttl
    );
    return { allowed: result[0] === 1, remaining: result[1] };
  } catch (err) {
    console.warn('[RateLimit] Redis eval error, falling back to in-memory:', err.message);
    return null; // signal to caller to use fallback
  }
}

// ─── Status helper (for /api/url/tokens endpoint) ────────────────────────────
export const getBucketStatus = (rawIp) => {
  const ip = rawIp || '127.0.0.1';
  const now = Date.now();
  if (!fallbackBuckets.has(ip)) {
    return { tokens: CAPACITY, capacity: CAPACITY, refillRate: REFILL_RATE_PER_SECOND };
  }
  const bucket = fallbackBuckets.get(ip);
  const timePassed = (now - bucket.lastRefill) / 1000;
  const refillTokens = Math.floor(timePassed * REFILL_RATE_PER_SECOND);
  const currentTokens = Math.min(CAPACITY, bucket.tokens + refillTokens);
  return { tokens: currentTokens, capacity: CAPACITY, refillRate: REFILL_RATE_PER_SECOND };
};

// ─── Middleware ───────────────────────────────────────────────────────────────
const tokenBucket = async (req, res, next) => {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '127.0.0.1';

  res.setHeader('X-RateLimit-Limit', CAPACITY);
  res.setHeader('X-RateLimit-RefillRate', `${REFILL_RATE_PER_SECOND}/s`);

  let result = null;

  if (isRedisReady()) {
    result = await consumeRedis(ip);
  }

  // Use fallback if Redis is unavailable or errored
  if (result === null) {
    result = consumeFallback(ip);
  }

  res.setHeader('X-RateLimit-Remaining', result.remaining);

  if (result.allowed) {
    return next();
  }

  return res.status(429).json({
    error: 'Too many requests. Please try again in a few seconds.',
    retryAfter: Math.ceil(1 / REFILL_RATE_PER_SECOND),
  });
};

export default tokenBucket;
