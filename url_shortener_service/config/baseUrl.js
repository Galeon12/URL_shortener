import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from 'config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TUNNEL_JSON_PATH = path.join(__dirname, '..', 'data', 'tunnel.json');

export function getActiveBaseUrl(req) {
  // 1. Check live tunnel.json (updated dynamically by tunnel process)
  try {
    if (fs.existsSync(TUNNEL_JSON_PATH)) {
      const data = JSON.parse(fs.readFileSync(TUNNEL_JSON_PATH, 'utf8'));
      if (data && data.tunnelUrl && !data.tunnelUrl.includes('localhost')) {
        return data.tunnelUrl.replace(/\/+$/, '');
      }
    }
  } catch (e) {
    // Ignore read errors
  }

  // 2. Check environment variable
  if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) {
    return process.env.BASE_URL.replace(/\/+$/, '');
  }

  // 3. Check proxy headers from request if coming through a tunnel or reverse proxy
  if (req && req.headers) {
    const forwardedHost = req.headers['x-forwarded-host'];
    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    if (forwardedHost && !forwardedHost.includes('localhost')) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }
  }

  // 4. Check config/default.json baseUrl (if set and not localhost)
  try {
    if (config.has('baseUrl')) {
      const cfgBase = config.get('baseUrl');
      if (cfgBase && !cfgBase.includes('localhost')) {
        return cfgBase.replace(/\/+$/, '');
      }
    }
  } catch (e) {
    // Ignore
  }

  // 5. Fallback to request host or default
  if (req && req.headers && req.headers.host) {
    const protocol = req.protocol || 'http';
    return `${protocol}://${req.headers.host}`.replace(/\/+$/, '');
  }

  return 'http://localhost:5000';
}
