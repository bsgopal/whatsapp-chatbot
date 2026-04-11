// ============================================================
//  data/businesses.js  —  Dynamic business config loader
//
//  Fetches the configured business (staff, services, settings)
//  from the backend API using BOT_BUSINESS_ID env var.
//
//  No hardcoded shops. You add/edit businesses in your dashboard;
//  the bot picks them up automatically.
// ============================================================

const http  = require('http');
const https = require('https');

const BACKEND_URL     = (process.env.BACKEND_URL     || 'http://localhost:5000').replace(/\/+$/, '');
const BOT_SYNC_SECRET = process.env.BOT_SYNC_SECRET  || 'wa_bot_sync_secret_2024';
const BOT_BUSINESS_ID = process.env.BOT_BUSINESS_ID  || null;

// In-memory cache — refreshed at startup and on demand
let _cached = null;

/**
 * Fetch business config from the backend and cache it.
 * Throws if BOT_BUSINESS_ID is not set or the fetch fails.
 */
async function fetchBusiness() {
  if (!BOT_BUSINESS_ID) {
    throw new Error(
      '[businesses] BOT_BUSINESS_ID is not set in .env. ' +
      'Go to your dashboard → Settings, copy the Business ID, and add it to .env as BOT_BUSINESS_ID=<id>'
    );
  }

  const url  = `${BACKEND_URL}/api/v1/bot-sync/business/${BOT_BUSINESS_ID}`;
  const data = await httpGet(url, { 'x-bot-secret': BOT_SYNC_SECRET });

  if (!data.success || !data.data) {
    throw new Error(`[businesses] Backend returned failure: ${JSON.stringify(data)}`);
  }

  _cached = data.data;
  console.log(`[businesses] ✅ Loaded: "${_cached.name}" — ${_cached.services.length} services, ${_cached.staff.length} staff`);
  return _cached;
}

/**
 * Returns the cached business, fetching it first if needed.
 */
async function getBusiness() {
  if (_cached) return _cached;
  return fetchBusiness();
}

/**
 * Force re-fetch from API (useful if you updated services in the dashboard).
 */
async function refreshBusiness() {
  _cached = null;
  return fetchBusiness();
}

// ── Minimal promise-based HTTP/HTTPS GET ───────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'Content-Type': 'application/json', ...headers },
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error from ${url}: ${body.slice(0, 200)}`)); }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('Timeout fetching business config')); });
    req.end();
  });
}

module.exports = { getBusiness, refreshBusiness };