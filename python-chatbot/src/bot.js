// ============================================================
//  src/bot.js  —  Entry point. Clean, no dead code.
// ============================================================

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode                = require("qrcode-terminal");
const { handleMessage }     = require("./flowHandler");
const api                   = require("./apiServer");

// Start REST API (port 3001)
api.start();

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "appointment-bot" }),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  },
});

// ── QR: send to terminal AND to React via API ────────────────
client.on("qr", (qr) => {
  console.log("\n📱  Scan QR with WhatsApp (or see it in the Admin Dashboard):\n");
  qrcode.generate(qr, { small: true });
  api.setQR(qr);   // ← React dashboard will poll this
});

// ── Ready ────────────────────────────────────────────────────
client.on("ready", () => {
  api.setConnected();
  console.log("\n✅  Bot is LIVE!");
  const businesses = require("../data/businesses");
  businesses.forEach(b => console.log(`   • ${b.name}`));
  console.log("\n💬  Send 'hi' from any WhatsApp to start.\n");
});

// ── Incoming messages ────────────────────────────────────────
client.on("message", async (msg) => {
  if (msg.isGroupMsg)                  return;
  if (msg.from === "status@broadcast") return;
  if (msg.type !== "chat")             return;

  const text = msg.body?.trim();
  if (!text) return;

  console.log(`📨  [${new Date().toLocaleTimeString()}] ${msg.from}: ${text}`);

  try {
    const reply = await handleMessage(msg.from, text);
    if (reply) await msg.reply(reply);
  } catch (err) {
    console.error("❌", err.message);
    await msg.reply("⚠️ Error. Send *hi* to restart.");
  }
});

// ── Auth / connection events ─────────────────────────────────
client.on("authenticated",  ()  => console.log("🔐  Authenticated!"));
client.on("auth_failure",   ()  => console.error("❌  Auth failed. Delete .wwebjs_auth and retry."));
client.on("disconnected",   (r) => { api.setDisconnected(); console.log("📵  Disconnected:", r); });

client.initialize();