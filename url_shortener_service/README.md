# URL Shortener — Production-Grade Backend

A deliberately engineered URL shortener demonstrating distributed systems concepts:
**Redis caching**, **distributed rate limiting**, **async analytics**, **horizontal scaling**, and **MongoDB indexing**.

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │             nginx (port 80)                  │
                    │        Round-robin load balancer             │
                    └────────────┬────────────────┬───────────────┘
                                 │                │
                    ┌────────────▼───┐   ┌────────▼────────┐
                    │  API Instance 1│   │  API Instance 2  │
                    │  (Node/Express)│   │  (Node/Express)  │
                    └────────┬───────┘   └────────┬─────────┘
                             │                    │
              ┌──────────────▼────────────────────▼──────────────┐
              │               Redis (ioredis)                      │
              │  - Distributed rate limiting (Lua atomic script)   │
              │  - URL cache (cache-aside, 24h TTL)                │
              └─────────────────────┬─────────────────────────────┘
                                    │ cache miss only
              ┌─────────────────────▼─────────────────────────────┐
              │               MongoDB Atlas / Local                 │
              │  - Source of truth for all URL records             │
              │  - Indexes on urlCode (unique) + expiresAt         │
              └────────────────────────────────────────────────────┘

              Analytics (async, post-redirect):
              ┌────────────────────────────────────────────────────┐
              │  setImmediate queue  →  MongoDB clickLog update     │
              └────────────────────────────────────────────────────┘
```

---

## Request Flow

### Redirect (`GET /:code`)
1. Parse `urlCode` from path
2. **Redis cache lookup** — if hit, return redirect immediately → enqueue analytics
3. **Cache miss** → MongoDB lookup → populate Redis → redirect → enqueue analytics
4. Check `expiresAt` — return 410 Gone if expired
5. **Analytics** processed *after* the response (zero latency impact)

### URL Creation (`POST /api/url/shorten`)
1. Validate URL and optional `customCode` / `expiresIn`
2. Check for existing entry (deduplication by longUrl)
3. Save to MongoDB
4. **Populate Redis cache**
5. Return the short URL

---

## Key Features

| Feature | Implementation |
|---|---|
| Redis caching | Cache-aside; 24h TTL (or expiry-derived) |
| Distributed rate limiting | Redis Lua script (atomic token bucket) |
| URL expiration | `expiresAt` field; checked on redirect |
| Custom aliases | Validated, collision-checked, reserved-word blocked |
| Async analytics | `setImmediate` queue → MongoDB `clickLog` |
| Horizontal scaling | 2× stateless API + shared Redis + nginx |
| MongoDB fallback | Automatic local JSON storage if DB unreachable |
| Redis fallback | In-process token bucket if Redis unreachable |
| Security | helmet, mongoSanitize, 10kb payload limit, CORS config |
| Observability | morgan access log, `/api/health` with Redis + DB probe |
| Graceful shutdown | SIGTERM/SIGINT drain in-flight requests |

---

## MongoDB Schema

```js
{
  urlCode:   String  // unique, indexed — used on every redirect
  longUrl:   String  // original URL
  shortUrl:  String  // full short URL (includes base)
  clicks:    Number  // total click count
  date:      String  // creation ISO timestamp
  expiresAt: Date    // optional — null means never expires (sparse index)
  clickLog:  [{      // last 100 click events
    timestamp:  Date
    deviceType: 'desktop' | 'mobile' | 'bot' | 'unknown'
    referrer:   String | null
  }]
}
```

**Indexes:**
- `urlCode` — unique, B-tree — used on every redirect and creation dedup check
- `expiresAt` — sparse — allows efficient cleanup queries on expired URLs

---

## Engineering Tradeoffs

### Redis vs MongoDB responsibilities
MongoDB is the **source of truth**. Redis is a **read-through cache** whose data can always be reconstructed from MongoDB. This means Redis can be flushed without data loss.

### Cache-aside vs write-through
Cache-aside (lazy population) was chosen because most short URLs are never hit after creation. Write-through would waste Redis memory on never-clicked URLs. The tradeoff is a single cache-miss latency on first access.

### Distributed vs in-process rate limiting
In-process rate limiting (the original implementation) breaks under horizontal scaling — each instance has independent state. Redis-backed rate limiting shares state atomically via Lua scripts. The fallback to in-process limiting is intentional: security degrades gracefully rather than silently permitting unlimited requests.

### Synchronous vs asynchronous analytics
Synchronous click counting adds a DB write to the critical redirect path. With async processing (setImmediate queue), the redirect returns in ~1ms regardless of DB speed. The tradeoff: analytics may be lost if the process crashes between redirect and queue drain. Acceptable for analytics; unacceptable for billing — a deliberate choice.

### Horizontal scaling considerations
API instances are **stateless** by design: all shared state (rate limit buckets, URL cache) lives in Redis. Adding more instances requires only an nginx upstream entry — no application changes.

---

## Local Setup

```bash
# 1. Clone and install
git clone <repo>
cd URL_Shortener/url_shortener_service
npm install

# 2. Configure (optional — app works without Redis or MongoDB)
cp .env.example .env
# Edit .env with your MongoDB Atlas URI and Redis URL

# 3. Start Redis (optional but recommended)
#    macOS:  brew services start redis
#    Linux:  sudo systemctl start redis
#    Docker: docker run -d -p 6379:6379 redis:7-alpine

# 4. Start the backend
npm start
# or with hot-reload:
npm run dev
```

---

## Docker Setup (Full Stack)

```bash
# From the project root
docker compose up --build

# Verify all services are healthy
docker compose ps

# API is now available at http://localhost:80
# nginx load-balances between api1 and api2
```

**What to verify:**
- Rate limit works across both instances (same IP hits 429 after 10 req regardless of which instance handles each request)
- Cache works across instances (first hit populates Redis, second hit from different instance gets cache hit)

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/url/shorten` | Create a short URL |
| `GET` | `/api/url/recent` | List 20 most recent URLs |
| `GET` | `/api/url/stats/:code` | Get stats + click log for a code |
| `GET` | `/api/url/tokens` | Check your rate-limit token status |
| `DELETE` | `/api/url/:code` | Delete a URL + invalidate cache |
| `GET` | `/api/health` | Liveness + readiness probe |
| `GET` | `/:code` | Redirect to long URL |

### POST `/api/url/shorten`

```json
{
  "longUrl":    "https://www.example.com",      // required
  "customCode": "my-alias",                     // optional
  "expiresIn":  86400                           // optional, seconds
}
```

---

## Security

- **Rate limiting** — token bucket (10 req/IP burst, 1/s refill) backed by Redis Lua script
- **Helmet** — sets safe HTTP headers (X-Frame-Options, HSTS, etc.)
- **mongoSanitize** — strips `$` and `.` from request bodies to prevent NoSQL injection
- **Payload limit** — 10kb max request body
- **CORS** — configurable via `CORS_ORIGIN` env var (defaults to `*` for public API)
- **No secrets in code** — all credentials in environment variables

---

## Testing

```bash
# Run all tests (no Redis or MongoDB required)
npm test

# Tests cover:
# - URL creation
# - URL redirect
# - Invalid URL rejection
# - Custom alias
# - Duplicate alias rejection
# - Expired URL (410)
# - Rate limiting (429)
# - Stats endpoint
# - Delete + subsequent 404
# - Reserved alias rejection
```

---

## Load Testing

```bash
# Ensure the server is running first
npm start

# In another terminal
npm run benchmark
# or:
# node benchmarks/load-test.mjs --url=http://localhost:5000 --duration=30
```

**Scenarios:**
1. URL creation
2. Cached redirect (GET /:code)
3. Stats lookup
4. Recent URLs

> **Note:** Benchmark results in this README are intentionally omitted — they depend on your hardware, Redis availability, and MongoDB latency. Run the benchmark yourself and record actual numbers.

---

## Observability

```bash
# Health probe (JSON)
curl http://localhost:5000/api/health

# Response includes:
# - database: MongoDB Atlas | Resilient Local Storage
# - redis: connected | unavailable (fallback active)
# - redisPing: latency in ms
# - baseUrl: active public URL
```

Morgan access log printed to stdout:
```
GET /abc123 302 - 1.45 ms
POST /api/url/shorten 200 312 - 8.20 ms
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP server port |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL |
| `MONGO_URI` | (config file) | MongoDB connection string |
| `BASE_URL` | auto-detected | Public base URL for short links |
| `RATE_LIMIT_CAPACITY` | `10` | Max burst tokens per IP |
| `RATE_LIMIT_REFILL_RATE` | `1` | Token refill rate (per second) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

---

## Interview Concepts Demonstrated

| Concept | Where |
|---|---|
| Token bucket algorithm | `middleware/tokenBucket.js` |
| Distributed state via Redis | `middleware/tokenBucket.js`, `services/urlCache.js` |
| Lua scripting for atomic Redis ops | `middleware/tokenBucket.js` CONSUME_SCRIPT |
| Cache-aside pattern | `services/urlCache.js` + `routes/index.js` |
| Asynchronous processing post-response | `workers/analyticsWorker.js` |
| MongoDB indexing strategy | `models/Url.js` schema |
| Graceful shutdown | `index.js` SIGTERM/SIGINT handlers |
| Horizontal scalability | `docker-compose.yml` — 2 API instances + nginx |
| Fail-safe degradation | Redis/MongoDB fallbacks throughout |
| Security hardening | `index.js` — helmet, mongoSanitize, payload limits |
