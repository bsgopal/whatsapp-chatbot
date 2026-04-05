import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:3001/api";

const STATUS_COLOR = {
  confirmed: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  cancelled:  { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

const BIZ_ICONS = {
  "Doctor":       "🏥",
  "Hair Salon":   "💇",
  "Gym / Fitness":"💪",
};

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      padding: "22px 28px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
      borderLeft: `4px solid ${color}`,
      minWidth: 160,
      flex: 1,
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Badge({ status }) {
  const c = STATUS_COLOR[status] || { bg: "#f3f4f6", text: "#374151", dot: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.text,
      borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [filter, setFilter]             = useState("all");       // all | confirmed | cancelled
  const [bizFilter, setBizFilter]       = useState("all");
  const [search, setSearch]             = useState("");
  const [lastRefresh, setLastRefresh]   = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, statsRes] = await Promise.all([
        fetch(`${API}/appointments`),
        fetch(`${API}/stats`),
      ]);
      if (!apptRes.ok) throw new Error("Bot API not reachable");
      setAppointments(await apptRes.json());
      setStats(await statsRes.json());
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError("Cannot connect to bot API. Make sure the bot is running (node src/bot.js).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000); // auto-refresh every 15s
    return () => clearInterval(t);
  }, [fetchData]);

  // Filtered list
  const filtered = appointments.filter(a => {
    if (filter !== "all"    && a.status       !== filter)       return false;
    if (bizFilter !== "all" && a.businessId   !== bizFilter)    return false;
    if (search && ![a.name, a.phone, a.businessName, a.staffName]
      .join(" ").toLowerCase().includes(search.toLowerCase()))  return false;
    return true;
  });

  const uniqueBizIds = [...new Set(appointments.map(a => ({ id: a.businessId, name: a.businessName }))
    .map(JSON.stringify))].map(JSON.parse);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #25d366, #128c7e)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>📋</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Appointment Admin</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>WhatsApp Bot Dashboard</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchData} style={{
            background: "#f3f4f6", border: "none", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 600,
            color: "#374151", cursor: "pointer",
          }}>⟳ Refresh</button>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "14px 20px", marginBottom: 24,
            color: "#991b1b", fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Stat cards */}
        {stats && (
          <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            <StatCard label="Total Booked"   value={stats.confirmed}  color="#10b981" sub="confirmed appointments" />
            <StatCard label="Cancelled"       value={stats.cancelled}  color="#ef4444" sub="by users" />
            <StatCard label="Unique Users"    value={stats.totalUsers} color="#6366f1" sub="WhatsApp numbers" />
            <StatCard label="Total Messages"  value={appointments.length} color="#f59e0b" sub="all time" />
          </div>
        )}

        {/* Business breakdown */}
        {stats?.byBusiness && (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14 }}>
              Bookings by Business
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {Object.entries(stats.byBusiness).map(([name, count]) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "#f9fafb", borderRadius: 10, padding: "10px 16px", flex: 1, minWidth: 160,
                }}>
                  <span style={{ fontSize: 22 }}>{BIZ_ICONS[Object.values(BIZ_ICONS)[0]] || "🏢"}</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{count}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "16px 20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: 20,
          display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
        }}>
          <input
            placeholder="🔍  Search name, phone, business..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px",
              fontSize: 13, flex: 1, minWidth: 220, outline: "none", color: "#111827",
            }}
          />
          {["all","confirmed","cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: filter === s ? "none" : "1px solid #e5e7eb",
              background: filter === s ? "#111827" : "#fff",
              color: filter === s ? "#fff" : "#6b7280",
              cursor: "pointer", textTransform: "capitalize",
            }}>{s}</button>
          ))}
          <select
            value={bizFilter}
            onChange={e => setBizFilter(e.target.value)}
            style={{
              border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px",
              fontSize: 12, color: "#374151", outline: "none", background: "#fff",
            }}
          >
            <option value="all">All Businesses</option>
            {uniqueBizIds.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={{
          background: "#fff", borderRadius: 14,
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              Loading appointments...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No appointments found.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["ID","Customer","Phone","Business","Staff","Date","Time","Status","Booked At"].map(h => (
                    <th key={h} style={{
                      padding: "12px 16px", textAlign: "left",
                      fontWeight: 600, color: "#6b7280", fontSize: 11,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id} style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: i % 2 === 0 ? "#fff" : "#fafafa",
                  }}>
                    <td style={{ padding: "13px 16px" }}>
                      <code style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, color: "#374151" }}>
                        {a.id}
                      </code>
                    </td>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "#111827" }}>{a.name}</td>
                    <td style={{ padding: "13px 16px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>
                      {a.phone?.replace("@c.us", "")}
                    </td>
                    <td style={{ padding: "13px 16px", color: "#374151" }}>{a.businessName}</td>
                    <td style={{ padding: "13px 16px", color: "#374151" }}>{a.staffName}</td>
                    <td style={{ padding: "13px 16px", color: "#374151" }}>
                      {new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "13px 16px", color: "#374151", fontWeight: 600 }}>{a.slot}</td>
                    <td style={{ padding: "13px 16px" }}><Badge status={a.status} /></td>
                    <td style={{ padding: "13px 16px", color: "#9ca3af", fontSize: 11 }}>
                      {new Date(a.bookedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Footer count */}
          {filtered.length > 0 && (
            <div style={{
              padding: "12px 20px", background: "#f9fafb",
              borderTop: "1px solid #e5e7eb", fontSize: 11, color: "#9ca3af",
            }}>
              Showing {filtered.length} of {appointments.length} appointments
            </div>
          )}
        </div>
      </div>
    </div>
  );
}