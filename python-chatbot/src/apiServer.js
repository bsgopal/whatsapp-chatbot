// ============================================================
//  src/apiServer.js  —  Mini REST API so React dashboard can
//  read appointment data from the WhatsApp bot
//  Runs on http://localhost:3001
// ============================================================

const http    = require("http");
const store   = require("./appointmentStore");
const businesses = require("../data/businesses");

function start() {
  const server = http.createServer((req, res) => {
    // CORS headers so React (port 5173) can call this
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = req.url.split("?")[0];

    // GET /api/appointments  — all appointments flat list
    if (url === "/api/appointments") {
      const all = store.getAll();
      const flat = Object.values(all).flat();
      res.writeHead(200);
      res.end(JSON.stringify(flat));
      return;
    }

    // GET /api/stats  — summary numbers for dashboard cards
    if (url === "/api/stats") {
      const all = Object.values(store.getAll()).flat();
      const confirmed  = all.filter(a => a.status === "confirmed").length;
      const cancelled  = all.filter(a => a.status === "cancelled").length;
      const totalUsers = new Set(all.map(a => a.phone)).size;

      // per-business count
      const byBusiness = {};
      businesses.forEach(b => { byBusiness[b.name] = 0; });
      all.filter(a => a.status === "confirmed").forEach(a => {
        if (byBusiness[a.businessName] !== undefined)
          byBusiness[a.businessName]++;
      });

      res.writeHead(200);
      res.end(JSON.stringify({ confirmed, cancelled, totalUsers, byBusiness }));
      return;
    }

    // GET /api/businesses
    if (url === "/api/businesses") {
      res.writeHead(200);
      res.end(JSON.stringify(businesses.map(b => ({ id: b.id, name: b.name, category: b.category }))));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(3001, () => {
    console.log("📊  Admin API running → http://localhost:3001/api/appointments");
  });
}

module.exports = { start };