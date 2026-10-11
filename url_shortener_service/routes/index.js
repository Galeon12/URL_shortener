import express from 'express';
const router = express.Router();

import Url from '../models/Url.js';

// @route     GET /:code
// @desc      Redirect to long/original URL and track clicks
router.get('/:code', async (req, res) => {
  const code = req.params.code;

  // Skip favicon or requests with file extensions
  if (!code || code === 'favicon.ico' || code.includes('.')) {
    return res.status(404).send('Not found');
  }

  try {
    const url = await Url.findOne({ urlCode: code });

    if (url) {
      // Increment clicks count
      try {
        await Url.updateOne({ urlCode: code }, { $inc: { clicks: 1 } });
      } catch (clickErr) {
        console.error('Click increment error:', clickErr.message);
      }
      return res.redirect(url.longUrl);
    } else {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
            .card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
            h1 { font-size: 2rem; margin-bottom: 8px; color: #f87171; }
            p { color: #94a3b8; font-size: 1rem; line-height: 1.5; margin-bottom: 24px; }
            a { display: inline-block; background: #6366f1; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; transition: 0.2s; }
            a:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>404</h1>
            <p>Oops! The shortened link code <strong>"${code}"</strong> was not found or has expired.</p>
            <a href="/">Return to Shortener</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json('Server error');
  }
});

export default router;
