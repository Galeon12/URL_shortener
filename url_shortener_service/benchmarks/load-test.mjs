/**
 * Load testing script (Phase 5) — autocannon
 *
 * Runs a suite of reproducible benchmark scenarios against the running server.
 *
 * Usage:
 *   node benchmarks/load-test.mjs [--url http://localhost:5000] [--duration 15]
 *
 * Requirements:
 *   npm install -D autocannon
 *   Server must be running before executing this script.
 *
 * Metrics reported:
 *   - req/sec (avg, min, max)
 *   - latency avg, p50, p75, p95, p99 (ms)
 *   - error rate
 *   - throughput (bytes/sec)
 */
import autocannon from 'autocannon';

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:5000';
const DURATION  = parseInt(process.argv.find(a => a.startsWith('--duration='))?.split('=')[1] || '15', 10);
const PIPELINING = 1;
const CONNECTIONS = 10;

async function run(title, opts) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${title}`);
  console.log(`${'─'.repeat(60)}`);

  const result = await autocannon({
    connections: CONNECTIONS,
    pipelining: PIPELINING,
    duration: DURATION,
    ...opts,
  });

  const r = result.requests;
  const l = result.latency;
  const e = result.errors + result['2xx'] === 0 ? 'N/A' : (result.errors / (result.errors + result['2xx']) * 100).toFixed(2) + '%';

  console.log(`Requests/sec   avg=${r.average.toFixed(0)}  min=${r.min}  max=${r.max}`);
  console.log(`Latency (ms)   avg=${l.average.toFixed(2)}  p50=${l.p50}  p75=${l.p75}  p95=${l.p95}  p99=${l.p99}`);
  console.log(`Errors         ${result.errors} (${e})`);
  console.log(`Throughput     ${(result.throughput.average / 1024).toFixed(1)} KB/s`);

  return result;
}

// ─── Pre-create a URL for redirect tests ─────────────────────────────────────
let shortCode = null;

async function setup() {
  const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }));
  if (!fetch) {
    console.warn('[Setup] node-fetch not available — using global fetch');
  }
  const f = fetch || global.fetch;
  const res = await f(`${BASE_URL}/api/url/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ longUrl: 'https://www.google.com' }),
  });
  const body = await res.json();
  shortCode = body.urlCode;
  if (!shortCode) throw new Error('Setup failed — could not create a test URL');
  console.log(`[Setup] Test short code: ${shortCode}`);
}

async function main() {
  console.log(`\nLoad Test Suite — ${BASE_URL}`);
  console.log(`Duration: ${DURATION}s | Connections: ${CONNECTIONS}\n`);

  try {
    await setup();
  } catch (err) {
    console.error('[Setup] Error:', err.message);
    process.exit(1);
  }

  // 1. URL creation
  await run('URL Creation (POST /api/url/shorten)', {
    url: `${BASE_URL}/api/url/shorten`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ longUrl: 'https://benchmark.example.com' }),
  });

  // 2. Redirect (will be served from cache after first hit)
  await run('Redirect — Cached (GET /:code)', {
    url: `${BASE_URL}/${shortCode}`,
  });

  // 3. Stats endpoint
  await run('Stats (GET /api/url/stats/:code)', {
    url: `${BASE_URL}/api/url/stats/${shortCode}`,
  });

  // 4. Recent URLs listing
  await run('Recent URLs (GET /api/url/recent)', {
    url: `${BASE_URL}/api/url/recent`,
  });

  console.log('\n✅ Benchmark complete.');
  console.log('NOTE: Results above are from your actual hardware. Do not fabricate or substitute numbers.');
}

main().catch(err => { console.error(err); process.exit(1); });
