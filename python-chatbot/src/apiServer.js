// ============================================================
//  src/apiServer.js  —  REST API for React Admin Dashboard
//  Endpoints:
//    GET /api/appointments
//    GET /api/stats
//    GET /api/businesses
//    GET /api/qr-status
// ============================================================

const http       = require("http");
const store      = require("./appointmentStore");
const businesses = require("../data/businesses");

let currentQR     = null;   // latest QR string (set by bot.js)
let botStatus     = "loading"; // loading | qr_ready | connected | disconnected

function setQR(qr)       { currentQR = qr; botStatus = "qr_ready"; }
function setConnected()  { currentQR = null; botStatus = "connected"; }
function setDisconnected(){ botStatus = "disconnected"; }

function start() {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = req.url.split("?")[0];

    // ── QR / bot status ──────────────────────────────────────
    if (url === "/api/qr-status") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: botStatus, qr: currentQR }));
      return;
    }

    // ── All appointments (flat list) ─────────────────────────
    if (url === "/api/appointments") {
      const flat = Object.values(store.getAll()).flat();
      res.writeHead(200);
      res.end(JSON.stringify(flat));
      return;
    }

    // ── Stats for dashboard cards ────────────────────────────
    if (url === "/api/stats") {
      const all        = Object.values(store.getAll()).flat();
      const confirmed  = all.filter(a => a.status === "confirmed").length;
      const cancelled  = all.filter(a => a.status === "cancelled").length;
      const totalUsers = new Set(all.map(a => a.phone)).size;

      const byBusiness = {};
      businesses.forEach(b => { byBusiness[b.name] = 0; });
      all.filter(a => a.status === "confirmed")
         .forEach(a => { if (byBusiness[a.businessName] !== undefined) byBusiness[a.businessName]++; });

      res.writeHead(200);
      res.end(JSON.stringify({ confirmed, cancelled, totalUsers, total: all.length, byBusiness }));
      return;
    }

    // ── Business list ────────────────────────────────────────
    if (url === "/api/businesses") {
      res.writeHead(200);
      res.end(JSON.stringify(businesses.map(b => ({ id: b.id, name: b.name, category: b.category }))));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(3001, () => {
    console.log("📊  Admin API → http://localhost:3001");
  });
}

module.exports = { start, setQR, setConnected, setDisconnected };