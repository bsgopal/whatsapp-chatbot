// ============================================================
//  src/bot.js  —  WhatsApp client entry point
//  Run:  node src/bot.js
// ============================================================

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode               = require("qrcode-terminal");
const { handleMessage }    = require("./flowHandler");
const apiServer            = require("./apiServer");

// Start admin REST API on port 3001
apiServer.start();

// ── WhatsApp Client Setup ────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "appointment-bot" }),
  puppeteer: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    headless: true,
  },
});

// ── QR Code (scan once with your phone) ─────────────────────
client.on("qr", (qr) => {
  console.log("\n┌─────────────────────────────────────────┐");
  console.log("│  📱  Scan this QR code with WhatsApp    │");
  console.log("└─────────────────────────────────────────┘\n");
  qrcode.generate(qr, { small: true });
});

// ── Bot is ready ─────────────────────────────────────────────
client.on("ready", () => {
  console.log("\n✅  Appointment Bot is LIVE!\n");
  console.log("📌  Businesses configured:");
  const businesses = require("../data/businesses");
  businesses.forEach((b) => console.log(`    • ${b.name} (${b.category})`));
  console.log("\n💬  Send 'hi' from any WhatsApp number to start.\n");
});

// ── Incoming message handler ─────────────────────────────────
client.on("message", async (msg) => {
  // Ignore group messages, status updates, and non-text
  if (msg.isGroupMsg)                    return;
  if (msg.from === "status@broadcast")   return;
  if (msg.type !== "chat")               return;

  const phone = msg.from;          // e.g. "919876543210@c.us"
  const text  = msg.body?.trim();
  if (!text) return;

  console.log(`📨  [${new Date().toLocaleTimeString()}] ${phone}: ${text}`);

  try {
    const reply = await handleMessage(phone, text);
    if (reply) {
      await msg.reply(reply);
      console.log(`📤  Replied to ${phone}`);
    }
  } catch (err) {
    console.error("❌ Error handling message:", err);
    await msg.reply("⚠️ Something went wrong. Please send *hi* to start again.");
  }
});

// ── Auth events ──────────────────────────────────────────────
client.on("authenticated", () => console.log("🔐  WhatsApp authenticated!"));
client.on("auth_failure",  () => console.error("❌  Auth failed. Delete .wwebjs_auth folder and retry."));
client.on("disconnected",  (r) => console.log("📵  Disconnected:", r));

// ── Start ────────────────────────────────────────────────────
client.initialize();