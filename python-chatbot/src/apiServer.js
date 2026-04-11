// ============================================================
//  src/apiServer.js  —  REST API for Admin Dashboard
//  All store calls are now async (node-persist)
// ============================================================

const http       = require("http");
const store      = require("./appointmentStore");
const businesses = require("../data/businesses");

let currentQR  = null;
let botStatus  = "loading";
let currentPairingCode = null;
let pairingError = null;
let runtimeError = null;
let requestPairingCodeHandler = null;
let logoutHandler = null;

function setQR(qr) {
  currentQR = qr;
  runtimeError = null;
  botStatus = "qr_ready";
}
function setConnected()   { currentQR = null; currentPairingCode = null; pairingError = null; runtimeError = null; botStatus = "connected"; }
function setDisconnected(message = null){
  currentQR = null;
  currentPairingCode = null;
  pairingError = null;
  if (message) runtimeError = message;
  botStatus = "disconnected";
}
function setLoading(message = null) {
  currentQR = null;
  currentPairingCode = null;
  pairingError = null;
  runtimeError = message;
  botStatus = "loading";
}
function setPairingCode(code) { currentPairingCode = code; pairingError = null; }
function setPairingError(message) { pairingError = message; currentPairingCode = null; }
function setRuntimeError(message) {
  runtimeError = message;
  currentQR = null;
  currentPairingCode = null;
  botStatus = "error";
}
function registerPairingCodeHandler(handler) { requestPairingCodeHandler = handler; }
function registerLogoutHandler(handler) { logoutHandler = handler; }

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");
}

function send(res, code, obj) {
  res.writeHead(code);
  res.end(JSON.stringify(obj));
}

function start() {
  const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = req.url.split("?")[0];

    try {
      // ── QR status ───────────────────────────────────────────
      if (url === "/api/qr-status") {
        return send(res, 200, {
          status: botStatus,
          qr: currentQR,
          pairingCode: currentPairingCode,
          pairingError,
          runtimeError,
        });
      }

      if (url === "/api/pairing-code" && req.method === "POST") {
        if (!requestPairingCodeHandler) {
          return send(res, 503, { error: "Pairing code handler is not available" });
        }

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            const phoneNumber = String(payload.phoneNumber || "").replace(/\D/g, "");
            if (!phoneNumber) {
              return send(res, 400, { error: "Phone number is required in international format" });
            }

            const code = await requestPairingCodeHandler(phoneNumber);
            setPairingCode(code);
            return send(res, 200, { success: true, pairingCode: code });
          } catch (err) {
            setPairingError(err.message || "Failed to request pairing code");
            return send(res, 500, { error: err.message || "Failed to request pairing code" });
          }
        });
        return;
      }

      // ── All appointments (flat list) ────────────────────────
      if (url === "/api/logout" && req.method === "POST") {
        if (!logoutHandler) {
          return send(res, 503, { error: "Logout handler is not available" });
        }

        const result = await logoutHandler();
        return send(res, 200, {
          success: true,
          ...(result || {}),
        });
      }

      if (url === "/api/appointments") {
        const all = Object.values(await store.getAll()).flat();
        // sort newest first
        all.sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));
        return send(res, 200, all);
      }

      // ── Stats ───────────────────────────────────────────────
      if (url === "/api/stats") {
        const all       = Object.values(await store.getAll()).flat();
        const confirmed = all.filter(a => a.status === "confirmed").length;
        const cancelled = all.filter(a => a.status === "cancelled").length;
        const phones    = new Set(all.map(a => a.phone));
        const today     = new Date().toISOString().slice(0, 10);
        const todayCount= all.filter(a => a.status === "confirmed" && a.date === today).length;

        const byBusiness = {};
        businesses.forEach(b => { byBusiness[b.name] = 0; });
        all.filter(a => a.status === "confirmed")
           .forEach(a => { if (byBusiness[a.businessName] !== undefined) byBusiness[a.businessName]++; });

        const byService = {};
        all.filter(a => a.status === "confirmed" && a.serviceName)
           .forEach(a => { byService[a.serviceName] = (byService[a.serviceName] || 0) + 1; });

        const revenue = all
          .filter(a => a.status === "confirmed")
          .reduce((sum, a) => sum + (a.servicePrice || 0), 0);

        // Daily bookings for last 7 days
        const dailyMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          dailyMap[d.toISOString().slice(0, 10)] = 0;
        }
        all.filter(a => a.status === "confirmed" && dailyMap.hasOwnProperty(a.date))
           .forEach(a => { dailyMap[a.date]++; });
        const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

        return send(res, 200, {
          confirmed, cancelled, total: all.length,
          totalUsers: phones.size, todayCount, revenue,
          byBusiness, byService, dailyTrend,
        });
      }

      // ── Business list ───────────────────────────────────────
      if (url === "/api/businesses") {
        return send(res, 200, businesses.map(b => ({
          id: b.id, name: b.name, category: b.category,
          services: b.services, staff: b.staff.map(s => ({ id: s.id, name: s.name, role: s.role })),
        })));
      }

      send(res, 404, { error: "Not found" });
    } catch (err) {
      console.error("API Error:", err.message);
      send(res, 500, { error: "Internal server error" });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error("Port 3001 is already in use. Stop the old WhatsApp bot process and try again."));
        return;
      }
      reject(err);
    });

    server.listen(3001, () => {
      console.log("📊  Admin API → http://localhost:3001");
      resolve(server);
    });
  });
}

module.exports = {
  start,
  setQR,
  setConnected,
  setDisconnected,
  setLoading,
  setPairingCode,
  setPairingError,
  setRuntimeError,
  registerPairingCodeHandler,
  registerLogoutHandler,
};
