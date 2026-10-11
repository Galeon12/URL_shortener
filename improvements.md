You are an expert backend/distributed-systems engineer.

I have an existing URL Shortener project built with:
- Node.js
- Express.js
- MongoDB
- Token-bucket rate limiting
- Custom alphanumeric short-code generation

The project already supports URL shortening and redirects. DO NOT rewrite the project from scratch.

First inspect the entire repository:
1. Understand the current architecture.
2. Identify the existing API routes, models, middleware, rate limiter, database logic, configuration, and tests.
3. Identify what is already implemented so you do not duplicate functionality.
4. Preserve all existing working functionality and API compatibility unless a change is genuinely required.

GOAL:
Upgrade this into a polished, production-style backend/distributed-systems project suitable for a Software Engineer portfolio targeting Cisco, FAANG, and strong backend roles.

==================================================
PHASE 1 — REDIS INFRASTRUCTURE
==================================================

Add Redis cleanly without breaking the existing MongoDB architecture.

Use Redis for:

1. Distributed rate limiting
   - Replace/extend the current in-memory token-bucket implementation with a Redis-backed implementation.
   - Rate-limit state must be shared across multiple Node.js instances.
   - Keep configurable:
     - requests/tokens
     - refill rate
     - burst capacity
     - per-IP limits
   - Fail safely if Redis becomes temporarily unavailable.
   - Do NOT silently disable security if Redis fails.

2. URL caching
   - On GET /:shortCode:
       Redis cache lookup
       -> cache hit: redirect immediately
       -> cache miss: MongoDB lookup
       -> populate Redis
       -> redirect
   - Use sensible TTLs.
   - Handle cache misses and expired URLs correctly.
   - Prevent stale URLs from remaining accessible after expiration/deletion.

Create clean Redis abstraction/services rather than scattering Redis calls throughout controllers.

==================================================
PHASE 2 — URL FEATURES
==================================================

Add:

1. URL expiration
   - Optional expiration timestamp.
   - Expired URLs must not redirect.
   - Use Redis TTL where appropriate.
   - Ensure MongoDB remains the source of truth.

2. Custom aliases
   - Allow users to optionally specify a custom short code.
   - Validate aliases.
   - Prevent collisions with existing codes.
   - Prevent reserved/system routes from being used as aliases.

3. Strong input validation
   - Validate URLs.
   - Validate short codes.
   - Validate request bodies.
   - Add reasonable payload limits.

==================================================
PHASE 3 — ASYNCHRONOUS ANALYTICS
==================================================

Add click analytics without making redirects unnecessarily slow.

The redirect path should be:

Request
  -> Redis/MongoDB lookup
  -> 302 redirect
  -> asynchronous analytics processing

Track useful non-sensitive analytics such as:
- timestamp
- short code
- user-agent
- referrer when available
- basic device classification if practical

Do NOT perform expensive analytics/database operations synchronously before returning the redirect.

If a queue/message mechanism is needed, use a lightweight architecture appropriate for this project rather than overengineering it.

==================================================
PHASE 4 — PERFORMANCE
==================================================

Optimize the system for realistic backend workloads.

1. MongoDB
   - Add appropriate indexes.
   - Avoid unnecessary queries.
   - Use projections where useful.
   - Review query patterns and connection pooling.

2. Redis
   - Cache frequently accessed short URLs.
   - Avoid unnecessary Redis calls.
   - Use appropriate TTLs.

3. Node.js
   - Keep API instances stateless.
   - Avoid blocking operations in request handlers.
   - Handle graceful shutdown correctly.

Do NOT claim performance improvements without measuring them.

==================================================
PHASE 5 — LOAD TESTING
==================================================

Add a proper load-testing setup using a suitable tool such as k6 or autocannon.

Create reproducible tests for:
- URL creation
- URL redirects
- cached redirects
- uncached redirects
- rate-limited requests
- concurrent requests

Measure:
- requests/sec
- average latency
- p95 latency
- p99 latency
- error rate

Create a README section explaining exactly how to run the benchmarks.

IMPORTANT:
Never fabricate benchmark numbers.

Run the tests locally if possible and report the actual results.
If the environment prevents running them, create the benchmark scripts and clearly mark expected metrics as "not yet measured".

==================================================
PHASE 6 — HORIZONTAL SCALING
==================================================

Make the API horizontally scalable.

Create Docker Compose infrastructure containing approximately:

- API instance 1
- API instance 2
- Redis
- MongoDB

If practical, add a lightweight reverse proxy/load balancer.

The API instances should be stateless.

Verify that:
- rate limiting works across instances
- URL cache works across instances
- redirects work correctly
- no in-memory state is required for correctness

==================================================
PHASE 7 — SECURITY
==================================================

Harden the API appropriately.

Implement:
- rate limiting
- request validation
- safe HTTP headers
- CORS configuration
- payload size limits
- MongoDB query/input sanitization
- protection against obvious abuse cases
- secure environment-variable handling
- no secrets committed to Git

Review the implementation for common Node.js/Express security issues.

Do not add unnecessary security mechanisms just for resume keywords.

==================================================
PHASE 8 — TESTING
==================================================

Add meaningful automated tests.

At minimum cover:

1. URL creation
2. URL redirect
3. invalid URL
4. custom alias
5. duplicate alias
6. expired URL
7. rate limiting
8. cache hit
9. cache miss
10. analytics behavior
11. authentication/authorization if authentication already exists

Use a proper testing framework appropriate for the existing stack.

Tests should be deterministic and easy to run.

==================================================
PHASE 9 — OBSERVABILITY
==================================================

Add lightweight production-style observability.

Include:
- structured logging
- request duration
- HTTP status
- error logging
- health endpoint such as /health
- Redis/MongoDB health checks

Do not introduce a huge monitoring stack unless it is actually useful.

==================================================
PHASE 10 — CODE QUALITY
==================================================

Refactor where necessary while preserving functionality.

Use a clean structure such as:

src/
  controllers/
  routes/
  services/
  models/
  middleware/
  config/
  utils/
  workers/
  tests/

Follow:
- separation of concerns
- async/await
- centralized error handling
- environment-based configuration
- meaningful naming
- no duplicated logic
- no unnecessary abstractions

Add comments only where the design is non-obvious.

==================================================
PHASE 11 — DOCUMENTATION
==================================================

Rewrite the README so it clearly explains:

1. What the project does
2. Architecture
3. Request flow
4. Redis caching strategy
5. Distributed rate limiting
6. MongoDB schema/indexes
7. URL expiration
8. Async analytics
9. Horizontal scaling
10. Security considerations
11. Local setup
12. Docker setup
13. API endpoints
14. Testing
15. Load testing
16. Actual benchmark results

Include an ASCII architecture diagram.

Also explain important engineering tradeoffs, especially:
- Redis vs MongoDB responsibilities
- cache-aside strategy
- distributed vs in-memory rate limiting
- synchronous vs asynchronous analytics
- horizontal scaling

==================================================
IMPORTANT ENGINEERING RULES
==================================================

1. DO NOT rewrite the entire application unnecessarily.
2. Inspect the existing implementation before modifying anything.
3. Preserve existing functionality.
4. Do not introduce technologies simply to make the project look impressive.
5. Do not fabricate performance numbers.
6. Do not fabricate user counts or production usage.
7. Prefer measurable engineering improvements.
8. Keep the implementation understandable enough that I can explain every part in a technical interview.
9. Avoid overengineering.
10. Run existing tests after every major phase.
11. Fix regressions before continuing.
12. Keep secrets out of source control.
13. Update .env.example whenever new environment variables are introduced.
14. Use Docker Compose so the complete system can be started locally.
15. At the end, provide:
    - files changed
    - features implemented
    - tests added
    - benchmark commands
    - actual benchmark results
    - remaining TODOs
    - important interview concepts demonstrated

FINAL QUALITY BAR:

The finished project should feel like a deliberately engineered backend system, not a collection of random features.

The most important portfolio characteristics are:

- distributed rate limiting
- Redis caching
- low-latency redirects
- asynchronous analytics
- MongoDB indexing
- horizontal scalability
- load testing
- security
- Dockerized infrastructure
- clean architecture
- reproducible benchmarks

Start by inspecting the repository and producing a concise implementation plan. Then implement the changes incrementally, testing after each major phase.