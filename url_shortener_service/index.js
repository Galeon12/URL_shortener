import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB, { getDBStatus } from './config/db.js';
import config from 'config';
import { getActiveBaseUrl } from './config/baseUrl.js';
import indexRoutes from './routes/index.js';
import urlRoutes from './routes/url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxies (Cloudflare Tunnel, ngrok, Render, etc.)
app.enable('trust proxy');

// Connect to database (with automatic resilient fallback)
connectDB();

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const baseUrl = getActiveBaseUrl(req);

  res.json({
    status: 'online',
    database: getDBStatus() ? 'MongoDB Atlas' : 'Resilient Local Storage',
    baseUrl,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/url', urlRoutes);

// Redirect / Code Routes
app.use('/', indexRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`URL Shortener Service running on port ${PORT}`);
  console.log(`Frontend accessible at: http://localhost:${PORT}`);
});
