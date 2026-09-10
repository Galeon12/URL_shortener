const buckets = new Map();

// Token bucket parameters
const CAPACITY = 10;
const REFILL_RATE_PER_SECOND = 1;

const tokenBucket = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!buckets.has(ip)) {
    buckets.set(ip, {
      tokens: CAPACITY - 1, // Consume one token for this request
      lastRefill: now
    });
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
    return next();
  } else {
    return res.status(429).json('Too many requests, please try again later.');
  }
};

module.exports = tokenBucket;
