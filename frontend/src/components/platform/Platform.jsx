import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformAPI } from '../../api';
import toast from 'react-hot-toast';

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
      <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">{label}</div>
      <div className="mt-2 text-2xl font-display font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-2xs text-stone-2">{hint}</div> : null}
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Platform() {
  const qc = useQueryClient();
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [newClient, setNewClient] = useState({
    clientName: '',
    businessName: '',
    category: 'salon',
    phone: '',
    email: '',
    password: '',
    durationDays: 30,
    plan: 'starter',
    notes: '',
  });
  const [licenseUpdate, setLicenseUpdate] = useState({ durationDays: 30, status: 'active', plan: 'starter', notes: '' });

  const { data: clientsData } = useQuery({
    queryKey: ['platform-clients'],
    queryFn: platformAPI.getClients,
    select: (response) => response.data.data,
  });

  const clients = clientsData || [];

  useEffect(() => {
    if (!selectedBusinessId && clients[0]?._id) {
      setSelectedBusinessId(clients[0]._id);
    }
  }, [clients, selectedBusinessId]);

  const { data: selectedClientData } = useQuery({
    queryKey: ['platform-client-details', selectedBusinessId],
    queryFn: () => platformAPI.getClientDetails(selectedBusinessId),
    select: (response) => response.data.data,
    enabled: !!selectedBusinessId,
  });

  const createClientMut = useMutation({
    mutationFn: platformAPI.createClient,
    onSuccess: () => {
      toast.success('Client created with active license');
      qc.invalidateQueries({ queryKey: ['platform-clients'] });
      setNewClient({
        clientName: '',
        businessName: '',
        category: 'salon',
        phone: '',
        email: '',
        password: '',
        durationDays: 30,
        plan: 'starter',
        notes: '',
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create client');
    },
  });

  const renewLicenseMut = useMutation({
    mutationFn: ({ businessId, payload }) => platformAPI.updateLicense(businessId, payload),
    onSuccess: () => {
      toast.success('License updated');
      qc.invalidateQueries({ queryKey: ['platform-clients'] });
      qc.invalidateQueries({ queryKey: ['platform-client-details', selectedBusinessId] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update license');
    },
  });

  const totals = useMemo(() => ({
    clients: clients.length,
    active: clients.filter((item) => item.license?.status === 'active').length,
    expired: clients.filter((item) => item.license?.status === 'expired').length,
    unread: clients.reduce((sum, item) => sum + (item.unreadMessageCount || 0), 0),
  }), [clients]);

  const selectedBusiness = selectedClientData?.business;

  useEffect(() => {
    if (selectedBusiness) {
      setLicenseUpdate({
        durationDays: 30,
        status: selectedBusiness.license?.status || 'active',
        plan: selectedBusiness.subscription?.plan || 'starter',
        notes: selectedBusiness.license?.notes || '',
      });
    }
  }, [selectedBusiness]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-80 flex-shrink-0 border-r border-ink-6 bg-ink-2 p-4 overflow-y-auto">
        <div className="rounded-2xl border border-em/20 bg-em/5 p-4">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">Platform Owner</div>
          <div className="mt-2 text-lg font-display font-bold text-slate-900">Client Control Center</div>
          <div className="mt-1 text-xs text-stone-2">Create clients, issue licenses, and inspect every business from one place.</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard label="Clients" value={totals.clients} />
          <StatCard label="Active" value={totals.active} />
          <StatCard label="Expired" value={totals.expired} />
          <StatCard label="Unread" value={totals.unread} />
        </div>

        <div className="mt-6 rounded-2xl border border-ink-6 bg-ink-3 p-4">
          <div className="text-sm font-semibold text-slate-900">Create Client</div>
          <div className="mt-3 space-y-3">
            <input className="input" placeholder="Client owner name" value={newClient.clientName} onChange={(e) => setNewClient((current) => ({ ...current, clientName: e.target.value }))} />
            <input className="input" placeholder="Business name" value={newClient.businessName} onChange={(e) => setNewClient((current) => ({ ...current, businessName: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Phone" value={newClient.phone} onChange={(e) => setNewClient((current) => ({ ...current, phone: e.target.value }))} />
              <input className="input" type="email" placeholder="Email" value={newClient.email} onChange={(e) => setNewClient((current) => ({ ...current, email: e.target.value }))} />
            </div>
            <input className="input" type="password" placeholder="Temporary password" value={newClient.password} onChange={(e) => setNewClient((current) => ({ ...current, password: e.target.value }))} />
            <div className="grid grid-cols-3 gap-3">
              <select className="input" value={newClient.category} onChange={(e) => setNewClient((current) => ({ ...current, category: e.target.value }))}>
                {['salon', 'medical', 'automotive', 'education', 'fitness', 'spa', 'dental', 'legal', 'other'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select className="input" value={newClient.plan} onChange={(e) => setNewClient((current) => ({ ...current, plan: e.target.value }))}>
                {['starter', 'pro', 'enterprise'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input className="input" type="number" min={1} placeholder="Days" value={newClient.durationDays} onChange={(e) => setNewClient((current) => ({ ...current, durationDays: Number(e.target.value) }))} />
            </div>
            <textarea className="input resize-none" rows={3} placeholder="Internal notes" value={newClient.notes} onChange={(e) => setNewClient((current) => ({ ...current, notes: e.target.value }))} />
            <button className="btn-em w-full justify-center" onClick={() => createClientMut.mutate(newClient)} disabled={createClientMut.isPending}>
              {createClientMut.isPending ? 'Creating...' : 'Create Client + License'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Clients</div>
          <div className="mt-3 space-y-2">
            {clients.map((client) => {
              const isActive = selectedBusinessId === client._id;
              return (
                <button
                  key={client._id}
                  type="button"
                  onClick={() => setSelectedBusinessId(client._id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${isActive ? 'border-em/30 bg-em/8' : 'border-ink-6 bg-ink-3 hover:bg-ink-4'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{client.name}</div>
                      <div className="mt-1 text-2xs text-stone-2">{client.owner?.name || 'No owner'} · {client.subscription?.plan || 'starter'}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-2xs font-semibold ${client.license?.status === 'active' ? 'bg-em/10 text-em' : 'bg-rose-500/10 text-rose-300'}`}>
                      {client.license?.status || 'pending'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-2xs text-stone-2">
                    <span>{client.contactCount || 0} contacts</span>
                    <span>{client.appointmentCount || 0} appointments</span>
                    <span>{client.unreadMessageCount || 0} unread</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedClientData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.9fr] gap-6">
              <div className="card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">Client Workspace</div>
                    <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">{selectedBusiness?.name}</h2>
                    <div className="mt-1 text-sm text-stone-2">{selectedBusiness?.owner?.name} · {selectedBusiness?.owner?.phone} · {selectedBusiness?.owner?.email || 'No email'}</div>
                  </div>
                  <div className="rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3">
                    <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">License Key</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{selectedBusiness?.license?.key || 'Not assigned'}</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Contacts" value={selectedClientData.stats.contacts} />
                  <StatCard label="Staff" value={selectedClientData.stats.staff} />
                  <StatCard label="Services" value={selectedClientData.stats.services} />
                  <StatCard label="Messages" value={selectedClientData.stats.messages} />
                </div>
              </div>

              <div className="card p-6">
                <div className="text-base font-display font-bold text-slate-900">License Control</div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <StatCard label="Status" value={selectedBusiness?.license?.status || 'pending'} />
                  <StatCard label="Plan" value={selectedBusiness?.subscription?.plan || 'starter'} />
                  <StatCard label="Start" value={formatDate(selectedBusiness?.license?.startAt)} />
                  <StatCard label="End" value={formatDate(selectedBusiness?.license?.endAt)} />
                </div>

                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <input className="input" type="number" min={1} value={licenseUpdate.durationDays} onChange={(e) => setLicenseUpdate((current) => ({ ...current, durationDays: Number(e.target.value) }))} />
                    <select className="input" value={licenseUpdate.status} onChange={(e) => setLicenseUpdate((current) => ({ ...current, status: e.target.value }))}>
                      {['active', 'expired', 'pending', 'suspended'].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    <select className="input" value={licenseUpdate.plan} onChange={(e) => setLicenseUpdate((current) => ({ ...current, plan: e.target.value }))}>
                      {['starter', 'pro', 'enterprise'].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <textarea className="input resize-none" rows={3} value={licenseUpdate.notes} onChange={(e) => setLicenseUpdate((current) => ({ ...current, notes: e.target.value }))} placeholder="Renewal notes or payment notes" />
                  <button
                    className="btn-em w-full justify-center"
                    onClick={() => renewLicenseMut.mutate({ businessId: selectedBusinessId, payload: licenseUpdate })}
                    disabled={renewLicenseMut.isPending}
                  >
                    {renewLicenseMut.isPending ? 'Updating...' : 'Update License'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
              <div className="card p-6">
                <div className="text-base font-display font-bold text-slate-900">Client Activity</div>
                <div className="mt-4 space-y-3">
                  {selectedClientData.activity.slice(0, 30).map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="text-2xs font-mono text-stone-2">{new Date(item.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="mt-1 text-2xs uppercase tracking-[0.18em] text-em">{item.type}</div>
                      {item.meta ? <div className="mt-2 text-sm text-stone-2">{item.meta}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="card p-6">
                  <div className="text-base font-display font-bold text-slate-900">Recent Appointments</div>
                  <div className="mt-4 space-y-3">
                    {selectedClientData.appointments.slice(0, 10).map((item) => (
                      <div key={item._id} className="rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{item.contact?.name || 'Customer'} · {item.service?.name || item.serviceName}</div>
                        <div className="mt-1 text-2xs text-stone-2">{new Date(item.scheduledAt).toLocaleString('en-IN')} · {item.status}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-6">
                  <div className="text-base font-display font-bold text-slate-900">Recent Messages</div>
                  <div className="mt-4 space-y-3">
                    {selectedClientData.messages.slice(0, 10).map((item) => (
                      <div key={item._id} className="rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{item.contact?.name || 'Unknown'} · {item.direction}</div>
                        <div className="mt-1 text-sm text-stone-2 whitespace-pre-line">{item.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-6 text-sm text-stone-2">Select a client to inspect their full activity.</div>
        )}
      </div>
    </div>
  );
}

