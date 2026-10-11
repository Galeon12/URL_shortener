import express from 'express';
const router = express.Router();
import validUrl from 'valid-url';
import shortid from 'shortid';
import { getActiveBaseUrl } from '../config/baseUrl.js';
import Url from '../models/Url.js';
import tokenBucket, { getBucketStatus } from '../middleware/tokenBucket.js';

// Helper to ensure shortUrl matches the active base URL dynamically
function formatUrl(item, baseUrl) {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : { ...item };
  return {
    ...doc,
    shortUrl: `${baseUrl}/${doc.urlCode}`,
  };
}

// @route     GET /api/url/tokens
// @desc      Get current rate limit token status for the requester
router.get('/tokens', (req, res) => {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '127.0.0.1';
  const status = getBucketStatus(ip);
  res.json(status);
});

// @route     GET /api/url/recent
// @desc      Get recently shortened URLs
router.get('/recent', async (req, res) => {
  try {
    const baseUrl = getActiveBaseUrl(req);
    const urls = await Url.find().sort({ _id: -1 }).limit(20);
    res.json(urls.map((u) => formatUrl(u, baseUrl)));
  } catch (err) {
    console.error('Error fetching recent urls:', err.message);
    res.status(500).json({ error: 'Server error fetching recent URLs' });
  }
});

// @route     GET /api/url/stats/:code
// @desc      Get stats for a specific short URL
router.get('/stats/:code', async (req, res) => {
  try {
    const baseUrl = getActiveBaseUrl(req);
    const url = await Url.findOne({ urlCode: req.params.code });
    if (!url) {
      return res.status(404).json({ error: 'Short URL not found' });
    }
    res.json(formatUrl(url, baseUrl));
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route     DELETE /api/url/:code
// @desc      Delete a short URL
router.delete('/:code', async (req, res) => {
  try {
    const result = await Url.deleteOne({ urlCode: req.params.code });
    res.json({ message: 'URL removed', result });
  } catch (err) {
    console.error('Error deleting url:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route     POST /api/url/shorten
// @desc      Create short URL
router.post('/shorten', tokenBucket, async (req, res) => {
  let { longUrl, customCode } = req.body;
  const baseUrl = getActiveBaseUrl(req);

  // Prepend https:// if user omitted protocol
  if (longUrl && typeof longUrl === 'string') {
    longUrl = longUrl.trim();
    if (!/^https?:\/\//i.test(longUrl)) {
      longUrl = `https://${longUrl}`;
    }
  }

  // Check long url validity
  if (!longUrl || !validUrl.isUri(longUrl)) {
    return res.status(400).json({ error: 'Invalid URL. Please enter a valid URL (e.g., https://example.com)' });
  }

  try {
    // If a custom alias is requested
    if (customCode && typeof customCode === 'string') {
      const sanitizedCode = customCode.trim().replace(/[^a-zA-Z0-9-_]/g, '');
      if (sanitizedCode.length < 2 || sanitizedCode.length > 30) {
        return res.status(400).json({ error: 'Custom alias must be between 2 and 30 alphanumeric characters.' });
      }

      const existingCode = await Url.findOne({ urlCode: sanitizedCode });
      if (existingCode) {
        return res.status(409).json({ error: 'This custom alias is already taken. Please choose another.' });
      }

      const shortUrl = `${baseUrl}/${sanitizedCode}`;
      const url = new Url({
        longUrl,
        shortUrl,
        urlCode: sanitizedCode,
        clicks: 0,
        date: new Date().toISOString()
      });

      await url.save();
      return res.json(formatUrl(url, baseUrl));
    }

    // Default behavior: check if longUrl already exists
    let url = await Url.findOne({ longUrl });

    if (url) {
      return res.json(formatUrl(url, baseUrl));
    } else {
      const urlCode = shortid.generate();
      const shortUrl = `${baseUrl}/${urlCode}`;

      url = new Url({
        longUrl,
        shortUrl,
        urlCode,
        clicks: 0,
        date: new Date().toISOString()
      });

      await url.save();
      return res.json(formatUrl(url, baseUrl));
    }
  } catch (err) {
    console.error('Error shortening URL:', err);
    res.status(500).json({ error: 'Server error while generating short URL' });
  }
});

export default router;
