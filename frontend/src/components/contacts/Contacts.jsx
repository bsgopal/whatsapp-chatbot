import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { contactsAPI } from '../../api';
import toast from 'react-hot-toast';

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

function ContactModal({ contact, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!contact?._id;
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    gender: contact?.gender || 'unknown',
    notes: contact?.notes || '',
    tags: contact?.tags?.join(', ') || '',
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        email: form.email.trim(),
        notes: form.notes.trim(),
        tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean),
      };
      return isEdit ? contactsAPI.update(contact._id, payload) : contactsAPI.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(isEdit ? 'Contact updated' : 'Contact added');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  const canSave = form.name.trim() && normalizePhone(form.phone);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card p-7 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave || mut.isPending) return;
            mut.mutate();
          }}
        >
        <h2 className="font-display font-extrabold text-xl text-white mb-5">{isEdit ? 'Edit Contact' : 'Add Contact'}</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Priya Sharma" required />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input className="input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 98765 43210" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="priya@email.com" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={e=>set('gender',e.target.value)}>
                {['unknown','female','male','other'].map(g=><option key={g} value={g}>{g.charAt(0).toUpperCase()+g.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tags</label>
              <input className="input" value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="vip, regular, new" />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any special notes about this client..." />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-em flex-1 justify-center" disabled={mut.isPending || !canSave}>
            {mut.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function Contacts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | contact obj
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, page],
    queryFn: () => contactsAPI.getAll({ search, page, limit: 20 }),
    select: d => d.data,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => contactsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact deleted'); },
  });

  const contacts = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="topbar flex-shrink-0">
        <div>
          <h1 className="font-display font-extrabold text-xl text-white">Contacts</h1>
          <p className="text-xs text-stone-2 mt-0.5">{pagination.total || 0} clients in your CRM</p>
        </div>
        <button className="btn-em" onClick={() => setModal('add')}>+ Add Contact</button>
      </div>

      <div className="px-6 py-3 bg-ink-2 border-b border-ink-6 flex-shrink-0">
        <input
          className="input max-w-sm"
          placeholder="🔍  Search by name or phone..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-ink-6 border-t-em rounded-full animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-stone-2">No contacts found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {contacts.map((c, i) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card p-4 hover:border-ink-7 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet/40 to-sky/50 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {c.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white truncate">{c.name}</h3>
                      {c.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-em flex-shrink-0" />}
                    </div>
                    <div className="text-2xs font-mono text-stone-2 mt-0.5">{c.phone}</div>
                    {c.email && <div className="text-2xs text-stone-2 truncate mt-0.5">{c.email}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-ink-6">
                  <div className="text-center">
                    <div className="font-display font-bold text-sm text-em">{c.totalAppointments || 0}</div>
                    <div className="text-2xs text-stone-2">Appointments</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-sm text-sky">₹{(c.totalSpent || 0).toLocaleString()}</div>
                    <div className="text-2xs text-stone-2">Total Spent</div>
                  </div>
                </div>

                {c.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.tags.slice(0,3).map(t=>(
                      <span key={t} className="px-2 py-0.5 bg-ink-5 border border-ink-7 rounded-full text-2xs text-mist-2">{t}</span>
                    ))}
                  </div>
                )}

                {c.lastVisit && (
                  <div className="text-2xs text-stone-1 font-mono mt-2">Last visit: {format(new Date(c.lastVisit), 'MMM d, yyyy')}</div>
                )}

                <div className="flex gap-2 mt-3">
                  <button onClick={() => setModal(c)} className="btn-ghost flex-1 justify-center text-xs py-1.5">Edit</button>
                  <button
                    onClick={() => window.confirm('Delete contact?') && deleteMut.mutate(c._id)}
                    className="text-stone-2 hover:text-rose transition-colors px-2 py-1.5 rounded-lg hover:bg-rose/10 border border-transparent hover:border-rose/20"
                  >
                    🗑
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-ink-6 bg-ink-2 flex-shrink-0">
          <span className="text-xs text-stone-2">{pagination.total} contacts</span>
          <div className="flex gap-2">
            <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30">← Prev</button>
            <span className="text-xs text-mist-2 flex items-center px-3">{page} / {pagination.pages}</span>
            <button disabled={page>=pagination.pages} onClick={()=>setPage(p=>p+1)} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-30">Next →</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && <ContactModal contact={modal === 'add' ? null : modal} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
