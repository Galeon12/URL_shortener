# ⚡ Shorten — High-Performance Distributed URL Shortener & Analytics Platform

A production-grade, horizontally scalable distributed URL shortening and analytics platform engineered with **Node.js / Express**, **Redis (ioredis)**, **MongoDB Atlas**, **Nginx**, and a **React + Vite** dashboard styled with **Tailwind CSS** and **shadcn/ui** design tokens.

Designed around distributed systems fundamentals: **atomic Lua rate limiting**, **cache-aside Redis caching**, **non-blocking asynchronous click analytics**, **database indexing**, and **containerized multi-instance horizontal scaling**.

---

## 🏗️ System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │             Nginx (Port 80)                  │
                               │        Round-Robin Load Balancer             │
                               └─────────────┬────────────────┬───────────────┘
                                             │                │
                                ┌────────────▼───┐        ┌───▼────────────┐
                                │ API Instance 1 │        │ API Instance 2 │
                                │ (Node/Express) │        │ (Node/Express) │
                                └────────┬───────┘        └───┬────────────┘
                                         │                    │
                          ┌──────────────▼────────────────────▼──────────────┐
                          │               Redis 7 (ioredis)                  │
                          │  - Distributed rate limiting (Atomic Lua script) │
                          │  - URL cache-aside (24h default TTL / Expiry)    │
                          └─────────────────────┬────────────────────────────┘
                                                │ (Cache Miss Only)
                          ┌─────────────────────▼────────────────────────────┐
                          │            MongoDB Atlas / Persistent DB         │
                          │  - B-tree Unique Index on `urlCode`              │
                          │  - Sparse Index on `expiresAt`                   │
                          │  - Resilient local JSON storage fallback         │
                          └──────────────────────────────────────────────────┘

                            Asynchronous Telemetry (Post-Redirect Pipeline):
                          ┌──────────────────────────────────────────────────┐
                          │  302 Redirect Sent -> setImmediate Queue Drain    │
                          │  -> Device / Referrer parsing -> MongoDB update  │
                          └──────────────────────────────────────────────────┘
```

---

## 🌟 Key Engineering Highlights (Portfolio & Resume Focus)

- **Distributed Rate Limiting (Atomic Token Bucket via Redis Lua):**
  Uses a custom server-side Lua script executed inside Redis to atomically calculate token refills and consume tokens without concurrency race conditions across scaled API instances. Features seamless in-process token-bucket fallback if Redis is temporarily unreachable.
- **Sub-Millisecond Redirects via Cache-Aside:**
  Frequently accessed short links resolve directly from Redis memory in under ~1ms. Database reads occur strictly on cache misses and automatically warm the cache with an expiration-aware TTL.
- **Zero-Latency Telemetry (Non-Blocking Async Pipeline):**
  Analytics extraction (device fingerprinting, referrer extraction, and click incrementing) is detached from the critical redirect path using `setImmediate()`. The `302 Found` HTTP response is returned immediately before analytics are written to disk.
- **Fail-Safe Resilient Architecture:**
  Engineered to tolerate infrastructure outages without disruption: falls back from MongoDB Atlas to a persistent local JSON store, and from Redis to in-process memory buckets without compromising security.
- **Horizontal Scaling & Load Balancing:**
  Stateless API nodes orchestrated via Docker Compose behind an Nginx reverse proxy load balancer, fully configured for container health checks, network isolation, and graceful shutdown (`SIGTERM`/`SIGINT`).
- **Comprehensive Security & Sanitation:**
  Hardened with `helmet` HTTP headers, `express-mongo-sanitize` against NoSQL injection, 10KB body payload limiting, strict URI validation, and CORS controls.

---

## 🧭 Request Lifecycles

### 1. Redirect Request (`GET /:code`)
1. Extract `urlCode` parameter.
2. **Redis Cache Lookup (`url:<urlCode>`)**:
   - **Cache Hit**: Instant extraction of target URL.
   - **Cache Miss**: Query MongoDB using unique B-tree index on `urlCode` $\rightarrow$ Populate Redis with calculated TTL.
3. Check `expiresAt` timestamp $\rightarrow$ return `410 Gone` if link has expired.
4. **Issue `302 Found` HTTP redirect immediately.**
5. **Post-Response Telemetry**: Fire-and-forget `setImmediate` enqueues click event with timestamp, device category (`desktop`, `mobile`, `bot`), and referrer.

### 2. URL Shortening (`POST /api/url/shorten`)
1. Rate limit check via distributed token bucket (10 burst capacity, 1 req/sec refill).
2. Validate destination URI schema and optional custom alias / expiration parameters.
3. Check for collisions or reserved system keywords (`api`, `health`, `stats`, etc.).
4. Persist to MongoDB source-of-truth.
5. Pre-warm Redis cache key for instant follow-up reads.
6. Return formatted record with short URL and live metadata.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Cache / Rate Limit |
|:---|:---|:---|:---|
| `POST` | `/api/url/shorten` | Shorten a URL (with custom slug & expiration) | Token Bucket Rate Limited |
| `GET` | `/:code` | Redirect to destination URL | Redis Cache-Aside (~1ms) |
| `GET` | `/api/url/stats/:code` | Get detailed telemetry, device split & click log | Direct Query |
| `GET` | `/api/url/recent` | List 20 most recent shortened URLs | Direct Query |
| `GET` | `/api/url/tokens` | Get live caller rate-limit token telemetry | In-Memory / Redis Status |
| `DELETE`| `/api/url/:code` | Delete URL and evict from Redis cache | Cache Eviction (`DEL`) |
| `GET` | `/api/health` | Liveness & readiness probe (probes DB & Redis) | Real-Time Ping |

### Example Payload: Create Short URL
```http
POST /api/url/shorten
Content-Type: application/json

{
  "longUrl": "https://github.com/torvalds/linux",
  "customCode": "linux-kernel",
  "expiresIn": 86400
}
```

### Example Response:
```json
{
  "_id": "6612d9b2e8a1",
  "urlCode": "linux-kernel",
  "longUrl": "https://github.com/torvalds/linux",
  "shortUrl": "http://localhost:5000/linux-kernel",
  "clicks": 0,
  "date": "2026-10-11T17:30:00.000Z",
  "expiresAt": "2026-10-12T17:30:00.000Z"
}
```

---

## 🧠 System Design & Engineering Tradeoffs

### 1. Redis vs. MongoDB Responsibilities
* **MongoDB is the persistent source of truth.** All links, creation timestamps, and click history reside here permanently.
* **Redis acts as a disposable read-through cache.** If Redis restarts or is flushed, all records can be lazily repopulated from MongoDB on demand with zero data loss.

### 2. Cache-Aside vs. Write-Through
* **Decision:** We use Cache-Aside (Lazy Population).
* **Rationale:** A significant percentage of generated short URLs receive little to no subsequent traffic. Write-through would waste valuable Redis memory storing links that may never be visited. Cache-aside ensures Redis memory is reserved strictly for hot links.

### 3. Distributed vs. In-Process Rate Limiting
* **Decision:** Redis Lua Script with In-Process Fail-Safe Fallback.
* **Rationale:** In a multi-node cluster, purely local in-memory token buckets cannot share state; a client hitting different instances via a round-robin load balancer would get $N \times \text{capacity}$ tokens. Storing the bucket in Redis solves this. However, if Redis goes down, rather than disabling security completely, each node gracefully falls back to a local in-memory bucket.

### 4. Synchronous vs. Asynchronous Analytics
* **Decision:** Asynchronous Post-Response Processing (`setImmediate`).
* **Rationale:** Performing synchronous writes to update click counts on every redirect adds significant I/O latency to the user experience. By offloading analytics past the response boundary, redirects are instantaneous while click statistics remain accurate.

---

## 🚀 Quick Start

### 1. Run with Docker Compose (Recommended)

Starts the entire distributed topology (Nginx load balancer + 2 API instances + Redis 7 + MongoDB 7):

```bash
docker compose up --build
```
* **Nginx Load Balancer:** `http://localhost:80`
* **Redis Instance:** `localhost:6379`
* **MongoDB Instance:** `localhost:27017`

Verify cluster health:
```bash
docker compose ps
curl http://localhost/api/health
```

---

### 2. Run Locally Without Docker

#### Prerequisites
- Node.js v18+ & npm v9+

#### Installation & Startup
```bash
# 1. Install dependencies
cd url_shortener_service && npm install
cd ../frontend && npm install
cd ..

# 2. Start services (in separate terminals)
# Terminal 1: Backend API (Port 5000)
npm run backend

# Terminal 2: React Dashboard (Port 5173)
npm run frontend

# Terminal 3 (Optional): Cloudflare Public Tunnel
npm run tunnel
```

Open **`http://localhost:5173`** to access the dashboard.

---

## 🧪 Testing & Verification

### Unit & Integration Test Suite
Comprehensive automated test suite powered by `vitest` covering URL shortening, duplicate alias handling, custom slug validation, cache hits, rate limiting, and 410 expiration:

```bash
npm test
```
```
 ✓ tests/url.test.js (11 tests)
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

---

## ⚡ Load Testing & Benchmarks

The project includes an automated benchmarking suite built with `autocannon`:

```bash
# Start backend first (npm run backend), then in another terminal:
npm run benchmark
# Or with custom concurrency:
node url_shortener_service/benchmarks/load-test.mjs --url=http://localhost:5000 --duration=15
```

Scenarios evaluated:
1. **URL Creation:** Measures write latency and deduplication under load.
2. **Cached Redirects:** Evaluates sub-millisecond Redis cache hits at high concurrency.
3. **Telemetry & Stats Lookups:** Measures read performance of analytics endpoints.

---

## 📂 Repository Structure

```
URL_Shortener/
├── docker-compose.yml           # Production multi-node deployment
├── nginx.conf                   # Nginx round-robin load balancer config
├── package.json                 # Monorepo root script orchestrator
│
├── frontend/                    # Modern React 19 + Vite Dashboard
│   ├── src/
│   │   ├── components/          # HeroShortenForm, UrlList, AnalyticsModal, Navbar...
│   │   ├── services/api.js      # REST API client
│   │   └── App.jsx              # Telemetry & main view
│   └── vite.config.js
│
├── url_shortener_service/       # Express Backend Service
│   ├── benchmarks/              # autocannon reproducible load testing
│   ├── config/                  # Redis (ioredis), MongoDB, and BaseUrl configs
│   ├── middleware/              # Atomic Redis Lua token bucket rate limiter
│   ├── models/                  # Mongoose Url schema with indexing & fallback
│   ├── routes/                  # Redirects (/:code) and CRUD (/api/url/*)
│   ├── services/                # Cache-aside URL cache service (urlCache.js)
│   ├── workers/                 # Async post-redirect telemetry worker
│   ├── tests/                   # Vitest automated test suite
│   ├── Dockerfile               # API instance container definition
│   └── index.js                 # Server entry point with security middleware
```

---

## 🛡️ License

ISC License &copy; 2026 Chandan Saraswat
