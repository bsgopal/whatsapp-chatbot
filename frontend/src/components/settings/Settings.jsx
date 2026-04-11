import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { servicesAPI, settingsAPI, staffAPI } from '../../api';
import useAuthStore from '../../context/authStore';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'business', label: 'Business', icon: 'Store' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'WA' },
  { id: 'bot', label: 'Chatbot', icon: 'Bot' },
  { id: 'team', label: 'Team', icon: 'Team' },
  { id: 'billing', label: 'Billing', icon: 'Plan' },
];

const PLANS = [
  { id: 'starter', name: 'Starter', price: 'Rs 999', period: '/mo', features: ['1 Staff Member', '200 Apts/month', 'Basic Bot', 'Email Support', 'WhatsApp API'] },
  { id: 'pro', name: 'Pro', price: 'Rs 2,999', period: '/mo', features: ['5 Staff Members', 'Unlimited Appointments', 'Full Bot + AI', 'Priority Support', 'Analytics Dashboard', 'Custom Templates'], recommended: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Rs 7,999', period: '/mo', features: ['Unlimited Staff', 'Everything in Pro', 'Custom AI Model', 'Dedicated Support', 'White Label', 'API Access'] },
];

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-em' : 'bg-ink-6'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function StatTile({ label, value, hint, tone = 'default' }) {
  const toneClass = tone === 'good' ? 'border-em/25 bg-em/5' : tone === 'warn' ? 'border-amber/25 bg-amber/5' : 'border-ink-6 bg-ink-3';
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">{label}</div>
      <div className="mt-2 text-2xl font-display font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-2xs text-stone-2">{hint}</div> : null}
    </div>
  );
}

function FlowBubble({ from, text }) {
  const isBot = from === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed border ${isBot ? 'bg-ink-3 border-ink-6 text-slate-900 rounded-bl-sm' : 'bg-em/10 border-em/25 text-slate-900 rounded-br-sm'}`}>
        <div className="mb-1 text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">{isBot ? 'Bot' : 'Customer'}</div>
        <div className="whitespace-pre-line">{text}</div>
      </div>
    </div>
  );
}

function DeliveryBadge({ status }) {
  const map = {
    failed: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    read: 'bg-sky/10 text-sky border-sky/20',
    delivered: 'bg-em/10 text-em border-em/20',
    sent: 'bg-stone-500/10 text-stone-2 border-stone-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-2xs font-semibold ${map[status] || map.sent}`}>
      {status || 'sent'}
    </span>
  );
}

function BusinessTab({ business, onSave }) {
  const [form, setForm] = useState({
    name: business?.name || '',
    phone: business?.phone || '',
    email: business?.email || '',
    category: business?.category || 'salon',
    timezone: business?.timezone || 'Asia/Kolkata',
    address: business?.address || {},
  });

  useEffect(() => {
    setForm({
      name: business?.name || '',
      phone: business?.phone || '',
      email: business?.email || '',
      category: business?.category || 'salon',
      timezone: business?.timezone || 'Asia/Kolkata',
      address: business?.address || {},
    });
  }, [business]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setAddr = (key, value) => setForm((current) => ({ ...current, address: { ...current.address, [key]: value } }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Business" value={business?.name || 'Not set'} hint={business?.category || 'Category'} />
        <StatTile label="Timezone" value={business?.timezone || 'Asia/Kolkata'} hint="Used for reminders and booking slots" />
        <StatTile label="Currency" value={business?.currency || 'INR'} hint="Shown in WhatsApp service menus" />
      </div>

      <div className="card p-6">
        <h3 className="font-display font-bold text-base text-slate-900 mb-1">Business Information</h3>
        <p className="text-xs text-stone-2 mb-5">This profile powers your booking bot, invoices, and customer-facing messages.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Business Name</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {['salon', 'medical', 'automotive', 'education', 'fitness', 'spa', 'dental', 'legal', 'other'].map((item) => (
                <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Timezone</label>
            <select className="input" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" value={form.address?.city || ''} onChange={(e) => setAddr('city', e.target.value)} />
          </div>
          <div>
            <label className="label">State</label>
            <input className="input" value={form.address?.state || ''} onChange={(e) => setAddr('state', e.target.value)} />
          </div>
        </div>
        <button className="btn-em mt-5" onClick={() => onSave(form)}>Save Business Settings</button>
      </div>
    </div>
  );
}

function WhatsAppTab({ business, onSaveWA, onTest, isTesting, testResult }) {
  const [form, setForm] = useState({
    phoneNumberId: business?.whatsapp?.phoneNumberId || '',
    wabaId: business?.whatsapp?.wabaId || '',
    accessToken: '',
    verifyToken: business?.whatsapp?.verifyToken || 'wa_appt_os_secure',
    testPhone: '',
  });
  const [webhookUrl, setWebhookUrl] = useState(import.meta.env.VITE_WEBHOOK_URL || `${window.location.origin}/api/v1/webhook/whatsapp`);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      phoneNumberId: business?.whatsapp?.phoneNumberId || '',
      wabaId: business?.whatsapp?.wabaId || '',
      verifyToken: business?.whatsapp?.verifyToken || 'wa_appt_os_secure',
    }));
  }, [business]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const connectionTone = business?.whatsapp?.isConnected ? 'good' : 'warn';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Connection" value={business?.whatsapp?.isConnected ? 'Active' : 'Needs attention'} hint={business?.whatsapp?.connectedPhone || 'Connect a WhatsApp number'} tone={connectionTone} />
        <StatTile label="Phone Number ID" value={business?.whatsapp?.phoneNumberId || 'Missing'} hint="Used for sending Cloud API messages" />
        <StatTile label="Verify Token" value={business?.whatsapp?.verifyToken || 'Missing'} hint="Must match Meta webhook setup" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-6">
        <div className="card p-6">
          <h3 className="font-display font-bold text-base text-slate-900 mb-1">WhatsApp Cloud API</h3>
          <p className="text-xs text-stone-2 mb-5">Save your Meta credentials here and verify the setup before going live.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone Number ID</label>
              <input className="input font-mono text-xs" value={form.phoneNumberId} onChange={(e) => set('phoneNumberId', e.target.value)} placeholder="123456789012345" />
            </div>
            <div>
              <label className="label">WABA ID</label>
              <input className="input font-mono text-xs" value={form.wabaId} onChange={(e) => set('wabaId', e.target.value)} placeholder="987654321098765" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Access Token</label>
              <input className="input font-mono text-xs" type="password" value={form.accessToken} onChange={(e) => set('accessToken', e.target.value)} placeholder="Paste a permanent token or leave blank to keep current" />
            </div>
            <div>
              <label className="label">Verify Token</label>
              <input className="input font-mono text-xs" value={form.verifyToken} onChange={(e) => set('verifyToken', e.target.value)} />
            </div>
            <div>
              <label className="label">Send Test To</label>
              <input className="input" value={form.testPhone} onChange={(e) => set('testPhone', e.target.value)} placeholder="9198xxxxxxx" />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-em/20 bg-em/5 p-4">
            <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">Webhook URL</div>
            <div className="mt-2 flex flex-col md:flex-row gap-2">
              <input className="input flex-1 font-mono text-xs" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              <button
                type="button"
                className="btn-ghost whitespace-nowrap"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success('Webhook URL copied');
                }}
              >
                Copy URL
              </button>
            </div>
            <p className="mt-2 text-2xs text-stone-2">Use this exact webhook URL and the same verify token in Meta Business Manager.</p>
          </div>

          {testResult ? (
            <div className="mt-5 rounded-2xl border border-sky/20 bg-sky/5 p-4">
              <div className="text-sm font-semibold text-slate-900">Connection test result</div>
              <div className="mt-2 text-sm text-stone-2">
                <div>Verified Name: <span className="text-slate-900">{testResult.verifiedName || 'Unavailable'}</span></div>
                <div>Display Number: <span className="text-slate-900">{testResult.displayPhoneNumber || 'Unavailable'}</span></div>
                <div>Test Message: <span className="text-slate-900">{testResult.testMessageSent ? 'Sent' : 'Skipped'}</span></div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-ghost" type="button" onClick={() => onTest(form)} disabled={isTesting}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button className="btn-em" type="button" onClick={() => onSaveWA(form)}>
              Save WhatsApp Settings
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-bold text-base text-slate-900 mb-1">Launch Checklist</h3>
          <p className="text-xs text-stone-2 mb-4">Use this before pointing customers to the number.</p>
          <div className="space-y-3">
            {[
              { label: 'Phone Number ID saved', done: !!business?.whatsapp?.phoneNumberId },
              { label: 'Verify token saved', done: !!business?.whatsapp?.verifyToken },
              { label: 'Webhook URL configured in Meta', done: !!business?.whatsapp?.webhookUrl },
              { label: 'Bot enabled', done: !!business?.botSettings?.isEnabled },
              { label: 'At least one service is bookable', done: true },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-3 ${item.done ? 'border-em/20 bg-em/5' : 'border-amber/20 bg-amber/5'}`}>
                <div className="text-sm font-medium text-slate-900">{item.label}</div>
                <div className={`text-2xs mt-1 ${item.done ? 'text-em' : 'text-amber'}`}>{item.done ? 'Ready' : 'Needs setup'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BotTab({ business, services, botPreview, onSave }) {
  const [bot, setBot] = useState(business?.botSettings || {
    isEnabled: true,
    welcomeMessage: 'Hello! Welcome to our appointment booking system. How can I help you today?',
    menuPrompt: 'Please choose a service by sending the number:',
    datePrompt: 'Please send your preferred date in YYYY-MM-DD format.',
    timePrompt: 'Please send your preferred time.',
    confirmationTemplate: 'Your appointment is booked.',
    noServicesMessage: 'We have no bookable services configured yet. Please contact the business directly.',
    invalidServiceMessage: "I couldn't match that service. Please choose one from the menu.",
    invalidDateMessage: 'Please send a valid date like 2026-04-06, today, or tomorrow.',
    invalidTimeMessage: 'Please send a valid time like 10:30, 15:00, or 3 pm.',
    outOfHoursMessage: 'That time is outside business hours. Please choose another time.',
    slotUnavailableMessage: 'That slot is already booked. Please send another time.',
    namePromptMessage: 'Please send your name to confirm the booking.',
    language: 'en',
    autoConfirm: false,
    reminderEnabled: true,
    reminderBeforeHours: 24,
  });

  useEffect(() => {
    setBot(business?.botSettings || {
      isEnabled: true,
      welcomeMessage: 'Hello! Welcome to our appointment booking system. How can I help you today?',
      menuPrompt: 'Please choose a service by sending the number:',
      datePrompt: 'Please send your preferred date in YYYY-MM-DD format.',
      timePrompt: 'Please send your preferred time.',
      confirmationTemplate: 'Your appointment is booked.',
      noServicesMessage: 'We have no bookable services configured yet. Please contact the business directly.',
      invalidServiceMessage: "I couldn't match that service. Please choose one from the menu.",
      invalidDateMessage: 'Please send a valid date like 2026-04-06, today, or tomorrow.',
      invalidTimeMessage: 'Please send a valid time like 10:30, 15:00, or 3 pm.',
      outOfHoursMessage: 'That time is outside business hours. Please choose another time.',
      slotUnavailableMessage: 'That slot is already booked. Please send another time.',
      namePromptMessage: 'Please send your name to confirm the booking.',
      language: 'en',
      autoConfirm: false,
      reminderEnabled: true,
      reminderBeforeHours: 24,
    });
  }, [business]);

  const set = (key, value) => setBot((current) => ({ ...current, [key]: value }));
  const previewFlow = botPreview?.sampleFlow || [];
  const openHours = botPreview?.businessHours || [];
  const engine = botPreview?.engine;
  const engineValue = engine?.active === 'python' && engine?.isAvailable ? 'Python Live' : engine?.configured === 'python' ? 'Node Fallback' : 'Node Engine';
  const engineHint = engine?.active === 'python' && engine?.isAvailable
    ? `Connected to ${engine?.url || 'Python service'}`
    : engine?.configured === 'python'
      ? 'Python service is unreachable, so Node is handling replies'
      : 'Bot replies are being generated inside the Node backend';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatTile label="Bot Status" value={bot.isEnabled ? 'Enabled' : 'Disabled'} hint="Controls automatic replies" tone={bot.isEnabled ? 'good' : 'warn'} />
        <StatTile label="Bookable Services" value={services.length} hint="Shown in WhatsApp menu" />
        <StatTile label="Auto Confirm" value={bot.autoConfirm ? 'On' : 'Off'} hint="Pending vs confirmed booking" />
        <StatTile label="Reminders" value={bot.reminderEnabled ? `${bot.reminderBeforeHours}h` : 'Off'} hint="Time before appointment" />
      </div>

      <div className={`card p-5 border ${engine?.active === 'python' && engine?.isAvailable ? 'border-em/20 bg-em/5' : 'border-amber/20 bg-amber/5'}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Chatbot Engine</div>
            <div className="mt-1 text-lg font-display font-bold text-slate-900">{engineValue}</div>
            <div className="mt-1 text-xs text-stone-2">{engineHint}</div>
          </div>
          <DeliveryBadge status={engine?.active === 'python' && engine?.isAvailable ? 'delivered' : 'failed'} />
        </div>
        {engine?.error ? <div className="mt-3 text-2xs text-amber">Last engine error: {engine.error}</div> : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900">Chatbot Controls</h3>
              <p className="text-xs text-stone-2 mt-0.5">Control the live WhatsApp booking assistant.</p>
            </div>
            <Toggle value={bot.isEnabled} onChange={(value) => set('isEnabled', value)} />
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Welcome Message</label>
              <textarea className="input resize-none" rows={4} value={bot.welcomeMessage} onChange={(e) => set('welcomeMessage', e.target.value)} />
              <p className="text-2xs text-stone-2 mt-1">The bot uses this before offering the service menu.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Menu Prompt</label>
                <input className="input" value={bot.menuPrompt || ''} onChange={(e) => set('menuPrompt', e.target.value)} />
              </div>
              <div>
                <label className="label">Confirmation Message</label>
                <input className="input" value={bot.confirmationTemplate || ''} onChange={(e) => set('confirmationTemplate', e.target.value)} />
              </div>
              <div>
                <label className="label">Date Prompt</label>
                <input className="input" value={bot.datePrompt || ''} onChange={(e) => set('datePrompt', e.target.value)} />
              </div>
              <div>
                <label className="label">Time Prompt</label>
                <input className="input" value={bot.timePrompt || ''} onChange={(e) => set('timePrompt', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">No Services Message</label>
                <input className="input" value={bot.noServicesMessage || ''} onChange={(e) => set('noServicesMessage', e.target.value)} />
              </div>
              <div>
                <label className="label">Invalid Service Message</label>
                <input className="input" value={bot.invalidServiceMessage || ''} onChange={(e) => set('invalidServiceMessage', e.target.value)} />
              </div>
              <div>
                <label className="label">Invalid Date Message</label>
                <input className="input" value={bot.invalidDateMessage || ''} onChange={(e) => set('invalidDateMessage', e.target.value)} />
              </div>
              <div>
                <label className="label">Invalid Time Message</label>
                <input className="input" value={bot.invalidTimeMessage || ''} onChange={(e) => set('invalidTimeMessage', e.target.value)} />
              </div>
              <div>
                <label className="label">Out Of Hours Message</label>
                <input className="input" value={bot.outOfHoursMessage || ''} onChange={(e) => set('outOfHoursMessage', e.target.value)} />
              </div>
              <div>
                <label className="label">Slot Unavailable Message</label>
                <input className="input" value={bot.slotUnavailableMessage || ''} onChange={(e) => set('slotUnavailableMessage', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Name Prompt Message</label>
                <input className="input" value={bot.namePromptMessage || ''} onChange={(e) => set('namePromptMessage', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Language</label>
                <select className="input" value={bot.language} onChange={(e) => set('language', e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
              <div>
                <label className="label">Reminder Before</label>
                <select className="input" value={bot.reminderBeforeHours} onChange={(e) => set('reminderBeforeHours', Number(e.target.value))} disabled={!bot.reminderEnabled}>
                  {[1, 2, 4, 6, 12, 24, 48].map((hours) => (
                    <option key={hours} value={hours}>{hours}h before</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-900 font-semibold">Auto-confirm appointments</div>
                    <div className="text-2xs text-stone-2 mt-1">Useful for fixed-duration services with simple scheduling.</div>
                  </div>
                  <Toggle value={bot.autoConfirm} onChange={(value) => set('autoConfirm', value)} />
                </div>
              </div>
              <div className="rounded-2xl border border-ink-6 bg-ink-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-900 font-semibold">Send reminders</div>
                    <div className="text-2xs text-stone-2 mt-1">The backend uses this window for reminder scheduling.</div>
                  </div>
                  <Toggle value={bot.reminderEnabled} onChange={(value) => set('reminderEnabled', value)} />
                </div>
              </div>
            </div>
          </div>

          <button className="btn-em mt-5" onClick={() => onSave({ botSettings: bot })}>Save Chatbot Settings</button>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">Live Bot Preview</h3>
            <p className="text-xs text-stone-2 mb-4">This is the booking flow your WhatsApp users will see.</p>
            <div className="space-y-3">
              {previewFlow.map((item, index) => (
                <FlowBubble key={`${item.from}-${index}`} from={item.from} text={item.text} />
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display font-bold text-base text-slate-900 mb-4">Booking Inputs</h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-ink-6 bg-ink-3 p-4">
                <div className="text-sm font-semibold text-slate-900">Bookable Services</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {services.length ? services.map((service) => (
                    <span key={service._id} className="rounded-full border border-em/20 bg-em/5 px-3 py-1 text-2xs text-em">
                      {service.name} · {service.duration}m
                    </span>
                  )) : <span className="text-sm text-stone-2">Add services to activate booking.</span>}
                </div>
              </div>
              <div className="rounded-xl border border-ink-6 bg-ink-3 p-4">
                <div className="text-sm font-semibold text-slate-900">Open Days</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {openHours.length ? openHours.map((day) => (
                    <div key={day.day} className="rounded-lg bg-ink-2 px-3 py-2">
                      <div className="text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">{day.day}</div>
                      <div className="text-sm text-slate-900 mt-1">{day.openTime} - {day.closeTime}</div>
                    </div>
                  )) : <span className="text-sm text-stone-2">Business hours not configured.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingTab({ business, isOwner, onLicenseUpdate, isSavingLicense }) {
  const currentPlan = business?.subscription?.plan || 'starter';
  const license = business?.license || {};
  const expiry = license?.endAt ? new Date(license.endAt) : null;
  const daysRemaining = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
  const [licenseForm, setLicenseForm] = useState({
    durationValue: business?.license?.lastDurationValue || 30,
    durationUnit: business?.license?.lastDurationUnit || 'day',
    plan: business?.subscription?.plan || 'starter',
    status: business?.license?.status || 'active',
    notes: '',
  });

  useEffect(() => {
    setLicenseForm({
      durationValue: business?.license?.lastDurationValue || 30,
      durationUnit: business?.license?.lastDurationUnit || 'day',
      plan: business?.subscription?.plan || 'starter',
      status: business?.license?.status || 'active',
      notes: '',
    });
  }, [business]);

  const setLicenseFormField = (key, value) => setLicenseForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatTile label="License Status" value={license?.status || 'pending'} hint="Controlled by platform owner" tone={license?.status === 'active' ? 'good' : 'warn'} />
        <StatTile label="License Key" value={license?.key || 'Not assigned'} hint="Use this for owner support" />
        <StatTile label="Valid Until" value={license?.endAt ? new Date(license.endAt).toLocaleDateString('en-IN') : 'Not set'} hint="Client data stays safe even after expiry" />
        <StatTile label="Days Left" value={daysRemaining !== null ? daysRemaining : 'NA'} hint="Owner receives renewal alerts before expiry" tone={daysRemaining !== null && daysRemaining <= 7 ? 'warn' : 'default'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card p-6 flex flex-col ${isCurrent ? 'border-em shadow-em' : ''} ${plan.recommended ? 'relative' : ''}`}
            >
              {plan.recommended && !isCurrent ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet px-3 py-1 text-2xs font-bold text-slate-900">
                  Recommended
                </div>
              ) : null}
              <div className="font-display text-lg font-extrabold text-slate-900">{plan.name}</div>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-display text-3xl font-extrabold text-slate-900">{plan.price}</span>
                <span className="text-xs text-stone-2">{plan.period}</span>
              </div>
              <div className="mt-4 space-y-2 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="text-sm text-mist-2">{feature}</div>
                ))}
              </div>
              <button className={`mt-5 w-full justify-center ${isCurrent ? 'btn-ghost' : 'btn-em'}`} disabled={isCurrent}>
                {isCurrent ? 'Current Plan' : 'Upgrade'}
              </button>
            </motion.div>
          );
        })}
      </div>
      {isOwner ? (
        <div className="card p-6">
          <h3 className="font-display font-bold text-base text-slate-900 mb-4">Owner License Control</h3>
          <p className="text-xs text-stone-2 mb-5">Generate or renew your workspace license directly from the settings page.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Duration</label>
              <input
                type="number"
                min={1}
                className="input"
                value={licenseForm.durationValue}
                onChange={(e) => setLicenseFormField('durationValue', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Duration Unit</label>
              <select className="input" value={licenseForm.durationUnit} onChange={(e) => setLicenseFormField('durationUnit', e.target.value)}>
                <option value="day">Days</option>
                <option value="month">Months</option>
              </select>
            </div>
            <div>
              <label className="label">Plan</label>
              <select className="input" value={licenseForm.plan} onChange={(e) => setLicenseFormField('plan', e.target.value)}>
                {PLANS.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={licenseForm.status} onChange={(e) => setLicenseFormField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <textarea
                rows={3}
                className="input resize-none"
                value={licenseForm.notes}
                onChange={(e) => setLicenseFormField('notes', e.target.value)}
                placeholder="Renewal notes or owner remarks"
              />
            </div>
          </div>
          <button
            className="btn-em mt-5"
            type="button"
            onClick={() => onLicenseUpdate(licenseForm)}
            disabled={isSavingLicense}
          >
            {business?.license?.key ? 'Renew License' : 'Generate License'}
          </button>
          <p className="mt-3 text-2xs text-stone-2">The platform owner can still approve and manage final activation if required.</p>
        </div>
      ) : (
        <div className="card p-6 text-sm text-stone-2">
          Only the business owner can manage license generation from settings. Use the login license request form if you need renewal.
        </div>
      )}
      <div className="card p-4 text-center text-sm text-stone-2">
        Payments are handled by the platform owner. If your license is close to expiry, use the login page request form to ask for renewal.
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [testResult, setTestResult] = useState(null);
  const qc = useQueryClient();
  const { user, updateBusiness } = useAuthStore();

  const { data: businessData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsAPI.get,
    select: (response) => response.data.data,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: staffAPI.getAll,
    select: (response) => response.data.data,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: servicesAPI.getAll,
    select: (response) => response.data.data,
  });

  const { data: botPreviewData } = useQuery({
    queryKey: ['bot-preview'],
    queryFn: settingsAPI.getBotPreview,
    select: (response) => response.data.data,
  });

  const saveMut = useMutation({
    mutationFn: (payload) => settingsAPI.update(payload),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['bot-preview'] });
      updateBusiness(response.data.data);
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const saveWAMut = useMutation({
    mutationFn: settingsAPI.updateWhatsApp,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('WhatsApp settings saved');
    },
    onError: () => toast.error('Failed to save WhatsApp settings'),
  });

  const saveLicenseMut = useMutation({
    mutationFn: (payload) => settingsAPI.updateLicense(payload),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      updateBusiness(response.data.data);
      toast.success('License settings saved');
    },
    onError: () => toast.error('Failed to save license settings'),
  });

  const testMut = useMutation({
    mutationFn: settingsAPI.testWhatsApp,
    onSuccess: (response) => {
      setTestResult(response.data.data);
      toast.success(response.data.message || 'WhatsApp connection looks good');
    },
    onError: (error) => {
      setTestResult(null);
      toast.error(error.response?.data?.message || 'WhatsApp test failed');
    },
  });

  const business = businessData;
  const staff = staffData || [];
  const services = servicesData || [];
  const botPreview = botPreviewData;

  const headerCopy = useMemo(() => {
    if (activeTab === 'whatsapp') return 'Connect Meta WhatsApp Cloud API and verify live delivery.';
    if (activeTab === 'bot') return 'Shape the automated booking journey your customers see on WhatsApp.';
    if (activeTab === 'business') return 'Keep your business profile consistent across the dashboard and chatbot.';
    if (activeTab === 'team') return 'See the staff members involved in appointments and customer support.';
    return 'Plan management and billing overview.';
  }, [activeTab]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-56 flex-shrink-0 border-r border-ink-6 bg-ink-2 p-4">
        <div className="rounded-2xl border border-em/20 bg-em/5 p-4">
          <div className="text-2xs font-mono uppercase tracking-[0.2em] text-em">WhatsApp Bot</div>
          <div className="mt-2 text-lg font-display font-bold text-slate-900">{business?.name || 'Business Settings'}</div>
          <div className="mt-1 text-xs text-stone-2">Configure the live booking chatbot, delivery status, and staff inbox.</div>
        </div>

        <div className="mt-5 text-2xs font-mono uppercase tracking-[0.2em] text-stone-2">Workspace</div>
        <nav className="mt-3 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full rounded-xl px-3 py-3 text-left text-sm transition-colors ${activeTab === tab.id ? 'bg-em/10 text-em border border-em/20' : 'text-stone-2 hover:bg-ink-5 hover:text-slate-900 border border-transparent'}`}
            >
              <div className="text-2xs font-mono uppercase tracking-[0.18em] opacity-80">{tab.icon}</div>
              <div className="mt-1 font-semibold">{tab.label}</div>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-slate-900">{TABS.find((tab) => tab.id === activeTab)?.label}</h2>
          <p className="mt-1 text-sm text-stone-2">{headerCopy}</p>
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === 'business' ? <BusinessTab business={business} onSave={(payload) => saveMut.mutate(payload)} /> : null}
          {activeTab === 'whatsapp' ? (
            <WhatsAppTab
              business={business}
              onSaveWA={(payload) => saveWAMut.mutate(payload)}
              onTest={(payload) => testMut.mutate(payload)}
              isTesting={testMut.isPending}
              testResult={testResult}
            />
          ) : null}
          {activeTab === 'bot' ? <BotTab business={business} services={botPreview?.services || services} botPreview={botPreview} onSave={(payload) => saveMut.mutate(payload)} /> : null}
          {activeTab === 'team' ? (
            <div className="card p-6">
              <h3 className="font-display font-bold text-base text-slate-900 mb-4">Team Members</h3>
              {staff.length ? (
                <div className="space-y-3">
                  {staff.map((member) => (
                    <div key={member._id} className="flex items-center gap-3 rounded-2xl border border-ink-6 bg-ink-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-slate-900" style={{ background: `${member.color || '#00E676'}30` }}>
                        {member.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{member.name}</div>
                        <div className="text-2xs text-stone-2 mt-1">{member.role} · {member.email || member.phone || 'No contact info'}</div>
                      </div>
                      <DeliveryBadge status={member.isActive ? 'delivered' : 'failed'} />
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-stone-2">No team members yet. Add staff to assign appointments later.</div>}
            </div>
          ) : null}
          {activeTab === 'billing' ? (
            <BillingTab
              business={business}
              isOwner={user?.role === 'owner'}
              onLicenseUpdate={(payload) => saveLicenseMut.mutate(payload)}
              isSavingLicense={saveLicenseMut.isPending}
            />
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}

