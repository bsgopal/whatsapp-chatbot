import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "react-qr-code";

const API = "http://localhost:3001/api";

// ── Helpers ──────────────────────────────────────────────────
const fmt = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const phone = (p) => p?.replace("@c.us", "") || "";

const BIZ_EMOJI = { Doctor: "🏥", "Hair Salon": "💇", "Gym / Fitness": "💪" };

// ── Sub-components ───────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      borderTop: `3px solid ${color}`, flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color, marginTop: 6, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function Badge({ status }) {
  const styles = {
    confirmed: { bg: "#dcfce7", color: "#166534", dot: "#22c55e" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  };
  const s = styles[status] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {status}
    </span>
  );
}

// ── QR Setup Panel ───────────────────────────────────────────
function QRPanel() {
  const [qrData, setQrData]   = useState(null);
  const [status, setStatus]   = useState("loading");
  const intervalRef           = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/qr-status`);
      const data = await res.json();
      setStatus(data.status);
      setQrData(data.qr);
      if (data.status === "connected") clearInterval(intervalRef.current);
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current);
  }, [poll]);

  if (status === "connected") return (
    <div style={{
      background: "#f0fdf4", border: "1px solid #bbf7d0",
      borderRadius: 12, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
    }}>
      <span style={{ fontSize: 22 }}>✅</span>
      <div>
        <div style={{ fontWeight: 600, color: "#166534", fontSize: 14 }}>WhatsApp Bot Connected</div>
        <div style={{ fontSize: 12, color: "#16a34a" }}>Bot is live and accepting messages</div>
      </div>
    </div>
  );

  if (status === "qr_ready" && qrData) return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 24,
      display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap",
    }}>
      <div style={{
        background: "#fff", padding: 12, borderRadius: 12,
        border: "2px solid #e5e7eb", display: "inline-block",
      }}>
        <QRCode value={qrData} size={140} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 6 }}>
          📱 Scan to Connect WhatsApp Bot
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
          1. Open WhatsApp on your phone<br />
          2. Go to <b>Settings → Linked Devices</b><br />
          3. Tap <b>Link a Device</b><br />
          4. Scan this QR code
        </div>
        <div style={{
          marginTop: 10, fontSize: 11, color: "#9ca3af",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#f59e0b",
            display: "inline-block", animation: "pulse 1.5s infinite",
          }} />
          QR refreshes automatically every 3 seconds
        </div>
      </div>
    </div>
  );

  if (status === "error") return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca",
      borderRadius: 12, padding: "16px 20px", marginBottom: 24,
      color: "#991b1b", fontSize: 13,
    }}>
      ⚠️ Cannot connect to bot. Make sure <code>node src/bot.js</code> is running.
    </div>
  );

  return (
    <div style={{
      background: "#f9fafb", borderRadius: 12, padding: "16px 20px",
      marginBottom: 24, color: "#6b7280", fontSize: 13,
    }}>
      ⏳ Connecting to bot...
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────
export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bizFilter, setBizFilter]       = useState("all");
  const [search, setSearch]             = useState("");
  const [lastRefresh, setLastRefresh]   = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        fetch(`${API}/appointments`).then(r => r.json()),
        fetch(`${API}/stats`).then(r => r.json()),
      ]);
      setAppointments(a);
      setStats(s);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      setError("Bot API unreachable. Run: node src/bot.js");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  const uniqueBiz = [...new Map(
    appointments.map(a => [a.businessId, { id: a.businessId, name: a.businessName }])
  ).values()];

  const filtered = appointments.filter(a => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (bizFilter    !== "all" && a.businessId !== bizFilter) return false;
    if (search && ![a.name, phone(a.phone), a.businessName, a.staffName]
      .join(" ").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = appointments.filter(
    a => a.status === "confirmed" && a.date === todayStr
  ).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        tr:hover td { background: #f9fafb !important; }
        input:focus, select:focus { outline: 2px solid #6366f1; outline-offset: 1px; }
        ::-webkit-scrollbar { height: 6px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e5e7eb",
        padding: "0 28px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg,#25d366,#128c7e)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
          }}>📅</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Appointment Admin</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>WhatsApp Bot Dashboard</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchData} style={{
            background: "#f3f4f6", border: "1px solid #e5e7eb",
            borderRadius: 8, padding: "6px 14px", fontSize: 12,
            fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>⟳ Refresh</button>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ── QR Panel ── */}
        <QRPanel />

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "12px 18px", marginBottom: 20,
            color: "#991b1b", fontSize: 13,
          }}>⚠️ {error}</div>
        )}

        {/* ── Stat Cards ── */}
        {stats && (
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Total Confirmed" value={stats.confirmed}  icon="✅" color="#22c55e" />
            <StatCard label="Cancelled"        value={stats.cancelled}  icon="❌" color="#ef4444" />
            <StatCard label="Unique Users"     value={stats.totalUsers} icon="👥" color="#6366f1" />
            <StatCard label="Today's Bookings" value={todayCount}       icon="📅" color="#f59e0b" />
          </div>
        )}

        {/* ── Business Breakdown ── */}
        {stats?.byBusiness && (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "18px 22px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              Bookings by Business
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {Object.entries(stats.byBusiness).map(([name, count]) => (
                <div key={name} style={{
                  flex: 1, minWidth: 150,
                  background: "#f9fafb", borderRadius: 10, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 24 }}>
                    {Object.entries(BIZ_EMOJI).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1] || "🏢"}
                  </span>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{count}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "14px 18px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 16,
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        }}>
          <input
            placeholder="🔍 Search name, phone, business..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200, border: "1px solid #e5e7eb",
              borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#111827",
            }}
          />
          {["all", "confirmed", "cancelled"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: statusFilter === s ? "none" : "1px solid #e5e7eb",
              background: statusFilter === s ? "#111827" : "#fff",
              color: statusFilter === s ? "#fff" : "#6b7280",
              cursor: "pointer", textTransform: "capitalize",
            }}>{s}</button>
          ))}
          <select value={bizFilter} onChange={e => setBizFilter(e.target.value)} style={{
            border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "8px 12px", fontSize: 12, color: "#374151", background: "#fff",
          }}>
            <option value="all">All Businesses</option>
            {uniqueBiz.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* ── Table ── */}
        <div style={{
          background: "#fff", borderRadius: 14,
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>
                {appointments.length === 0
                  ? "No appointments yet. Send 'hi' on WhatsApp to book one!"
                  : "No results match your filter."}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    {["Booking ID","Customer","Phone","Business","Staff","Date","Time","Status","Booked At"].map(h => (
                      <th key={h} style={{
                        padding: "11px 14px", textAlign: "left",
                        fontSize: 11, fontWeight: 700, color: "#6b7280",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <code style={{
                          background: "#f3f4f6", color: "#374151",
                          padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        }}>{a.id}</code>
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{a.name}</td>
                      <td style={{ padding: "12px 14px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>+{phone(a.phone)}</td>
                      <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>{a.businessName}</td>
                      <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>{a.staffName}</td>
                      <td style={{ padding: "12px 14px", color: "#374151", whiteSpace: "nowrap" }}>{fmt(a.date + "T00:00:00")}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{a.slot}</td>
                      <td style={{ padding: "12px 14px" }}><Badge status={a.status} /></td>
                      <td style={{ padding: "12px 14px", color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>{fmtTime(a.bookedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <div style={{
              padding: "10px 18px", borderTop: "1px solid #f3f4f6",
              fontSize: 11, color: "#9ca3af", background: "#fafafa",
            }}>
              Showing {filtered.length} of {appointments.length} appointments
            </div>
          )}
        </div>
      </div>
    </div>
  );
}