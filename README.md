# ⚡ Shorten — High-Performance URL Shortener & Analytics

A modern, production-grade full-stack URL shortening service and analytics dashboard. Built with **Express**, **MongoDB** (with resilient local storage fallback), and a sleek **React + Vite** client styled with **Tailwind CSS** and **shadcn/ui** design tokens.

---

## ✨ Features

- **Linear / Vercel Aesthetic**: Restrained neutral palette, crisp 1px borders, subtle micro-interactions, and dark/light mode toggle.
- **Token Bucket Rate Limiting**: Protects your endpoints against abuse using an in-memory token bucket algorithm with live UI telemetry.
- **Resilient Storage Architecture**: Automatically connects to MongoDB Atlas and gracefully falls back to local persistent JSON storage if offline or IP-restricted.
- **Instant Global Access**: Built-in Cloudflare Tunnel integration (`npm run tunnel`) that exposes short links to the internet worldwide with zero configuration.
- **Real-Time Click Tracking**: Measures link visits on every 302 redirect.
- **Built-in QR Code Generator**: Generates high-contrast SVG QR codes with instant PNG download for easy sharing.
- **Custom Slugs**: Supports user-defined custom aliases with regex sanitization and collision checks.

---

## 🏗️ Project Architecture

```
URL_Shortener/
├── frontend/                   # Modern React + Vite Client
│   ├── src/
│   │   ├── components/         # Reusable UI & Dashboard components
│   │   │   ├── ui/             # shadcn/ui primitives (Button, Input, Card, Badge, Dialog...)
│   │   │   ├── HeroShortenForm.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── QrCodeModal.jsx
│   │   │   ├── RateLimitCard.jsx
│   │   │   └── UrlList.jsx
│   │   ├── services/api.js     # API client
│   │   ├── App.jsx             # Main dashboard
│   │   └── index.css           # Tailwind & CSS variable design tokens
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── url_shortener_service/      # Express API & Backend Service
│   ├── config/                 # Database & dynamic base URL configuration
│   ├── data/                   # Resilient persistent storage & tunnel sync
│   ├── middleware/             # Token bucket rate limiter
│   ├── models/                 # Mongoose model with fallback mock
│   ├── routes/                 # REST routes (/api/url and /:code redirects)
│   └── index.js                # Express server entry point
│
├── scripts/
│   └── tunnel.mjs              # Cloudflare Quick Tunnel auto-synchronizer
├── bin/                        # Cloudflare tunnel binary
└── package.json                # Monorepo root orchestrator scripts
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested and verified on Node.js v24)
- **npm**: v9+

### 2. Installation

Clone the repository and install dependencies:

```bash
# Install backend dependencies
cd url_shortener_service
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 3. Running Locally

You can run each service independently or in separate terminals from the project root:

```bash
# Terminal 1 — Start Express Backend (Port 5000)
npm run backend

# Terminal 2 — Start React Dashboard (Port 5173)
npm run frontend

# Terminal 3 (Optional) — Start Global Cloudflare Tunnel
npm run tunnel
```

Once started:
- Open **[http://localhost:5173](http://localhost:5173)** in your browser for the dashboard.
- Backend runs at **[http://localhost:5000](http://localhost:5000)**.

---

## 📡 REST API Reference

### 1. Shorten a URL
- **Endpoint**: `POST /api/url/shorten`
- **Rate Limit**: Consumes 1 token from bucket
- **Body**:
  ```json
  {
    "longUrl": "https://github.com",
    "customCode": "my-alias" // optional
  }
  ```
- **Response**:
  ```json
  {
    "_id": "loc_0gcng3v",
    "urlCode": "my-alias",
    "longUrl": "https://github.com",
    "shortUrl": "https://your-domain.com/my-alias",
    "clicks": 0,
    "date": "2026-10-11T05:32:40.729Z"
  }
  ```

### 2. Get Recent URLs
- **Endpoint**: `GET /api/url/recent`
- **Response**: Returns the 20 most recent links with click counters.

### 3. Rate Limit Telemetry
- **Endpoint**: `GET /api/url/tokens`
- **Response**: Current available tokens, bucket capacity, and refill interval.

### 4. Health Check
- **Endpoint**: `GET /api/health`
- **Response**: System status, database connection state, and active public base URL.

### 5. Redirect Short Link
- **Endpoint**: `GET /:code`
- **Behavior**: Increments visit counter and performs a `302 Found` redirect to the destination URL.

---

## 🛡️ License

ISC License &copy; 2026 Chandan Saraswat
