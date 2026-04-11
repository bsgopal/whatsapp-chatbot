import { useQuery } from '@tanstack/react-query';
import { analyticsAPI, appointmentsAPI } from '../../api';
import { format, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import useAuthStore from '../../context/authStore';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

const STATUS_COLORS = {
  pending: { color: '#FBB040', bg: 'bg-amber/10 text-amber border-amber/30', label: 'Pending' },
  confirmed: { color: '#38BDF8', bg: 'bg-sky/10 text-sky border-sky/30', label: 'Confirmed' },
  completed: { color: '#00E676', bg: 'bg-em/10 text-em border-em/30', label: 'Completed' },
  cancelled: { color: '#FB7185', bg: 'bg-rose/10 text-rose border-rose/30', label: 'Cancelled' },
  checked_in: { color: '#2DD4BF', bg: 'bg-teal/10 text-teal border-teal/30', label: 'Checked In' },
  no_show: { color: '#617484', bg: 'bg-stone-2/10 text-stone-2 border-stone-2/30', label: 'No Show' },
};

function StatCard({ icon, label, value, sub, color = '#00E676', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="stat-card"
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: `${color}18` }}>
          {icon}
        </div>
        {sub && (
          <span className={`text-2xs font-mono font-bold px-2 py-0.5 rounded-full ${sub.startsWith('+') ? 'text-em bg-em/10' : sub.startsWith('-') ? 'text-rose bg-rose/10' : 'text-stone-2 bg-ink-5'}`}>
            {sub}
          </span>
        )}
      </div>
      <div>
        <div className="font-display font-extrabold text-2xl text-slate-900">{value}</div>
        <div className="text-xs text-stone-2 mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-3 border border-ink-6 rounded-lg px-3 py-2 shadow-lg">
      <div className="text-2xs font-mono text-stone-2 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {p.name === 'revenue' ? `₹${(p.value || 0).toLocaleString()}` : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user, business } = useAuthStore();

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsAPI.getDashboard(),
    select: (d) => d.data.data,
    refetchInterval: 60000,
  });

  const { data: todayData } = useQuery({
    queryKey: ['today-appointments'],
    queryFn: () => appointmentsAPI.getToday(),
    select: (d) => d.data.data,
    refetchInterval: 30000,
  });

  const { data: chatbotData } = useQuery({
    queryKey: ['dashboard-chatbot'],
    queryFn: () => analyticsAPI.getChatbot('30d'),
    select: (d) => d.data.data,
    refetchInterval: 60000,
  });

  const kpis = dashData?.kpis || {};
  const trend = dashData?.dailyTrend || [];
  const topServices = dashData?.topServices || [];
  const statusDist = dashData?.statusDistribution || [];
  const today = todayData || [];
  const chatbotKpis = chatbotData?.kpis || {};

  const trendData = trend.map(t => ({ date: t._id?.slice(5), count: t.count, revenue: t.revenue }));

  return (
    <div className="h-full overflow-y-auto bg-ink-1 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-slate-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-stone-2 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')} · {business?.name}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="📅" label="Today's Appointments" value={kpis.todayAppointments ?? '—'} color="#00E676" delay={0} />
        <StatCard icon="💰" label="Month Revenue" value={`₹${(kpis.monthRevenue || 0).toLocaleString()}`} color="#38BDF8" delay={0.05} />
        <StatCard icon="👥" label="Total Contacts" value={kpis.totalContacts ?? '—'} color="#A78BFA" delay={0.1} />
        <StatCard icon="📈" label="Growth Rate" value={`${kpis.growthRate ?? 0}%`} sub={kpis.growthRate > 0 ? `+${kpis.growthRate}%` : `${kpis.growthRate}%`} color="#FBB040" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Trend chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">30-Day Trend</h3>
              <p className="text-2xs text-stone-2">Appointments & Revenue</p>
            </div>
            <span className="badge-em">Last 30 days</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="countGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E676" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#617484', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" name="appointments" stroke="#00E676" strokeWidth={2} fill="url(#countGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top services */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-5"
        >
          <h3 className="font-display font-bold text-sm text-slate-900 mb-4">Top Services</h3>
          {topServices.length === 0 ? (
            <p className="text-sm text-stone-2 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-mist-2 truncate flex-1">{s._id || 'Unknown'}</span>
                    <span className="text-xs font-bold text-slate-900 ml-2">{s.count}</span>
                  </div>
                  <div className="w-full bg-ink-5 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-em to-teal"
                      style={{ width: `${Math.min(100, (s.count / (topServices[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Today's appointments */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-slate-900">Today's Schedule</span>
            {today.length > 0 && (
              <span className="badge-em">{today.length} apts</span>
            )}
          </div>
          <span className="text-2xs font-mono text-stone-2">{format(new Date(), 'MMMM d, yyyy')}</span>
        </div>

        {today.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm text-stone-2">No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-6">
            {today.map((apt, i) => {
              const st = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
              return (
                <motion.div
                  key={apt._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-4/50 transition-colors"
                >
                  {/* Time */}
                  <div className="w-14 flex-shrink-0 text-center">
                    <div className="text-xs font-mono font-bold text-slate-900">{format(new Date(apt.scheduledAt), 'HH:mm')}</div>
                    <div className="text-2xs text-stone-2 font-mono">{apt.serviceDuration}m</div>
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet/50 to-sky/50 flex items-center justify-center text-xs font-bold text-slate-900 flex-shrink-0">
                    {apt.contact?.name?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{apt.contact?.name}</div>
                    <div className="text-2xs text-stone-2 truncate">{apt.serviceName} {apt.staff ? `· ${apt.staff.name}` : ''}</div>
                  </div>

                  {/* Price */}
                  <div className="text-xs font-mono font-bold text-slate-900 mr-2">₹{(apt.servicePrice || 0).toLocaleString()}</div>

                  {/* Status */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold border ${st.bg}`}>
                    {st.label}
                  </span>

                  {/* Source */}
                  {apt.source === 'whatsapp' && (
                    <span className="text-base" title="Booked via WhatsApp">📱</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* WhatsApp KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card p-5 mt-4"
      >
        <h3 className="font-display font-bold text-sm text-slate-900 mb-4">WhatsApp KPIs</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { l: 'Delivery Rate', v: `${chatbotKpis.deliveryRate ?? 0}%`, c: 'text-em' },
            { l: 'Bot Chats', v: `${chatbotKpis.botHandledChats ?? 0}`, c: 'text-teal' },
            { l: 'Booking Conversion', v: `${chatbotKpis.bookingConversionRate ?? 0}%`, c: 'text-violet' },
            { l: 'Avg Response', v: `${chatbotKpis.avgResponseSeconds ?? 0}s`, c: 'text-sky' },
            { l: 'Failed Deliveries', v: `${chatbotKpis.failedDeliveries ?? 0}`, c: 'text-amber' },
          ].map((k) => (
            <div key={k.l} className="bg-ink-5 rounded-lg p-3 text-center">
              <div className={`font-display font-extrabold text-xl ${k.c}`}>{k.v}</div>
              <div className="text-2xs text-stone-2 mt-0.5">{k.l}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

