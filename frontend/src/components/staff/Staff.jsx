import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { staffAPI, servicesAPI } from '../../api';
import toast from 'react-hot-toast';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const COLORS = ['#00E676','#38BDF8','#A78BFA','#FBB040','#2DD4BF','#FB7185','#F472B6'];

function StaffModal({ staff, services, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!staff?._id;
  const [form, setForm] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    email: staff?.email || '',
    role: staff?.role || 'stylist',
    specializations: staff?.specializations?.join(', ') || '',
    color: staff?.color || '#00E676',
    workStart: staff?.workStart || '09:00',
    workEnd: staff?.workEnd || '18:00',
    workingDays: staff?.workingDays || ['monday','tuesday','wednesday','thursday','friday'],
    services: staff?.services?.map(s => s._id || s) || [],
    isActive: staff?.isActive !== false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDay = (d) => set('workingDays', form.workingDays.includes(d) ? form.workingDays.filter(x => x !== d) : [...form.workingDays, d]);
  const toggleService = (id) => set('services', form.services.includes(id) ? form.services.filter(x => x !== id) : [...form.services, id]);

  const mut = useMutation({
    mutationFn: () => {
      const payload = { ...form, specializations: form.specializations.split(',').map(s => s.trim()).filter(Boolean) };
      return isEdit ? staffAPI.update(staff._id, payload) : staffAPI.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries(['staff']); toast.success(isEdit ? 'Staff updated' : 'Staff member added'); onClose(); },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display font-extrabold text-xl text-slate-900 mb-5">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ananya Mehta" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ananya@salon.com" />
            </div>
            <div>
              <label className="label">Role / Title</label>
              <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Senior Stylist" />
            </div>
            <div>
              <label className="label">Calendar Color</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => set('color', c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Specializations</label>
            <input className="input" value={form.specializations} onChange={e => set('specializations', e.target.value)} placeholder="Hair Color, Keratin, Bridal Makeup" />
          </div>

          {/* Working hours */}
          <div className="border-t border-ink-6 pt-4">
            <p className="text-2xs font-bold text-stone-2 uppercase tracking-wider mb-3">Working Hours</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="label">Start Time</label>
                <input type="time" className="input" value={form.workStart} onChange={e => set('workStart', e.target.value)} />
              </div>
              <div>
                <label className="label">End Time</label>
                <input type="time" className="input" value={form.workEnd} onChange={e => set('workEnd', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {DAYS.map(d => (
                <button key={d} onClick={() => toggleDay(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    form.workingDays.includes(d) ? 'bg-em/10 border-em/30 text-em' : 'bg-ink-5 border-ink-7 text-stone-2 hover:text-slate-900'
                  }`}>
                  {d.slice(0,3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Services */}
          {services?.length > 0 && (
            <div className="border-t border-ink-6 pt-4">
              <p className="text-2xs font-bold text-stone-2 uppercase tracking-wider mb-3">Assigned Services</p>
              <div className="flex flex-wrap gap-2">
                {services.map(s => (
                  <button key={s._id} onClick={() => toggleService(s._id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      form.services.includes(s._id) ? 'bg-em/10 border-em/30 text-em' : 'bg-ink-5 border-ink-7 text-stone-2 hover:text-slate-900'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => set('isActive', !form.isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-em' : 'bg-ink-6'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-mist-2">{form.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="btn-em flex-1 justify-center" onClick={() => mut.mutate()} disabled={mut.isPending || !form.name}>
            {mut.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Staff() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data: staffData, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: staffAPI.getAll,
    select: d => d.data.data,
  });

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: servicesAPI.getAll,
    select: d => d.data.data,
  });

  const deleteMut = useMutation({
    mutationFn: staffAPI.delete,
    onSuccess: () => { qc.invalidateQueries(['staff']); toast.success('Staff member removed'); },
  });

  const staff = staffData || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="topbar flex-shrink-0">
        <div>
          <h1 className="font-display font-extrabold text-xl text-slate-900">Staff Management</h1>
          <p className="text-xs text-stone-2 mt-0.5">{staff.length} team members</p>
        </div>
        <button className="btn-em" onClick={() => setModal('add')}>+ Add Staff</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-ink-6 border-t-em rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-5xl mb-4">👤</div>
            <p className="text-stone-2 text-sm mb-4">No staff members yet</p>
            <button className="btn-em" onClick={() => setModal('add')}>Add your first staff member</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((s, i) => (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-5 hover:border-ink-7 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-slate-900 flex-shrink-0 shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${s.color || '#00E676'}40, ${s.color || '#00E676'}20)`, border: `1.5px solid ${s.color || '#00E676'}40` }}>
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{s.name}</h3>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isActive ? 'bg-em' : 'bg-stone-2'}`} />
                    </div>
                    <div className="text-2xs text-stone-2 mt-0.5">{s.role}</div>
                    {s.phone && <div className="text-2xs font-mono text-stone-1 mt-0.5">{s.phone}</div>}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-ink-5 rounded-lg border border-ink-6">
                  <div className="text-center">
                    <div className="font-display font-bold text-sm" style={{ color: s.color || '#00E676' }}>{s.totalAppointments || 0}</div>
                    <div className="text-2xs text-stone-2">Apts</div>
                  </div>
                  <div className="text-center border-x border-ink-6">
                    <div className="font-display font-bold text-sm text-amber">{s.rating?.toFixed(1) || '—'}</div>
                    <div className="text-2xs text-stone-2">Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-sm text-sky">{s.totalReviews || 0}</div>
                    <div className="text-2xs text-stone-2">Reviews</div>
                  </div>
                </div>

                {/* Specializations */}
                {s.specializations?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.specializations.slice(0, 3).map(sp => (
                      <span key={sp} className="px-2 py-0.5 bg-ink-5 border border-ink-7 rounded-full text-2xs text-mist-2">{sp}</span>
                    ))}
                    {s.specializations.length > 3 && <span className="text-2xs text-stone-2">+{s.specializations.length - 3}</span>}
                  </div>
                )}

                {/* Working days */}
                <div className="flex gap-1 mb-4">
                  {DAYS.map(d => (
                    <div key={d}
                      className={`w-6 h-6 rounded flex items-center justify-center text-2xs font-bold ${
                        s.workingDays?.includes(d) ? 'text-slate-900' : 'text-stone-1 bg-ink-6'
                      }`}
                      style={s.workingDays?.includes(d) ? { background: `${s.color || '#00E676'}30`, color: s.color || '#00E676' } : {}}>
                      {d[0].toUpperCase()}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-2xs text-stone-2 mb-3">
                  <span className="font-mono">{s.workStart} – {s.workEnd}</span>
                  {s.services?.length > 0 && <span>{s.services.length} services</span>}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setModal(s)} className="btn-ghost flex-1 justify-center text-xs py-1.5">Edit</button>
                  <button
                    onClick={() => window.confirm(`Remove ${s.name}?`) && deleteMut.mutate(s._id)}
                    className="text-stone-2 hover:text-rose transition-colors px-3 py-1.5 rounded-lg hover:bg-rose/10 border border-transparent hover:border-rose/20"
                  >
                    🗑
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal && (
          <StaffModal
            staff={modal === 'add' ? null : modal}
            services={services || []}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

