// ============================================================
//  src/apiServer.js  —  REST API for Admin Dashboard
//  All store calls are now async (node-persist)
// ============================================================

const http       = require("http");
const store      = require("./appointmentStore");
const businesses = require("../data/businesses");

let currentQR  = null;
let botStatus  = "loading";

function setQR(qr)        { currentQR = qr;   botStatus = "qr_ready";     }
function setConnected()   { currentQR = null;  botStatus = "connected";    }
function setDisconnected(){ botStatus = "disconnected"; }

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
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
        return send(res, 200, { status: botStatus, qr: currentQR });
      }

      // ── All appointments (flat list) ────────────────────────
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

  server.listen(3001, () => {
    console.log("📊  Admin API → http://localhost:3001");
  });
}

module.exports = { start, setQR, setConnected, setDisconnected };