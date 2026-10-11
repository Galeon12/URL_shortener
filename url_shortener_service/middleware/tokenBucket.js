const buckets = new Map();

// Token bucket parameters
const CAPACITY = 10;
const REFILL_RATE_PER_SECOND = 1;

export const getBucketStatus = (rawIp) => {
  const ip = rawIp || '127.0.0.1';
  const now = Date.now();
  if (!buckets.has(ip)) {
    return { tokens: CAPACITY, capacity: CAPACITY, refillRate: REFILL_RATE_PER_SECOND };
  }
  const bucket = buckets.get(ip);
  const timePassed = (now - bucket.lastRefill) / 1000;
  const refillTokens = Math.floor(timePassed * REFILL_RATE_PER_SECOND);
  const currentTokens = Math.min(CAPACITY, bucket.tokens + refillTokens);
  return { tokens: currentTokens, capacity: CAPACITY, refillRate: REFILL_RATE_PER_SECOND };
};

const tokenBucket = (req, res, next) => {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '127.0.0.1';
  const now = Date.now();

  res.setHeader('X-RateLimit-Limit', CAPACITY);
  res.setHeader('X-RateLimit-RefillRate', `${REFILL_RATE_PER_SECOND}/s`);

  if (!buckets.has(ip)) {
    buckets.set(ip, {
      tokens: CAPACITY - 1, // Consume one token for this request
      lastRefill: now
    });
    res.setHeader('X-RateLimit-Remaining', CAPACITY - 1);
    return next();
  }

  const bucket = buckets.get(ip);
  const timePassed = (now - bucket.lastRefill) / 1000; // in seconds
  
  // Refill tokens based on time passed
  const refillTokens = Math.floor(timePassed * REFILL_RATE_PER_SECOND);
  
  if (refillTokens > 0) {
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + refillTokens);
    bucket.lastRefill = now - ((timePassed % (1 / REFILL_RATE_PER_SECOND)) * 1000 || 0);
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(ip, bucket);
    res.setHeader('X-RateLimit-Remaining', bucket.tokens);
    return next();
  } else {
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({ error: 'Too many requests, please try again in a few seconds.', retryAfter: 1 });
  }
};

export default tokenBucket;

