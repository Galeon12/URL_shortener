# ⚡ URL Shortener Backend API

High-performance Express API for URL shortening, 302 redirects, and analytics tracking with in-memory token bucket rate limiting and resilient MongoDB / local storage fallback.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
# Copy config/default.json.example to config/default.json and fill in your MongoDB connection URI (optional)

# 3. Start development server
npm start
```

## 📡 Endpoints

- `POST /api/url/shorten` — Shortens a URL (accepts `{ "longUrl": "...", "customCode": "..." }`)
- `GET /api/url/recent` — Fetches recently shortened URLs with click statistics
- `GET /api/url/stats/:code` — Fetches statistics for a specific short URL
- `GET /api/url/tokens` — Live token bucket rate limit status
- `GET /api/health` — System status and active base URL
- `GET /:code` — Redirects to the long destination URL and increments click counter

## 🛡️ Architecture
- **Mongoose 8** with native ES modules
- **Token Bucket** algorithm for smooth rate limiting
- **Resilient Fallback** to local JSON persistence if MongoDB Atlas is unreachable
