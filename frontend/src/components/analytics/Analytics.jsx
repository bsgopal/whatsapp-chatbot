import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { analyticsAPI } from '../../api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#00E676', '#38BDF8', '#A78BFA', '#FBB040', '#2DD4BF', '#FB7185'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-3 border border-ink-6 rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-stone-2 mb-1">{label}</div>
      {payload.map((item, index) => (
        <div key={index} style={{ color: item.color }} className="font-semibold">
          {item.name}: {String(item.name).toLowerCase().includes('revenue') ? `Rs ${(item.value || 0).toLocaleString()}` : item.value}
        </div>
      ))}
    </div>
  );
};

function MetricCard({ label, value, hint, color, delay = 0, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-4"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-display font-extrabold text-2xl" style={{ color }}>{value}</div>
      <div className="text-2xs text-stone-2 mt-0.5">{label}</div>
      {hint ? <div className="text-2xs text-stone-1 mt-1">{hint}</div> : null}
    </motion.div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState('30d');

  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsAPI.getDashboard,
    select: (response) => response.data.data,
  });

  const { data: revenueData } = useQuery({
    queryKey: ['revenue', period],
    queryFn: () => analyticsAPI.getRevenue(period),
    select: (response) => response.data.data,
  });

  const { data: chatbot } = useQuery({
    queryKey: ['chatbot-analytics', period],
    queryFn: () => analyticsAPI.getChatbot(period),
    select: (response) => response.data.data,
  });

  const kpis = dash?.kpis || {};
  const topServices = dash?.topServices || [];
  const statusDist = dash?.statusDistribution || [];
  const sourceDist = dash?.sourceDistribution || [];
  const rev = (revenueData || []).map((row) => ({ date: row._id?.slice(5) || row._id, revenue: row.revenue, count: row.count }));
  const chatbotKpis = chatbot?.kpis || {};
  const chatbotTrend = (chatbot?.trend || []).map((row) => ({
    date: row._id?.slice(5) || row._id,
    botMessages: row.botMessages,
    failed: row.failed,
    bookings: row.bookings,
  }));
  const stageDropoff = (chatbot?.stageDropoff || []).map((row) => ({ name: row._id, value: row.count }));

  return (
    <div className="h-full overflow-y-auto bg-ink-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-slate-900">Analytics</h1>
          <p className="text-xs text-stone-2 mt-1">Business performance and live chatbot funnel metrics</p>
        </div>
        <div className="flex gap-1 bg-ink-3 border border-ink-6 rounded-lg p-1">
          {['7d', '30d', '90d', '1y'].map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${period === item ? 'bg-ink-6 text-slate-900' : 'text-stone-2 hover:text-slate-900'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Month Appointments" value={kpis.monthAppointments ?? 0} color="#00E676" icon="Cal" delay={0} />
        <MetricCard label="Month Revenue" value={`Rs ${(kpis.monthRevenue || 0).toLocaleString()}`} color="#38BDF8" icon="Pay" delay={0.05} />
        <MetricCard label="Completion Rate" value={`${kpis.completionRate || 0}%`} color="#A78BFA" icon="Done" delay={0.1} />
        <MetricCard label="Growth" value={`${kpis.growthRate || 0}%`} color="#FBB040" icon="Up" delay={0.15} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm text-slate-900">Revenue Trend</h3>
          <span className="badge-em">{period}</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={rev}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#617484', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#38BDF8" strokeWidth={2} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-5 md:col-span-2">
          <h3 className="font-display font-bold text-sm text-slate-900 mb-4">Top Services by Bookings</h3>
          {topServices.length === 0 ? (
            <p className="text-stone-2 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topServices.map((service) => ({ name: service._id?.slice(0, 14) || 'Unknown', count: service.count, revenue: service.revenue }))}>
                <XAxis dataKey="name" tick={{ fill: '#617484', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Bookings" radius={[4, 4, 0, 0]}>
                  {topServices.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
          <h3 className="font-display font-bold text-sm text-slate-900 mb-4">Status Distribution</h3>
          {statusDist.length === 0 ? (
            <p className="text-stone-2 text-sm text-center py-8">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={statusDist.map((item) => ({ name: item._id, value: item.count }))} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                    {statusDist.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusDist.map((item, index) => (
                  <div key={item._id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} />
                      <span className="text-2xs text-mist-2 capitalize">{item._id}</span>
                    </div>
                    <span className="text-2xs font-mono font-bold text-slate-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900">Chatbot Analytics</h3>
            <p className="text-2xs text-stone-2 mt-1">Live metrics from bot replies, WhatsApp bookings, failures, and drop-off stages.</p>
          </div>
          <span className="badge-em">{period}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Bot Chats" value={chatbotKpis.botHandledChats ?? 0} hint="Contacts touched by bot" color="#00E676" icon="Bot" />
          <MetricCard label="Bot Messages" value={chatbotKpis.botMessagesSent ?? 0} hint="Outbound automated replies" color="#38BDF8" icon="Msg" />
          <MetricCard label="Bookings" value={chatbotKpis.bookingsCreated ?? 0} hint="Appointments from WhatsApp" color="#A78BFA" icon="Book" />
          <MetricCard label="Delivery Rate" value={`${chatbotKpis.deliveryRate ?? 0}%`} hint={`${chatbotKpis.failedDeliveries ?? 0} failed`} color="#2DD4BF" icon="Ok" />
          <MetricCard label="Conversion" value={`${chatbotKpis.bookingConversionRate ?? 0}%`} hint={`Avg reply ${chatbotKpis.avgResponseSeconds ?? 0}s`} color="#FBB040" icon="Flow" />
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
            <h4 className="font-display font-bold text-sm text-slate-900 mb-3">Bot Funnel Trend</h4>
            {chatbotTrend.length === 0 ? (
              <p className="text-sm text-stone-2 py-10 text-center">No chatbot activity in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chatbotTrend}>
                  <defs>
                    <linearGradient id="botMsgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E676" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#617484', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="botMessages" name="Bot Messages" stroke="#00E676" strokeWidth={2} fill="url(#botMsgGrad)" />
                  <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#A78BFA" strokeWidth={2} fill="url(#bookingGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
            <h4 className="font-display font-bold text-sm text-slate-900 mb-3">Drop-off Stages</h4>
            {stageDropoff.length === 0 ? (
              <p className="text-sm text-stone-2 py-10 text-center">No active drop-offs right now.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stageDropoff}>
                    <XAxis dataKey="name" tick={{ fill: '#617484', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Contacts" radius={[4, 4, 0, 0]}>
                      {stageDropoff.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {stageDropoff.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-2xs">
                      <div className="flex items-center gap-2 text-stone-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} />
                        <span>{item.name.replaceAll('_', ' ')}</span>
                      </div>
                      <span className="font-mono text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
            <h4 className="font-display font-bold text-sm text-slate-900 mb-3">Booking Sources</h4>
            {sourceDist.length === 0 ? (
              <p className="text-sm text-stone-2">No booking source data yet.</p>
            ) : (
              <div className="space-y-2">
                {sourceDist.map((item, index) => (
                  <div key={item._id} className="flex items-center justify-between rounded-xl bg-ink-2 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} />
                      <span className="text-sm text-slate-900 capitalize">{item._id}</span>
                    </div>
                    <span className="text-2xs font-mono text-stone-2">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
            <h4 className="font-display font-bold text-sm text-slate-900 mb-3">Action Notes</h4>
            <div className="space-y-2 text-sm text-stone-2">
              <div>Delivery failures usually mean an expired Meta token or phone number restrictions.</div>
              <div>High drop-off at `awaiting_service` means the welcome/menu copy should be clearer.</div>
              <div>High drop-off at `awaiting_time` often means business hours or availability need tuning.</div>
              <div>Conversion rate compares WhatsApp bookings to contacts handled by the bot.</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

