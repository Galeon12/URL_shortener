/**
 * Redirect route (Phase 1, 2, 3)
 *
 * Request flow:
 *   1. Redis cache lookup
 *   2. Cache hit  → 302 redirect immediately → enqueue analytics (async)
 *   3. Cache miss → MongoDB lookup → populate Redis → 302 redirect → enqueue analytics
 *   4. Expired URL → 410 Gone
 *   5. Not found  → 404
 */
import express from 'express';
import Url from '../models/Url.js';
import { getCachedUrl, setCachedUrl } from '../services/urlCache.js';
import { enqueueClickEvent } from '../workers/analyticsWorker.js';

const router = express.Router();

const NOT_FOUND_HTML = (code) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Link Not Found</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:system-ui,sans-serif;background:#0b0f19;color:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
    .card{background:rgba(30,41,59,.7);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:40px;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,.4)}
    h1{font-size:2rem;margin-bottom:8px;color:#f87171}
    p{color:#94a3b8;font-size:1rem;line-height:1.5;margin-bottom:24px}
    a{display:inline-block;background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:500}
    a:hover{background:#4f46e5}
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>The shortened link <strong>"${code}"</strong> was not found or has expired.</p>
    <a href="/">Return to Shortener</a>
  </div>
</body>
</html>`;

// @route   GET /:code
// @desc    Redirect to long URL
router.get('/:code', async (req, res) => {
  const code = req.params.code;

  // Skip requests that are clearly not short codes
  if (!code || code === 'favicon.ico' || code.includes('.')) {
    return res.status(404).send('Not found');
  }

  try {
    // 1. Cache-aside: try Redis first
    let record = await getCachedUrl(code);

    if (!record) {
      // 2. Cache miss: query MongoDB/fallback
      const urlDoc = await Url.findOne({ urlCode: code });
      if (!urlDoc) {
        return res.status(404).send(NOT_FOUND_HTML(code));
      }
      record = urlDoc.toObject ? urlDoc.toObject() : { ...urlDoc };
      // Populate cache for future requests
      await setCachedUrl(code, record);
    }

    // 3. Check expiration (Phase 2)
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return res.status(410).send(NOT_FOUND_HTML(code));
    }

    // 4. Redirect immediately — analytics happen after response
    res.redirect(record.longUrl);

    // 5. Async analytics — fire and forget (Phase 3)
    enqueueClickEvent(req, code);

  } catch (err) {
    console.error('[Redirect] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
