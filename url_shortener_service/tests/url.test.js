/**
 * Integration tests (Phase 8)
 *
 * Uses supertest to drive the real Express app against the fallback
 * local-storage backend (no MongoDB or Redis required).
 *
 * Run:  npx vitest run
 *   or: npm test
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ─── Minimal test app (no real DB/Redis deps) ────────────────────────────────
// Mock Redis so tests don't need a Redis server
vi.mock('../config/redis.js', () => ({
  getRedisClient: () => null,
  isRedisReady: () => false,
}));

// Clear fallback storage before tests
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'urls.json');

function clearStorage() {
  try { fs.writeFileSync(DATA_FILE, '[]'); } catch (_) {}
}

// Build a minimal Express app mirroring index.js
import mongoSanitize from 'express-mongo-sanitize';
import urlRoutes from '../routes/url.js';
import indexRoutes from '../routes/index.js';

const app = express();
app.enable('trust proxy');
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use('/api/url', urlRoutes);
app.use('/', indexRoutes);

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('URL Shortener API', () => {
  beforeAll(() => clearStorage());
  afterAll(() => clearStorage());

  let shortCode = '';

  // 1. URL creation
  it('POST /api/url/shorten — creates a short URL', async () => {
    const res = await request(app)
      .post('/api/url/shorten')
      .send({ longUrl: 'https://www.example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('urlCode');
    expect(res.body).toHaveProperty('shortUrl');
    shortCode = res.body.urlCode;
  });

  // 2. URL redirect
  it('GET /:code — redirects to long URL', async () => {
    const res = await request(app).get(`/${shortCode}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://www.example.com');
  });

  // 3. Invalid URL
  it('POST /api/url/shorten — rejects invalid URL', async () => {
    const res = await request(app)
      .post('/api/url/shorten')
      .send({ longUrl: 'not a valid url at all !@#' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // 4. Custom alias
  it('POST /api/url/shorten — accepts custom alias', async () => {
    const res = await request(app)
      .post('/api/url/shorten')
      .send({ longUrl: 'https://www.google.com', customCode: 'my-google' });
    expect(res.status).toBe(200);
    expect(res.body.urlCode).toBe('my-google');
  });

  // 5. Duplicate alias
  it('POST /api/url/shorten — rejects duplicate alias', async () => {
    const res = await request(app)
      .post('/api/url/shorten')
      .send({ longUrl: 'https://www.bing.com', customCode: 'my-google' });
    expect(res.status).toBe(409);
  });

  // 6. Expired URL
  it('GET /:code — returns 410 for expired URL', async () => {
    // Create URL that expired 1 second in the past
    const createRes = await request(app)
      .post('/api/url/shorten')
      .send({ longUrl: 'https://www.expired-test.com', customCode: 'exptest', expiresIn: 1 });
    expect(createRes.status).toBe(200);

    // Manually backdate the expiry in storage
    const records = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const idx = records.findIndex(r => r.urlCode === 'exptest');
    records[idx].expiresAt = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));

    const res = await request(app).get('/exptest');
    expect(res.status).toBe(410);
  });

  // 7. Rate limiting — exhaust tokens
  it('POST /api/url/shorten — returns 429 after exceeding rate limit', async () => {
    // Use a dedicated IP via x-forwarded-for to isolate this test
    const agent = request(app);
    let lastStatus = 200;
    for (let i = 0; i < 15; i++) {
      const r = await agent
        .post('/api/url/shorten')
        .set('X-Forwarded-For', '203.0.113.99')
        .send({ longUrl: `https://rate-test-${i}.example.com` });
      lastStatus = r.status;
      if (r.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  // 8. Stats endpoint
  it('GET /api/url/stats/:code — returns click stats', async () => {
    const res = await request(app).get(`/api/url/stats/${shortCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('urlCode', shortCode);
    expect(res.body).toHaveProperty('clicks');
  });

  // 9. Recent URLs
  it('GET /api/url/recent — returns array of URLs', async () => {
    const res = await request(app).get('/api/url/recent');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // 10. Delete URL
  it('DELETE /api/url/:code — removes the URL', async () => {
    const res = await request(app).delete(`/api/url/${shortCode}`);
    expect(res.status).toBe(200);
    // Subsequent redirect should 404
    const redirectRes = await request(app).get(`/${shortCode}`);
    expect(redirectRes.status).toBe(404);
  });

  // 11. Reserved alias
  it('POST /api/url/shorten — rejects reserved alias', async () => {
    const res = await request(app)
      .post('/api/url/shorten')
      .send({ longUrl: 'https://www.test.com', customCode: 'api' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reserved/i);
  });
});
