/**
 * URL API routes (Phase 2, 7)
 *
 * POST /api/url/shorten   — create a shortened URL
 * GET  /api/url/recent    — list recently created URLs
 * GET  /api/url/stats/:code — get stats for a short code
 * GET  /api/url/tokens    — get current rate-limit status for caller
 * DELETE /api/url/:code   — delete a URL and invalidate its cache entry
 */
import express from 'express';
import validUrl from 'valid-url';
import shortid from 'shortid';
import { getActiveBaseUrl } from '../config/baseUrl.js';
import Url from '../models/Url.js';
import tokenBucket, { getBucketStatus } from '../middleware/tokenBucket.js';
import { setCachedUrl, invalidateCachedUrl } from '../services/urlCache.js';

const router = express.Router();

// Reserved codes that cannot be used as custom aliases
const RESERVED_CODES = new Set([
  'api', 'health', 'admin', 'static', 'public', 'favicon.ico',
  'shorten', 'recent', 'stats', 'tokens',
]);

/** Serialize a Url document/record to a plain object with a live shortUrl. */
function formatUrl(item, baseUrl) {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : { ...item };
  return {
    ...doc,
    shortUrl: `${baseUrl}/${doc.urlCode}`,
    // Omit internal clickLog from list responses for brevity
    clickLog: undefined,
  };
}

// ── GET /api/url/tokens ───────────────────────────────────────────────────────
router.get('/tokens', (req, res) => {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '127.0.0.1';
  res.json(getBucketStatus(ip));
});

// ── GET /api/url/recent ───────────────────────────────────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const baseUrl = getActiveBaseUrl(req);
    const urls = await Url.find().sort({ _id: -1 }).limit(20);
    res.json(urls.map((u) => formatUrl(u, baseUrl)));
  } catch (err) {
    console.error('[URL] Error fetching recent urls:', err.message);
    res.status(500).json({ error: 'Server error fetching recent URLs' });
  }
});

// ── GET /api/url/stats/:code ──────────────────────────────────────────────────
router.get('/stats/:code', async (req, res) => {
  try {
    const baseUrl = getActiveBaseUrl(req);
    const url = await Url.findOne({ urlCode: req.params.code });
    if (!url) return res.status(404).json({ error: 'Short URL not found' });

    const doc = url.toObject ? url.toObject() : { ...url };
    res.json({
      ...doc,
      shortUrl: `${baseUrl}/${doc.urlCode}`,
    });
  } catch (err) {
    console.error('[URL] Error fetching stats:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/url/:code ─────────────────────────────────────────────────────
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await Url.deleteOne({ urlCode: code });
    // Invalidate cache so stale entry is not served (Phase 1)
    await invalidateCachedUrl(code);
    res.json({ message: 'URL removed', result });
  } catch (err) {
    console.error('[URL] Error deleting url:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/url/shorten ─────────────────────────────────────────────────────
router.post('/shorten', tokenBucket, async (req, res) => {
  let { longUrl, customCode, expiresIn } = req.body;
  const baseUrl = getActiveBaseUrl(req);

  // ── Input validation (Phase 2 & 7) ─────────────────────────────────────────

  if (!longUrl || typeof longUrl !== 'string') {
    return res.status(400).json({ error: 'longUrl is required and must be a string.' });
  }
  longUrl = longUrl.trim();
  if (!/^https?:\/\//i.test(longUrl)) longUrl = `https://${longUrl}`;

  if (!validUrl.isUri(longUrl)) {
    return res.status(400).json({
      error: 'Invalid URL. Please enter a valid URL (e.g., https://example.com)',
    });
  }

  // Optional expiration — expiresIn is seconds from now
  let expiresAt = null;
  if (expiresIn !== undefined) {
    const seconds = parseInt(expiresIn, 10);
    if (isNaN(seconds) || seconds <= 0) {
      return res.status(400).json({ error: 'expiresIn must be a positive integer (seconds).' });
    }
    expiresAt = new Date(Date.now() + seconds * 1000);
  }

  try {
    // ── Custom alias path ───────────────────────────────────────────────────
    if (customCode && typeof customCode === 'string') {
      const sanitizedCode = customCode.trim().replace(/[^a-zA-Z0-9-_]/g, '');

      if (sanitizedCode.length < 2 || sanitizedCode.length > 30) {
        return res.status(400).json({
          error: 'Custom alias must be 2–30 alphanumeric characters (hyphens and underscores allowed).',
        });
      }
      if (RESERVED_CODES.has(sanitizedCode.toLowerCase())) {
        return res.status(400).json({ error: `"${sanitizedCode}" is a reserved word and cannot be used as an alias.` });
      }

      const existing = await Url.findOne({ urlCode: sanitizedCode });
      if (existing) {
        return res.status(409).json({ error: 'This custom alias is already taken. Please choose another.' });
      }

      const shortUrl = `${baseUrl}/${sanitizedCode}`;
      const url = new Url({ longUrl, shortUrl, urlCode: sanitizedCode, clicks: 0, date: new Date().toISOString(), expiresAt });
      await url.save();

      const record = url.toObject ? url.toObject() : { ...url };
      await setCachedUrl(sanitizedCode, record);
      return res.json(formatUrl(url, baseUrl));
    }

    // ── Default path: deduplicate by longUrl ────────────────────────────────
    let url = await Url.findOne({ longUrl });
    if (url) {
      return res.json(formatUrl(url, baseUrl));
    }

    const urlCode = shortid.generate();
    const shortUrl = `${baseUrl}/${urlCode}`;
    url = new Url({ longUrl, shortUrl, urlCode, clicks: 0, date: new Date().toISOString(), expiresAt });
    await url.save();

    const record = url.toObject ? url.toObject() : { ...url };
    await setCachedUrl(urlCode, record);
    return res.json(formatUrl(url, baseUrl));

  } catch (err) {
    console.error('[URL] Error shortening URL:', err);
    res.status(500).json({ error: 'Server error while generating short URL' });
  }
});

export default router;
