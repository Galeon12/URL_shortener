/**
 * Application entry point (Phase 7, 9, 4)
 *
 * Security stack:
 *   - helmet           — safe HTTP headers
 *   - CORS             — configured origin policy
 *   - body size limit  — prevent payload attacks
 *   - morgan           — structured HTTP access logging
 *   - express-mongo-sanitize — strips $ and . from user input
 *
 * Observability:
 *   - /api/health      — liveness + readiness probe
 *   - morgan request log
 *   - request duration header (X-Response-Time)
 *
 * Graceful shutdown:
 *   - SIGTERM / SIGINT drain in-flight requests before exiting
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB, { getDBStatus } from './config/db.js';
import { getActiveBaseUrl } from './config/baseUrl.js';
import { getRedisClient, isRedisReady } from './config/redis.js';
import indexRoutes from './routes/index.js';
import urlRoutes from './routes/url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disabled so the frontend SPA can load inline scripts
}));

// Trust reverse proxies (Cloudflare Tunnel, nginx, etc.) for correct IP detection
app.enable('trust proxy');

// ── Structured HTTP logging (Phase 9) ─────────────────────────────────────────
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// ── Request timing header ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const send = res.send;
  res.send = function (...args) {
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${Date.now() - start}ms`);
    }
    return send.apply(this, args);
  };
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Body parsing with payload limit (Phase 7) ─────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── MongoDB query injection protection (Phase 7) ──────────────────────────────
app.use(mongoSanitize());

// ── Static frontend assets ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check endpoint (Phase 9) ──────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const baseUrl = getActiveBaseUrl(req);
  const dbStatus = getDBStatus() ? 'MongoDB Atlas' : 'Resilient Local Storage';
  const redisStatus = isRedisReady() ? 'connected' : 'unavailable (fallback active)';

  // Optionally ping Redis for a live check
  let redisPing = null;
  if (isRedisReady()) {
    try {
      const start = Date.now();
      await getRedisClient().ping();
      redisPing = `${Date.now() - start}ms`;
    } catch (_) {
      redisPing = 'error';
    }
  }

  res.json({
    status: 'online',
    database: dbStatus,
    redis: redisStatus,
    redisPing,
    baseUrl,
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/url', urlRoutes);

// ── Redirect / short-code routes ──────────────────────────────────────────────
app.use('/', indexRoutes);

// ── Centralized error handler (Phase 10) ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
connectDB();

// Warm up Redis connection (non-blocking)
getRedisClient();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`URL Shortener Service running on port ${PORT}`);
  console.log(`Frontend accessible at: http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
});

// ── Graceful shutdown (Phase 4) ───────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n[Shutdown] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log('[Shutdown] HTTP server closed. Exiting.');
    process.exit(0);
  });
  // Force exit after 10 seconds
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
