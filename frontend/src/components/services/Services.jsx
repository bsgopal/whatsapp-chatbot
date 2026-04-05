import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { servicesAPI } from '../../api';
import toast from 'react-hot-toast';

const CATEGORIES = ['Hair','Skin','Nails','Massage','Makeup','Medical','Dental','Fitness','Education','Automotive','Other'];
const SERVICE_COLORS = ['#00E676','#38BDF8','#A78BFA','#FBB040','#2DD4BF','#FB7185','#F472B6','#34D399'];

function ServiceModal({ service, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!service?._id;
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || 'Hair',
    price: service?.price || '',
    discountedPrice: service?.discountedPrice || '',
    duration: service?.duration || 30,
    color: service?.color || '#00E676',
    isActive: service?.isActive !== false,
    isPopular: service?.isPopular || false,
    availableForOnline: service?.availableForOnline !== false,
    tags: service?.tags?.join(', ') || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => {
      const payload = { ...form, price: Number(form.price), discountedPrice: form.discountedPrice ? Number(form.discountedPrice) : undefined, duration: Number(form.duration), tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      return isEdit ? servicesAPI.update(service._id, payload) : servicesAPI.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries(['services']); toast.success(isEdit ? 'Service updated' : 'Service created'); onClose(); },
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
        <h2 className="font-display font-extrabold text-xl text-white mb-5">{isEdit ? 'Edit Service' : 'Create Service'}</h2>

        <div className="space-y-4">
          <div>
            <label className="label">Service Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Women's Haircut & Style" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of this service..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Duration (minutes) *</label>
              <input type="number" className="input" value={form.duration} onChange={e => set('duration', e.target.value)} min={5} step={5} />
            </div>
            <div>
              <label className="label">Price (₹) *</label>
              <input type="number" className="input" value={form.price} onChange={e => set('price', e.target.value)} min={0} placeholder="500" />
            </div>
            <div>
              <label className="label">Discounted Price (₹)</label>
              <input type="number" className="input" value={form.discountedPrice} onChange={e => set('discountedPrice', e.target.value)} min={0} placeholder="Leave blank if no discount" />
            </div>
          </div>

          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {SERVICE_COLORS.map(c => (
                <button key={c} onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="bridal, premium, trending" />
          </div>

          {/* Toggles */}
          <div className="border-t border-ink-6 pt-4 space-y-3">
            {[
              { key: 'isActive', label: 'Service Active' },
              { key: 'isPopular', label: 'Mark as Popular' },
              { key: 'availableForOnline', label: 'Available for Online Booking' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-mist-2">{label}</span>
                <button onClick={() => set(key, !form[key])}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form[key] ? 'bg-em' : 'bg-ink-6'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="btn-em flex-1 justify-center" onClick={() => mut.mutate()} disabled={mut.isPending || !form.name || !form.price || !form.duration}>
            {mut.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Service'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Services() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [filterCat, setFilterCat] = useState('');

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: servicesAPI.getAll,
    select: d => d.data.data,
  });

  const deleteMut = useMutation({
    mutationFn: servicesAPI.delete,
    onSuccess: () => { qc.invalidateQueries(['services']); toast.success('Service deleted'); },
  });

  const allServices = servicesData || [];
  const services = filterCat ? allServices.filter(s => s.category === filterCat) : allServices;
  const cats = [...new Set(allServices.map(s => s.category).filter(Boolean))];
  const totalRevenue = allServices.reduce((a, s) => a + (s.totalRevenue || 0), 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="topbar flex-shrink-0">
        <div>
          <h1 className="font-display font-extrabold text-xl text-white">Services</h1>
          <p className="text-xs text-stone-2 mt-0.5">{allServices.length} services · ₹{totalRevenue.toLocaleString()} total revenue</p>
        </div>
        <button className="btn-em" onClick={() => setModal('add')}>+ Create Service</button>
      </div>

      {/* Category filters */}
      {cats.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 bg-ink-2 border-b border-ink-6 flex-shrink-0 overflow-x-auto">
          <button onClick={() => setFilterCat('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${!filterCat ? 'bg-em/10 text-em border border-em/30' : 'bg-ink-4 border border-ink-6 text-stone-2 hover:text-white'}`}>
            All ({allServices.length})
          </button>
          {cats.map(c => (
            <button key={c} onClick={() => setFilterCat(c === filterCat ? '' : c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${filterCat === c ? 'bg-em/10 text-em border border-em/30' : 'bg-ink-4 border border-ink-6 text-stone-2 hover:text-white'}`}>
              {c} ({allServices.filter(s => s.category === c).length})
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-ink-6 border-t-em rounded-full animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-5xl mb-4">✂️</div>
            <p className="text-stone-2 text-sm mb-4">No services yet</p>
            <button className="btn-em" onClick={() => setModal('add')}>Create your first service</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {services.map((svc, i) => (
              <motion.div
                key={svc._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-5 flex flex-col hover:border-ink-7 transition-colors group"
              >
                {/* Color strip */}
                <div className="h-1 rounded-full mb-4" style={{ background: `linear-gradient(90deg, ${svc.color || '#00E676'}, ${svc.color || '#00E676'}50)` }} />

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-sm font-bold text-white truncate">{svc.name}</h3>
                      {svc.isPopular && <span className="text-amber text-xs" title="Popular">⭐</span>}
                    </div>
                    {svc.category && (
                      <span className="px-2 py-0.5 bg-ink-5 border border-ink-7 rounded-full text-2xs text-stone-2">{svc.category}</span>
                    )}
                  </div>
                  {!svc.isActive && <span className="text-2xs text-rose font-mono ml-2 flex-shrink-0">inactive</span>}
                </div>

                {svc.description && (
                  <p className="text-2xs text-stone-2 mb-3 line-clamp-2 leading-relaxed">{svc.description}</p>
                )}

                {/* Price & duration */}
                <div className="flex items-center justify-between mb-3 mt-auto">
                  <div>
                    <span className="font-display font-extrabold text-lg" style={{ color: svc.color || '#00E676' }}>
                      ₹{(svc.discountedPrice || svc.price || 0).toLocaleString()}
                    </span>
                    {svc.discountedPrice && svc.discountedPrice < svc.price && (
                      <span className="text-xs text-stone-1 line-through ml-1.5">₹{svc.price.toLocaleString()}</span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-stone-2 bg-ink-5 px-2 py-0.5 rounded">{svc.duration}m</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-ink-5 rounded-lg border border-ink-6 mb-4 text-center">
                  <div>
                    <div className="font-mono font-bold text-xs text-white">{svc.bookingsCount || 0}</div>
                    <div className="text-2xs text-stone-2">Bookings</div>
                  </div>
                  <div>
                    <div className="font-mono font-bold text-xs text-sky">₹{(svc.totalRevenue || 0).toLocaleString()}</div>
                    <div className="text-2xs text-stone-2">Revenue</div>
                  </div>
                </div>

                {/* Tags */}
                {svc.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {svc.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-ink-5 rounded text-2xs text-stone-2">{t}</span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setModal(svc)} className="btn-ghost flex-1 justify-center text-xs py-1.5">Edit</button>
                  <button
                    onClick={() => window.confirm(`Delete "${svc.name}"?`) && deleteMut.mutate(svc._id)}
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
        {modal && <ServiceModal service={modal === 'add' ? null : modal} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
