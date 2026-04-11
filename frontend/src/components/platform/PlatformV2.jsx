import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformAPI } from '../../api';
import toast from 'react-hot-toast';

function StatCard({ label, value, hint, tone = 'default' }) {
  const toneClass = tone === 'warn'
    ? 'border-amber/20 bg-amber/5'
    : tone === 'good'
      ? 'border-em/20 bg-em/5'
      : 'border-ink-6 bg-ink-3';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">{label}</div>
      <div className="mt-2 text-2xl font-display font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-2xs text-stone-2">{hint}</div> : null}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysLabel(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return 'No expiry';
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day(s) overdue`;
  if (daysRemaining === 0) return 'Expires today';
  return `${daysRemaining} day(s) left`;
}

export default function PlatformV2() {
  const qc = useQueryClient();
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [newClient, setNewClient] = useState({
    ownerName: '',
    shopName: '',
    category: 'salon',
    ownerPhone: '',
    adminPhone: '',
    email: '',
    adminPassword: '',
    durationValue: 30,
    durationUnit: 'day',
    plan: 'starter',
    notes: '',
    requestId: '',
  });
  const [licenseUpdate, setLicenseUpdate] = useState({
    durationValue: 30,
    durationUnit: 'day',
    status: 'active',
    plan: 'starter',
    notes: '',
  });

  const { data: overview } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: platformAPI.getOverview,
    select: (response) => response.data.data,
  });

  const { data: requests } = useQuery({
    queryKey: ['platform-license-requests'],
    queryFn: () => platformAPI.getLicenseRequests({ status: 'pending' }),
    select: (response) => response.data.data,
  });

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
    onSuccess: (response) => {
      toast.success('Client and license created');
      const createdBusinessId = response?.data?.data?.business?._id;
      if (createdBusinessId) {
        setSelectedBusinessId(createdBusinessId);
      }
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-clients'] });
      qc.invalidateQueries({ queryKey: ['platform-license-requests'] });
      setNewClient({
        ownerName: '',
        shopName: '',
        category: 'salon',
        ownerPhone: '',
        adminPhone: '',
        email: '',
        adminPassword: '',
        durationValue: 30,
        durationUnit: 'day',
        plan: 'starter',
        notes: '',
        requestId: '',
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create client');
    },
  });

  const updateLicenseMut = useMutation({
    mutationFn: ({ businessId, payload }) => platformAPI.updateLicense(businessId, payload),
    onSuccess: () => {
      toast.success('License updated');
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-clients'] });
      qc.invalidateQueries({ queryKey: ['platform-client-details', selectedBusinessId] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update license');
    },
  });

  const updateRequestMut = useMutation({
    mutationFn: ({ requestId, payload }) => platformAPI.updateLicenseRequest(requestId, payload),
    onSuccess: () => {
      toast.success('Request updated');
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-license-requests'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update request');
    },
  });

  const selectedBusiness = selectedClientData?.business;

  useEffect(() => {
    if (selectedBusiness) {
      setLicenseUpdate({
        durationValue: selectedBusiness.license?.lastDurationValue || 30,
        durationUnit: selectedBusiness.license?.lastDurationUnit || 'day',
        status: selectedBusiness.license?.status || 'active',
        plan: selectedBusiness.subscription?.plan || 'starter',
        notes: selectedBusiness.license?.notes || '',
      });
    }
  }, [selectedBusiness]);

  const requestList = requests || [];
  const alerts = overview?.expiringAlerts || [];
  const counts = overview?.counts || {
    totalClients: clients.length,
    activeClients: 0,
    expiredClients: 0,
    expiringSoon: 0,
    pendingRequests: requestList.length,
  };

  const fillFromRequest = (request) => {
    setNewClient((current) => ({
      ...current,
      ownerName: request.ownerName || '',
      shopName: request.shopName || '',
      ownerPhone: request.phone || '',
      adminPhone: request.phone || '',
      email: request.email || '',
      plan: request.preferredPlan || current.plan,
      requestId: request._id,
    }));
    toast.success('Request details copied into the create-client form');
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const aDays = a.licenseSummary?.daysRemaining ?? 9999;
      const bDays = b.licenseSummary?.daysRemaining ?? 9999;
      return aDays - bDays;
    });
  }, [clients]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-[26rem] flex-shrink-0 border-r border-ink-6 bg-ink-2 p-4 overflow-y-auto">
        <div className="rounded-2xl border border-em/20 bg-em/5 p-4">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">Platform Owner</div>
          <div className="mt-2 text-lg font-display font-bold text-slate-900">License Control Center</div>
          <div className="mt-1 text-xs text-stone-2">
            Create client workspaces, issue day or month licenses, review requests, and inspect purchased-client activity.
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard label="Clients" value={counts.totalClients} />
          <StatCard label="Active" value={counts.activeClients} tone="good" />
          <StatCard label="Expiring" value={counts.expiringSoon} tone="warn" />
          <StatCard label="Requests" value={counts.pendingRequests} hint="Pending license requests" />
        </div>

        <div className="mt-6 rounded-2xl border border-ink-6 bg-ink-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Expiry Alerts</div>
              <div className="text-2xs text-stone-2 mt-1">One-week, three-day, and overdue reminders for owner follow-up.</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.length ? alerts.slice(0, 6).map((alert) => (
              <button
                key={`${alert.businessId}-${alert.daysRemaining}`}
                type="button"
                onClick={() => setSelectedBusinessId(alert.businessId)}
                className="w-full rounded-2xl border border-ink-6 bg-ink-2 p-3 text-left hover:bg-ink-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{alert.businessName}</div>
                  <span className={`rounded-full px-2 py-1 text-2xs font-semibold ${alert.status === 'expired' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber/10 text-amber'}`}>
                    {getDaysLabel(alert.daysRemaining)}
                  </span>
                </div>
                <div className="mt-1 text-2xs text-stone-2">{alert.ownerName || 'No owner'} · {alert.adminLoginPhone || 'No login phone'}</div>
              </button>
            )) : (
              <div className="text-sm text-stone-2">No upcoming expiries right now.</div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-ink-6 bg-ink-3 p-4">
          <div className="text-sm font-semibold text-slate-900">Create Client + Generate License</div>
          <div className="mt-3 space-y-3">
            <input className="input" placeholder="Shop owner name" value={newClient.ownerName} onChange={(e) => setNewClient((current) => ({ ...current, ownerName: e.target.value }))} />
            <input className="input" placeholder="Shop name" value={newClient.shopName} onChange={(e) => setNewClient((current) => ({ ...current, shopName: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Owner contact phone" value={newClient.ownerPhone} onChange={(e) => setNewClient((current) => ({ ...current, ownerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
              <input className="input" placeholder="Admin login phone" value={newClient.adminPhone} onChange={(e) => setNewClient((current) => ({ ...current, adminPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
            </div>
            <input className="input" type="email" placeholder="Owner email" value={newClient.email} onChange={(e) => setNewClient((current) => ({ ...current, email: e.target.value }))} />
            <input className="input" type="password" placeholder="Admin login password" value={newClient.adminPassword} onChange={(e) => setNewClient((current) => ({ ...current, adminPassword: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <input className="input" type="number" min={1} value={newClient.durationValue} onChange={(e) => setNewClient((current) => ({ ...current, durationValue: Number(e.target.value) }))} />
              <select className="input" value={newClient.durationUnit} onChange={(e) => setNewClient((current) => ({ ...current, durationUnit: e.target.value }))}>
                <option value="day">Day-wise</option>
                <option value="month">Month-wise</option>
              </select>
            </div>
            <textarea className="input resize-none" rows={3} placeholder="Internal notes" value={newClient.notes} onChange={(e) => setNewClient((current) => ({ ...current, notes: e.target.value }))} />
            {newClient.requestId ? (
              <div className="rounded-xl border border-em/20 bg-em/5 px-3 py-2 text-2xs text-em">
                Linked request: {newClient.requestId}
              </div>
            ) : null}
            <button className="btn-em w-full justify-center" onClick={() => createClientMut.mutate(newClient)} disabled={createClientMut.isPending}>
              {createClientMut.isPending ? 'Generating...' : 'Generate License'}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-ink-6 bg-ink-3 p-4">
          <div className="text-sm font-semibold text-slate-900">License Requests</div>
          <div className="mt-3 space-y-3">
            {requestList.length ? requestList.slice(0, 8).map((request) => (
              <div key={request._id} className="rounded-2xl border border-ink-6 bg-ink-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{request.shopName}</div>
                  <span className={`rounded-full px-2 py-1 text-2xs font-semibold ${request.status === 'pending' ? 'bg-amber/10 text-amber' : request.status === 'approved' ? 'bg-em/10 text-em' : 'bg-ink-5 text-stone-2'}`}>
                    {request.status}
                  </span>
                </div>
                <div className="mt-1 text-2xs text-stone-2">{request.ownerName} · {request.phone} · {request.email || 'No email'}</div>
                {request.message ? <div className="mt-2 text-sm text-stone-2">{request.message}</div> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost" type="button" onClick={() => fillFromRequest(request)}>Use Request</button>
                  {request.status === 'pending' ? (
                    <>
                      <button className="btn-ghost" type="button" onClick={() => updateRequestMut.mutate({ requestId: request._id, payload: { status: 'contacted' } })}>
                        Mark Contacted
                      </button>
                      <button className="btn-ghost" type="button" onClick={() => updateRequestMut.mutate({ requestId: request._id, payload: { status: 'rejected' } })}>
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="text-sm text-stone-2">No pending requests right now.</div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Purchased Clients</div>
          <div className="mt-3 space-y-2">
            {sortedClients.map((client) => {
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
                      <div className="mt-1 text-2xs text-stone-2">{client.owner?.name || 'No owner'} · Admin {client.owner?.phone || 'NA'}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-2xs font-semibold ${client.licenseSummary?.status === 'active' ? 'bg-em/10 text-em' : 'bg-rose-500/10 text-rose-300'}`}>
                      {client.licenseSummary?.status || 'pending'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-2xs text-stone-2">
                    <span>{client.contactCount || 0} contacts</span>
                    <span>{client.appointmentCount || 0} appointments</span>
                    <span>{client.unreadMessageCount || 0} unread</span>
                    <span>{getDaysLabel(client.licenseSummary?.daysRemaining)}</span>
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
                    <div className="mt-1 text-sm text-stone-2">
                      Owner: {selectedBusiness?.owner?.name} · Owner phone: {selectedBusiness?.phone || 'NA'} · Admin login: {selectedBusiness?.owner?.phone || 'NA'}
                    </div>
                    <div className="mt-1 text-xs text-stone-2">
                      {selectedBusiness?.owner?.email || selectedBusiness?.email || 'No email'} · Last login {formatDateTime(selectedBusiness?.owner?.lastLogin)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3">
                    <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">License Key</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{selectedBusiness?.license?.key || 'Not assigned'}</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard label="Contacts" value={selectedClientData.stats.contacts} />
                  <StatCard label="Staff" value={selectedClientData.stats.staff} />
                  <StatCard label="Services" value={selectedClientData.stats.services} />
                  <StatCard label="Messages" value={selectedClientData.stats.messages} />
                  <StatCard label="Audits" value={selectedClientData.stats.audits} />
                </div>
              </div>

              <div className="card p-6">
                <div className="text-base font-display font-bold text-slate-900">License Control</div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <StatCard label="Status" value={selectedBusiness?.licenseSummary?.status || selectedBusiness?.license?.status || 'pending'} tone={selectedBusiness?.licenseSummary?.status === 'active' ? 'good' : 'warn'} />
                  <StatCard label="Plan" value={selectedBusiness?.subscription?.plan || 'starter'} />
                  <StatCard label="Start" value={formatDate(selectedBusiness?.license?.startAt)} />
                  <StatCard label="End" value={formatDate(selectedBusiness?.license?.endAt)} hint={getDaysLabel(selectedBusiness?.licenseSummary?.daysRemaining)} />
                </div>

                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-[1fr_140px] gap-3">
                    <input className="input" type="number" min={1} value={licenseUpdate.durationValue} onChange={(e) => setLicenseUpdate((current) => ({ ...current, durationValue: Number(e.target.value) }))} />
                    <select className="input" value={licenseUpdate.durationUnit} onChange={(e) => setLicenseUpdate((current) => ({ ...current, durationUnit: e.target.value }))}>
                      <option value="day">Day-wise</option>
                      <option value="month">Month-wise</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                    onClick={() => updateLicenseMut.mutate({ businessId: selectedBusinessId, payload: licenseUpdate })}
                    disabled={updateLicenseMut.isPending}
                  >
                    {updateLicenseMut.isPending ? 'Updating...' : 'Update License'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-6">
              <div className="card p-6">
                <div className="text-base font-display font-bold text-slate-900">Activity & Actions</div>
                <div className="mt-4 space-y-3">
                  {selectedClientData.activity.slice(0, 30).map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-2xl border border-ink-6 bg-ink-3 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="text-2xs font-mono text-stone-2">{formatDateTime(item.createdAt)}</div>
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
                        <div className="mt-1 text-2xs text-stone-2">{formatDateTime(item.scheduledAt)} · {item.status}</div>
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
          <div className="card p-6 text-sm text-stone-2">Select a client to inspect their purchased-license details and activity.</div>
        )}
      </div>
    </div>
  );
}
