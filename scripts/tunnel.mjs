import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BIN_PATH = path.join(ROOT_DIR, 'bin', 'cloudflared.exe');
const TUNNEL_JSON_PATH = path.join(ROOT_DIR, 'url_shortener_service', 'data', 'tunnel.json');
const CONFIG_JSON_PATH = path.join(ROOT_DIR, 'url_shortener_service', 'config', 'default.json');

// Ensure data folder exists
const dataDir = path.dirname(TUNNEL_JSON_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Starting Cloudflare Quick Tunnel on http://localhost:5000...');

const child = spawn(BIN_PATH, ['tunnel', '--url', 'http://localhost:5000'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: false,
});

let tunnelFound = false;

function processOutput(data) {
  const text = data.toString();
  process.stdout.write(text);

  // Match https://*.trycloudflare.com
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelFound) {
    tunnelFound = true;
    const tunnelUrl = match[0];

    // Write to tunnel.json for real-time backend synchronization
    fs.writeFileSync(
      TUNNEL_JSON_PATH,
      JSON.stringify({ tunnelUrl, updatedAt: new Date().toISOString() }, null, 2)
    );

    // Also update config/default.json if possible
    try {
      if (fs.existsSync(CONFIG_JSON_PATH)) {
        const configData = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
        configData.baseUrl = tunnelUrl;
        fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(configData, null, 2));
      }
    } catch (e) {
      // Ignore
    }

    console.log('\n============================================================');
    console.log('🎉 PUBLIC TUNNEL CONNECTED:');
    console.log(`👉 ${tunnelUrl}`);
    console.log('All short links and QR codes will now use this domain automatically!');
    console.log('============================================================\n');
  }
}

child.stdout.on('data', processOutput);
child.stderr.on('data', processOutput);

child.on('close', (code) => {
  console.log(`Cloudflare tunnel exited with code ${code}`);
  try {
    if (fs.existsSync(TUNNEL_JSON_PATH)) {
      fs.unlinkSync(TUNNEL_JSON_PATH);
    }
  } catch (e) {}
  process.exit(code || 0);
});
