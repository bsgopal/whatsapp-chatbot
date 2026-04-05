import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../../context/authStore';
import { notificationsAPI } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const NAV = [
  { path: '/', label: 'Dashboard', icon: '⊞', exact: true },
  { path: '/appointments', label: 'Appointments', icon: '📅' },
  { path: '/contacts', label: 'Contacts', icon: '👥' },
  { path: '/chat', label: 'WhatsApp Inbox', icon: '💬', badge: 'unread' },
  { path: '/analytics', label: 'Analytics', icon: '📊' },
  { path: '/staff', label: 'Staff', icon: '👤' },
  { path: '/services', label: 'Services', icon: '✂️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppShell() {
  const { user, business, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: notifsData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getAll({ limit: 10 }),
    select: (d) => d.data,
    refetchInterval: 30000,
  });

  useSocket((event, data) => {
    if (event === 'new_appointment') {
      toast.success(`New appointment booked!`, { icon: '📅' });
      refetchNotifs();
    }
    if (event === 'whatsapp_message') {
      toast(`New WhatsApp message from ${data.contact?.name}`, { icon: '💬' });
      refetchNotifs();
    }
  });

  const unreadCount = notifsData?.unreadCount || 0;
  const notifs = notifsData?.data || [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-1">
      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col bg-ink-2 border-r border-ink-6 flex-shrink-0 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-ink-6 min-h-[60px]">
          <div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-em to-teal flex items-center justify-center text-sm flex-shrink-0 cursor-pointer"
            style={{ animation: 'gemPulse 4s ease-in-out infinite', boxShadow: '0 0 0 1px rgba(0,230,118,.35), 0 4px 20px rgba(0,230,118,.18)' }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            📱
          </div>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="font-display font-bold text-sm text-white leading-tight">WA Appt OS</div>
              <div className="text-2xs font-mono font-semibold text-em tracking-wider">ENTERPRISE</div>
            </motion.div>
          )}
        </div>

        {/* Business badge */}
        {!sidebarCollapsed && business && (
          <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg bg-ink-4 border border-ink-6">
            <div className="text-2xs text-stone-2 font-mono uppercase tracking-wider mb-0.5">Business</div>
            <div className="text-xs font-semibold text-white truncate">{business.name}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-em dot-pulse flex-shrink-0" />
              <span className="text-2xs text-stone-2 capitalize">{business.subscription?.plan || 'starter'} plan</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map(({ path, label, icon, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-em/10 text-em cursor-pointer border-l-2 border-em'
                  : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-2 hover:bg-ink-5 hover:text-white cursor-pointer transition-colors'
              }
            >
              <span className="text-base flex-shrink-0 w-5 text-center">{icon}</span>
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-ink-6">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet to-sky flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
                <div className="text-2xs text-stone-2 capitalize">{user?.role}</div>
              </div>
              <button onClick={logout} className="text-stone-2 hover:text-rose transition-colors p-1 rounded" title="Logout">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={logout} className="w-full flex justify-center text-stone-2 hover:text-rose transition-colors p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 py-3 bg-ink-2 border-b border-ink-6 flex-shrink-0 h-[56px]">
          <div className="text-xs font-mono text-stone-2">
            {format(new Date(), 'EEE, MMM d yyyy')}
          </div>
          <div className="flex-1" />

          {/* WhatsApp status */}
          {business?.whatsapp?.isConnected && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-em/10 border border-em/30">
              <span className="w-1.5 h-1.5 rounded-full bg-em dot-pulse" />
              <span className="text-2xs font-semibold text-em font-mono">{business.whatsapp.connectedPhone}</span>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative w-8 h-8 rounded-lg bg-ink-4 border border-ink-6 flex items-center justify-center text-sm hover:bg-ink-5 transition-colors"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose text-white text-2xs font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 w-80 bg-ink-3 border border-ink-7 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-ink-6">
                    <span className="font-display font-bold text-sm text-white">Notifications</span>
                    <button
                      onClick={() => { notificationsAPI.markAllRead(); refetchNotifs(); }}
                      className="text-2xs text-em hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifs.length === 0 ? (
                    <div className="p-6 text-center text-stone-2 text-sm">No notifications</div>
                  ) : (
                    notifs.map((n) => (
                      <div key={n._id} className={`flex gap-3 px-4 py-3 border-b border-ink-6 cursor-pointer hover:bg-ink-4 transition-colors ${!n.isRead ? 'bg-ink-4/50' : ''}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: `${n.color}20` }}>
                          {n.icon || '📌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white">{n.title}</div>
                          <div className="text-2xs text-stone-2 mt-0.5">{n.message}</div>
                          <div className="text-2xs font-mono text-stone-1 mt-1">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</div>
                        </div>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-em flex-shrink-0 mt-1" />}
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet to-sky flex items-center justify-center text-xs font-bold text-white cursor-pointer" onClick={() => navigate('/settings')}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
