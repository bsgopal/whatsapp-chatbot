// ============================================================
//  src/bot.js  —  Entry point. Clean, no dead code.
// ============================================================
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { handleMessage } = require("./flowHandler");
const sessionManager = require("./sessionManager");
const api = require("./apiServer");
const { exposeFunctionIfAbsent } = require("whatsapp-web.js/src/util/Puppeteer");
const { getBusiness } = require("../data/businesses");

const BOT_SYNC_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const BOT_SYNC_SECRET = process.env.BOT_SYNC_SECRET || 'wa_bot_sync_secret_2024';

async function syncToMongo(endpoint, body) {
  try {
    const http = require('http');
    const data = JSON.stringify(body);
    const url = new URL(BOT_SYNC_URL + '/api/v1/bot-sync/' + endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port || 5001,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'x-bot-secret': BOT_SYNC_SECRET },
    };
    const req = http.request(options, (res) => {
      res.resume(); // REQUIRED: drain response body so the socket closes cleanly
      if (res.statusCode !== 200 && res.statusCode !== 201) {
        console.warn(`[sync] ${endpoint} → HTTP ${res.statusCode}`);
      }
    });
    req.on('error', (e) => console.warn('[sync] request error:', e.message));
    req.write(data);
    req.end();
  } catch (e) { console.warn('[sync] failed:', e.message); }
}

const AUTH_CLIENT_ID = "appointment-bot";
const AUTH_DATA_PATH = path.resolve(__dirname, "..", ".wwebjs_auth");
const LEGACY_SESSION_PATHS = [
  path.resolve(__dirname, "..", ".chrome-profile"),
  path.resolve(__dirname, "..", ".edge-profile"),
];

function resolveBrowserPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((browserPath) => fs.existsSync(browserPath)) || null;
}

const browserPath = resolveBrowserPath();
if (browserPath) {
  console.log(`🌐  Using browser: ${browserPath}`);
} else {
  console.warn("⚠️  No local Chrome/Edge executable found. Puppeteer will use its default browser.");
}

const authStrategy = new LocalAuth({
  clientId: AUTH_CLIENT_ID,
  dataPath: AUTH_DATA_PATH,
});

const client = new Client({
  authStrategy,
  puppeteer: {
    executablePath: browserPath || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  },
});

let resetPromise = null;
let resettingSession = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(from) {
  return String(from || '').replace(/@.*$/, '');
}

function normalizePairingPhoneNumber(phoneNumber) {
  return String(phoneNumber || "").replace(/\D/g, "");
}

function isTransientPairingError(message) {
  const trimmed = String(message || "").trim();
  return /Minified invariant/i.test(trimmed) || /^[a-z]$/i.test(trimmed) || trimmed.length <= 2;
}

function toPairingErrorMessage(err) {
  const message = err?.message || String(err || "");
  if (isTransientPairingError(message)) {
    return "WhatsApp Web is not ready to generate the pairing code yet. Keep the QR visible for 5-10 seconds, then try again.";
  }
  return message || "Failed to request pairing code.";
}

async function removeDirectory(targetPath) {
  await fs.promises.rm(targetPath, { recursive: true, force: true, maxRetries: 4 });
}

async function clearStoredSessionData() {
  const sessionDirName = AUTH_CLIENT_ID ? `session-${AUTH_CLIENT_ID}` : "session";
  const sessionDir = path.join(AUTH_DATA_PATH, sessionDirName);

  for (const targetPath of [sessionDir, ...LEGACY_SESSION_PATHS]) {
    try {
      await removeDirectory(targetPath);
    } catch (err) {
      console.warn(`Failed to clear session path ${targetPath}: ${err.message}`);
    }
  }
}

async function destroyClientIfNeeded() {
  try {
    await client.destroy();
  } catch (err) {
    console.warn(`Failed to destroy WhatsApp client cleanly: ${err.message}`);
  }
}

async function restartWithFreshSession() {
  if (resetPromise) return resetPromise;

  resetPromise = (async () => {
    resettingSession = true;
    api.setLoading("Previous WhatsApp session cleared. Waiting for a fresh QR code...");
    sessionManager.resetAll();

    try {
      if (client.pupBrowser?.isConnected?.()) {
        try {
          await client.logout();
        } catch (err) {
          console.warn(`WhatsApp logout failed, forcing local reset instead: ${err.message}`);
          await destroyClientIfNeeded();
        }
      } else {
        await destroyClientIfNeeded();
      }

      await clearStoredSessionData();
      await client.initialize();

      return {
        message: "WhatsApp logged out. Scan the fresh QR code or request a new pairing code.",
      };
    } catch (err) {
      const message = err?.message || String(err);
      api.setRuntimeError(`Failed to restart WhatsApp after logout: ${message}`);
      throw err;
    } finally {
      resettingSession = false;
      resetPromise = null;
    }
  })();

  return resetPromise;
}

async function getAuthStateSnapshot() {
  if (!client.pupPage) {
    return { ready: false, state: null, hasPairingApi: false };
  }

  try {
    return await client.pupPage.evaluate(() => ({
      ready: Boolean(window.AuthStore?.AppState),
      state: window.AuthStore?.AppState?.state || null,
      hasPairingApi: Boolean(window.AuthStore?.PairingCodeLinkUtils),
    }));
  } catch (err) {
    return { ready: false, state: null, hasPairingApi: false, error: err.message };
  }
}

async function waitForPairingCodeReady(timeoutMs = 20000) {
  const startedAt = Date.now();
  let lastSnapshot = { ready: false, state: null, hasPairingApi: false };

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await getAuthStateSnapshot();
    lastSnapshot = snapshot;

    if (snapshot.state === "CONNECTED") {
      throw new Error("WhatsApp is already connected. Log out first if you want to pair another number.");
    }

    if (snapshot.ready && snapshot.state && snapshot.state !== "CONNECTED") {
      return snapshot;
    }

    await sleep(500);
  }

  const details = [];
  if (lastSnapshot.state) details.push(`Current state: ${lastSnapshot.state}.`);
  if (!lastSnapshot.ready) details.push("Auth page is still loading.");
  if (!lastSnapshot.hasPairingApi) details.push("Pairing tools have not finished loading yet.");
  const detailText = details.length ? ` ${details.join(" ")}` : "";
  throw new Error(`Pairing code is not ready yet. Wait for the QR code to appear, then try again.${detailText}`);
}

async function requestPairingCodeSafely(phoneNumber) {
  const normalizedPhoneNumber = normalizePairingPhoneNumber(phoneNumber);
  if (!/^\d{10,15}$/.test(normalizedPhoneNumber)) {
    throw new Error("Enter the phone number in international format, digits only. Example: 919876543210.");
  }

  await waitForPairingCodeReady(30000);
  await exposeFunctionIfAbsent(client.pupPage, "onCodeReceivedEvent", async (code) => {
    const normalizedCode = typeof code === "string" ? code.trim() : String(code || "").trim();
    if (normalizedCode) {
      api.setPairingCode(normalizedCode);
    }
    return normalizedCode;
  });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const code = await client.requestPairingCode(normalizedPhoneNumber, true);
      if (typeof code === "string" && /^[A-Z0-9-]{4,}$/.test(code.trim())) {
        api.setPairingCode(code.trim());
        return code.trim();
      }

      throw new Error(`Unexpected pairing code response: ${String(code)}`);
    } catch (err) {
      const message = err?.message || String(err || "");
      if (isTransientPairingError(message) && attempt < 5) {
        await sleep(1500 * attempt);
        continue;
      }

      throw new Error(toPairingErrorMessage(err));
    }
  }

  throw new Error("WhatsApp Web is not ready to generate the pairing code yet. Keep the QR visible for a few seconds, then try again.");
}

// ── QR ───────────────────────────────────────────────────────
client.on("qr", (qr) => {
  console.log("\n📱  Scan QR with WhatsApp (or see it in the Admin Dashboard):\n");
  api.setQR(qr);
});

// ── Ready ────────────────────────────────────────────────────
client.on("ready", () => {
  api.setConnected();
  console.log("\n✅  Bot is LIVE!");
  getBusiness()
    .then(b => console.log(`   • ${b.name} (${b.services.length} services, ${b.staff.length} staff)\n💬  Send 'hi' from any WhatsApp to start.\n`))
    .catch(err => console.warn("   ⚠️  Could not load business info:", err.message));
});

// ── Incoming messages ────────────────────────────────────────
client.on("message", async (msg) => {
  if (msg.isGroupMsg) return;
  if (msg.from === "status@broadcast") return;
  if (msg.type !== "chat") return;

  const text = msg.body?.trim();
  if (!text) return;

  // Get real phone number from WhatsApp contact info
  const waContact = await msg.getContact();
  const realPhone = waContact.number || normalizePhone(msg.from);
  const businessName = await getBusiness().then(b => b.name).catch(() => null);

  console.log(`📨  [${new Date().toLocaleTimeString()}] ${realPhone}: ${text}`);

  // Sync contact (upsert — no duplicate if already exists)
  syncToMongo('contact', {
    phone: realPhone,
    businessName,
    name: msg.notifyName || realPhone,
  });

  // Sync inbound message → shows up in WhatsApp Inbox on dashboard
  syncToMongo('message', {
    phone: realPhone,
    businessName,
    text,
    direction: 'inbound',
  });

  try {
    const reply = await handleMessage(msg.from, text);
    if (reply) await msg.reply(reply);
  } catch (err) {
    console.error("❌", err.message);
    await msg.reply("⚠️ Error. Send *hi* to restart.");
  }
});

// ── Auth / connection events ─────────────────────────────────
client.on("authenticated", () => console.log("🔐  Authenticated!"));
client.on("auth_failure", () => console.error("❌  Auth failed. Delete .wwebjs_auth and retry."));
client.on("disconnected", (r) => {
  if (resettingSession) return;
  api.setDisconnected(`WhatsApp disconnected: ${r}`);
  console.log("📵  Disconnected:", r);
});

client.on("auth_failure", () => {
  api.setRuntimeError("WhatsApp authentication failed. Use 'Log out & clear session' and scan again.");
});

async function startBot() {
  try {
    await api.start();
    api.registerLogoutHandler(restartWithFreshSession);
    api.registerPairingCodeHandler(async (phoneNumber) => {
      return requestPairingCodeSafely(phoneNumber);
    });

    await client.initialize();
  } catch (err) {
    const message = err?.message || String(err);
    if (!/Port 3001 is already in use/i.test(message)) {
      api.setRuntimeError(`Failed to start WhatsApp browser: ${message}`);
    }
    console.error("❌  Failed to initialize WhatsApp bot.");
    console.error(message);
  }
}

startBot();