import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { appointmentsAPI, contactsAPI, staffAPI, servicesAPI } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';

const STATUSES = ['pending','confirmed','checked_in','completed','cancelled','no_show'];
const STATUS_META = {
  pending:    { label: 'Pending',    cls: 'badge-amber' },
  confirmed:  { label: 'Confirmed',  cls: 'badge-sky' },
  checked_in: { label: 'Checked In', cls: 'bg-teal/10 text-teal border border-teal/30 inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold' },
  completed:  { label: 'Completed',  cls: 'badge-em' },
  cancelled:  { label: 'Cancelled',  cls: 'badge-rose' },
  no_show:    { label: 'No Show',    cls: 'badge-violet' },
};

function BookingModal({ onClose, contacts, staff, services }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ contactId:'', serviceId:'', staffId:'', scheduledAt:'', notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const createMut = useMutation({
    mutationFn: () => appointmentsAPI.create({ ...form, source: 'staff' }),
    onSuccess: () => { qc.invalidateQueries(['appointments']); toast.success('Appointment booked!'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to book'),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card p-7 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display font-extrabold text-xl text-slate-900 mb-1">Book Appointment</h2>
        <p className="text-sm text-stone-2 mb-5">Schedule a new appointment for a client</p>

        <div className="space-y-4">
          <div>
            <label className="label">Client *</label>
            <select className="input" value={form.contactId} onChange={e=>set('contactId',e.target.value)} required>
              <option value="">Select client...</option>
              {contacts.map(c=><option key={c._id} value={c._id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Service *</label>
            <select className="input" value={form.serviceId} onChange={e=>set('serviceId',e.target.value)} required>
              <option value="">Select service...</option>
              {services.map(s=><option key={s._id} value={s._id}>{s.name} — ₹{s.price} ({s.duration}m)</option>)}
            </select>
          </div>
          <div>
            <label className="label">Staff</label>
            <select className="input" value={form.staffId} onChange={e=>set('staffId',e.target.value)}>
              <option value="">Any available</option>
              {staff.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date & Time *</label>
            <input type="datetime-local" className="input" value={form.scheduledAt} onChange={e=>set('scheduledAt',e.target.value)} required />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Any special notes..." value={form.notes} onChange={e=>set('notes',e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button
            className="btn-em flex-1 justify-center"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.contactId || !form.serviceId || !form.scheduledAt}
          >
            {createMut.isPending ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Appointments() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ status: '', page: 1 });
  const setF = (k,v) => setFilters(f=>({...f,[k]:v,page:1}));

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', filters],
    queryFn: () => appointmentsAPI.getAll(filters),
    select: d => d.data,
  });

  const { data: contactsData } = useQuery({ queryKey:['contacts-all'], queryFn:()=>contactsAPI.getAll({limit:200}), select:d=>d.data.data });
  const { data: staffData } = useQuery({ queryKey:['staff'], queryFn:()=>staffAPI.getAll(), select:d=>d.data.data });
  const { data: servicesData } = useQuery({ queryKey:['services'], queryFn:()=>servicesAPI.getAll(), select:d=>d.data.data });

  useSocket((event) => {
    if (event === 'new_appointment' || event === 'appointment_updated') {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    }
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => appointmentsAPI.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['appointments']); toast.success('Status updated'); },
  });

  const apts = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="topbar flex-shrink-0">
        <div>
          <h1 className="font-display font-extrabold text-xl text-slate-900">Appointments</h1>
          <p className="text-xs text-stone-2 mt-0.5">Manage and track all bookings</p>
        </div>
        <button className="btn-em" onClick={() => setShowModal(true)}>+ Book Appointment</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 bg-ink-2 border-b border-ink-6 flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setF('status','')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${!filters.status ? 'bg-em/10 text-em border border-em/30' : 'bg-ink-4 border border-ink-6 text-stone-2 hover:text-slate-900'}`}
        >
          All
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setF('status', s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${filters.status===s ? 'bg-em/10 text-em border border-em/30' : 'bg-ink-4 border border-ink-6 text-stone-2 hover:text-slate-900'}`}
          >
            {STATUS_META[s]?.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-ink-6 border-t-em rounded-full animate-spin" />
          </div>
        ) : apts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-stone-2 text-sm">No appointments found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-ink-2 border-b border-ink-6">
              <tr>
                {['Client','Service','Staff','Date & Time','Price','Status','Source','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-2xs font-bold text-stone-2 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-6">
              {apts.map((apt, i) => {
                const st = STATUS_META[apt.status] || STATUS_META.pending;
                return (
                  <motion.tr
                    key={apt._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-ink-4/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet/40 to-sky/40 flex items-center justify-center text-xs font-bold text-slate-900 flex-shrink-0">
                          {apt.contact?.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{apt.contact?.name}</div>
                          <div className="text-2xs font-mono text-stone-2">{apt.contact?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-mist-2">{apt.serviceName}</div>
                      <div className="text-2xs text-stone-2">{apt.serviceDuration}m</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-mist-2">{apt.staff?.name || <span className="text-stone-1 text-xs">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono text-slate-900">{format(new Date(apt.scheduledAt), 'MMM d, yyyy')}</div>
                      <div className="text-2xs font-mono text-stone-2">{format(new Date(apt.scheduledAt), 'HH:mm')}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">₹{(apt.servicePrice||0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <select
                        value={apt.status}
                        onChange={e => updateStatus.mutate({ id: apt._id, status: e.target.value })}
                        className={`text-2xs font-bold rounded-full px-2 py-0.5 border cursor-pointer bg-transparent focus:outline-none ${
                          apt.status === 'completed' ? 'text-em border-em/30 bg-em/10' :
                          apt.status === 'pending' ? 'text-amber border-amber/30 bg-amber/10' :
                          apt.status === 'cancelled' ? 'text-rose border-rose/30 bg-rose/10' :
                          apt.status === 'confirmed' ? 'text-sky border-sky/30 bg-sky/10' :
                          'text-stone-2 border-stone-2/30'
                        }`}
                      >
                        {STATUSES.map(s => <option key={s} value={s} className="bg-ink-3 text-slate-900">{STATUS_META[s]?.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{apt.source === 'whatsapp' ? '📱' : apt.source === 'web' ? '🌐' : '📞'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateStatus.mutate({ id: apt._id, status: 'cancelled' })}
                        className="text-2xs text-stone-2 hover:text-rose transition-colors"
                        disabled={apt.status === 'cancelled'}
                      >
                        Cancel
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-ink-6 bg-ink-2 flex-shrink-0">
          <span className="text-xs text-stone-2">{pagination.total} appointments</span>
          <div className="flex gap-2">
            <button disabled={filters.page <= 1} onClick={() => setFilters(f=>({...f,page:f.page-1}))} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30">← Prev</button>
            <span className="text-xs text-mist-2 flex items-center px-3">{filters.page} / {pagination.pages}</span>
            <button disabled={filters.page >= pagination.pages} onClick={() => setFilters(f=>({...f,page:f.page+1}))} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30">Next →</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <BookingModal
            onClose={() => setShowModal(false)}
            contacts={contactsData || []}
            staff={staffData || []}
            services={servicesData || []}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

