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

// ── Bot message field definitions ─────────────────────────────
const BOT_MESSAGES = [
  {
    key: 'welcomeMessage',
    label: 'Welcome Message',
    hint: 'Sent when someone says hi, start, or opens the bot for the first time.',
    trigger: 'Customer sends: "Hi"',
    rows: 3,
  },
  {
    key: 'menuPrompt',
    label: 'Service Menu Prompt',
    hint: 'Heading text shown above the list of bookable services.',
    trigger: 'After staff selection',
    rows: 1,
  },
  {
    key: 'datePrompt',
    label: 'Date Prompt',
    hint: 'Asks the customer to pick a date.',
    trigger: 'After service is chosen',
    rows: 1,
  },
  {
    key: 'timePrompt',
    label: 'Time Slot Prompt',
    hint: 'Asks the customer to pick a time slot.',
    trigger: 'After date is chosen',
    rows: 1,
  },
  {
    key: 'namePromptMessage',
    label: 'Name Prompt',
    hint: "Asks for the customer's full name before confirming.",
    trigger: 'After slot is chosen',
    rows: 1,
  },
  {
    key: 'confirmationTemplate',
    label: 'Booking Confirmed Message',
    hint: 'First line of the confirmation card sent after successful booking.',
    trigger: 'After customer says YES',
    rows: 1,
  },
  {
    key: 'slotUnavailableMessage',
    label: 'Slot Unavailable',
    hint: 'Sent when the chosen time is already booked.',
    trigger: 'Slot conflict detected',
    rows: 1,
  },
  {
    key: 'outOfHoursMessage',
    label: 'Out of Hours',
    hint: 'Sent when chosen time is outside business hours.',
    trigger: 'Time outside open hours',
    rows: 1,
  },
  {
    key: 'invalidDateMessage',
    label: 'Invalid Date',
    hint: "Sent when the bot can't parse the date the customer typed.",
    trigger: 'Unrecognised date input',
    rows: 1,
  },
  {
    key: 'invalidTimeMessage',
    label: 'Invalid Time',
    hint: "Sent when the bot can't parse the time the customer typed.",
    trigger: 'Unrecognised time input',
    rows: 1,
  },
  {
    key: 'invalidServiceMessage',
    label: 'Invalid Service',
    hint: "Sent when the customer's service choice doesn't match anything.",
    trigger: 'Service not found',
    rows: 1,
  },
  {
    key: 'noServicesMessage',
    label: 'No Services Available',
    hint: 'Shown when the business has no active bookable services configured.',
    trigger: 'No services in system',
    rows: 2,
  },
];

const DEFAULT_BOT = {
  isEnabled: true,
  welcomeMessage: '👋 Welcome to our appointment booking system! How can I help you today?',
  menuPrompt: '✂️ Which service would you like?',
  datePrompt: '📅 When would you like to come in?',
  timePrompt: '⏰ Choose a time slot:',
  confirmationTemplate: '✅ Your appointment is confirmed!',
  noServicesMessage: 'Hello! We have no bookable services configured yet. Please contact us directly.',
  invalidServiceMessage: "❓ I couldn't find that service. Please choose from the menu.",
  invalidDateMessage: "❓ I didn't understand that date. Please try again.",
  invalidTimeMessage: "❓ I didn't catch that time. Please try again.",
  outOfHoursMessage: '⚠️ That time is outside our business hours. Please choose another time.',
  slotUnavailableMessage: '❌ That slot is already booked. Please choose another time.',
  namePromptMessage: '📝 Please enter your full name to confirm the booking.',
  language: 'en',
  autoConfirm: false,
  reminderEnabled: true,
  reminderBeforeHours: 24,
};

function WaBubble({ text, side = 'bot', onClick, active }) {
  const isBot = side === 'bot';
  return (
    <div
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} group`}
      onClick={onClick}
    >
      <div
        className={[
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border transition-all',
          isBot
            ? 'bg-white border-gray-200 rounded-bl-sm text-gray-900'
            : 'bg-[#dcf8c6] border-[#b7e8a0] rounded-br-sm text-gray-900',
          onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : '',
          active ? 'ring-2 ring-blue-400 shadow-md' : '',
        ].join(' ')}
      >
        {onClick && (
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
            {isBot ? '🤖 Bot' : '👤 Customer'}
            <span className="ml-auto opacity-0 group-hover:opacity-100 text-blue-400">✏️ click to edit</span>
          </div>
        )}
        <div className="whitespace-pre-line text-sm">{text || <span className="italic text-gray-400">Empty — tap to set</span>}</div>
      </div>
    </div>
  );
}

function MessageEditorPanel({ fieldDef, value, onChange, onClose }) {
  if (!fieldDef) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-blue-400/40 bg-blue-50/60 p-5 mt-3"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-900 text-sm">{fieldDef.label}</div>
          <div className="text-xs text-stone-2 mt-0.5">{fieldDef.hint}</div>
          <div className="mt-1 rounded-full bg-blue-100 border border-blue-200 text-blue-600 text-[10px] font-mono px-2 py-0.5 inline-block">
            Triggered: {fieldDef.trigger}
          </div>
        </div>
        <button
          className="rounded-lg px-2 py-1 text-xs text-stone-2 hover:bg-white border border-transparent hover:border-ink-6 transition-colors"
          onClick={onClose}
        >
          Done ✓
        </button>
      </div>
      <textarea
        autoFocus
        className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        rows={fieldDef.rows > 1 ? Math.max(3, fieldDef.rows) : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Type your ${fieldDef.label.toLowerCase()} here…`}
      />
      <p className="mt-2 text-[10px] text-stone-2">
        💡 You can use *bold*, _italic_ WhatsApp formatting. The bot appends options automatically after this message.
      </p>
    </motion.div>
  );
}

function BotTab({ business, services, botPreview, onSave }) {
  const [bot, setBot] = useState({ ...DEFAULT_BOT, ...(business?.botSettings || {}) });
  const [activeField, setActiveField] = useState(null); // key of message being edited
  const [previewStep, setPreviewStep] = useState(0);

  useEffect(() => {
    setBot({ ...DEFAULT_BOT, ...(business?.botSettings || {}) });
  }, [business]);

  const set = (key, value) => setBot((c) => ({ ...c, [key]: value }));
  const openHours = botPreview?.businessHours || [];
  const engine = botPreview?.engine;
  const engineOk = engine?.active === 'python' && engine?.isAvailable;
  const engineLabel = engineOk ? 'Python AI' : engine?.configured === 'python' ? 'Node (Python unavailable)' : 'Node Engine';

  // Build the live preview conversation based on current bot messages
  const bizName = business?.name || 'Your Business';
  const sampleService = (botPreview?.services || services || [])[0];
  const sampleServiceText = sampleService ? `1️⃣  *${sampleService.name}*\n     💰 ₹${sampleService.price}  ⏱ ${sampleService.duration} min` : '1️⃣  *Haircut*\n     💰 ₹500  ⏱ 30 min';

  const PREVIEW_FLOW = [
    { side: 'customer', text: 'Hi' },
    {
      side: 'bot',
      text: `${bot.welcomeMessage}\n\n1️⃣  📅 *Book an Appointment*\n2️⃣  🚶 *Walk-in Booking*\n3️⃣  📋 *View My Appointments*\n4️⃣  ❌ *Cancel*\n5️⃣  🔄 *Reschedule*`,
      field: 'welcomeMessage',
    },
    { side: 'customer', text: '1' },
    {
      side: 'bot',
      text: `${bot.menuPrompt}\n\n${sampleServiceText}\n\nReply with a *number* or *service name*`,
      field: 'menuPrompt',
    },
    { side: 'customer', text: sampleService ? sampleService.name : 'Haircut' },
    {
      side: 'bot',
      text: `${bot.datePrompt}\n\n1️⃣  Today — Mon, 14 Apr 2026\n2️⃣  Tomorrow — Tue, 15 Apr 2026\n3️⃣  Wed, 16 Apr 2026`,
      field: 'datePrompt',
    },
    { side: 'customer', text: 'tomorrow' },
    {
      side: 'bot',
      text: `${bot.timePrompt} for *Ravi* on *Tue, 15 Apr 2026*:\n\n1️⃣  09:00 AM ✅\n2️⃣  09:30 AM ✅\n3️⃣  10:00 AM ❌ Booked\n4️⃣  10:30 AM ✅`,
      field: 'timePrompt',
    },
    { side: 'customer', text: '10:30 am' },
    { side: 'bot', text: `📝 ${bot.namePromptMessage}`, field: 'namePromptMessage' },
    { side: 'customer', text: 'Priya Sharma' },
    {
      side: 'bot',
      text: `📋 *Please confirm your booking:*\n\n🏢 *${bizName}*\n✂️ *Service:*  ${sampleService?.name || 'Haircut'}\n👤 *Staff:*    Ravi\n📅 *Date:*     Tue, 15 Apr 2026\n⏰ *Time:*     10:30 AM\n👤 *Name:*     Priya Sharma\n💰 *Price:*    ₹${sampleService?.price || 500}\n\nReply *YES* to confirm or *NO* to cancel.`,
    },
    { side: 'customer', text: 'YES' },
    {
      side: 'bot',
      text: `${bot.confirmationTemplate}\n\n🔖 *Booking ID:* \`APT-X1Y2\`\n━━━━━━━━━━━━━━━━━━━━\n🏢 *${bizName}*\n✂️ *Service:*  ${sampleService?.name || 'Haircut'}\n👤 *Staff:*    Ravi\n📅 *Date:*     Tue, 15 Apr 2026\n⏰ *Time:*     10:30 AM\n💰 *Price:*    ₹${sampleService?.price || 500}\n━━━━━━━━━━━━━━━━━━━━`,
      field: 'confirmationTemplate',
    },
  ];

  const visibleFlow = PREVIEW_FLOW.slice(0, previewStep * 2 + 2);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Bot Status" value={bot.isEnabled ? 'Enabled' : 'Disabled'} hint="Controls automatic replies" tone={bot.isEnabled ? 'good' : 'warn'} />
        <StatTile label="Engine" value={engineLabel} hint={engineOk ? 'Serving live replies' : 'Node fallback active'} tone={engineOk ? 'good' : 'warn'} />
        <StatTile label="Auto Confirm" value={bot.autoConfirm ? 'On' : 'Off'} hint="Pending vs confirmed" />
        <StatTile label="Reminders" value={bot.reminderEnabled ? `${bot.reminderBeforeHours}h before` : 'Off'} hint="Before appointment" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">

        {/* ── LEFT: Message Editor ─────────────────────── */}
        <div className="space-y-5">

          {/* Master controls */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">Bot Active</h3>
                <p className="text-xs text-stone-2">Toggle to enable / disable all automatic WhatsApp replies.</p>
              </div>
              <Toggle value={bot.isEnabled} onChange={(v) => set('isEnabled', v)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink-6 bg-ink-3 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Auto-confirm</div>
                  <div className="text-2xs text-stone-2">Skip pending status</div>
                </div>
                <Toggle value={bot.autoConfirm} onChange={(v) => set('autoConfirm', v)} />
              </div>
              <div className="rounded-xl border border-ink-6 bg-ink-3 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Reminders</div>
                  <div className="text-2xs text-stone-2">Send before appointment</div>
                </div>
                <Toggle value={bot.reminderEnabled} onChange={(v) => set('reminderEnabled', v)} />
              </div>
            </div>
            {bot.reminderEnabled && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-stone-2 whitespace-nowrap">Send reminder</label>
                <select className="input flex-1" value={bot.reminderBeforeHours} onChange={(e) => set('reminderBeforeHours', Number(e.target.value))}>
                  {[1, 2, 4, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h}h before</option>)}
                </select>
                <label className="text-xs text-stone-2 whitespace-nowrap">appointment</label>
              </div>
            )}
          </div>

          {/* Message fields */}
          <div className="card p-5">
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">Bot Messages</h3>
            <p className="text-xs text-stone-2 mb-4">
              Click any message to edit it. Changes reflect instantly in the WhatsApp preview on the right.
            </p>
            <div className="space-y-2">
              {BOT_MESSAGES.map((field) => {
                const isActive = activeField === field.key;
                return (
                  <div key={field.key}>
                    <button
                      type="button"
                      className={[
                        'w-full text-left rounded-xl border px-4 py-3 transition-all',
                        isActive
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-ink-6 bg-ink-3 hover:border-em/40 hover:bg-em/5',
                      ].join(' ')}
                      onClick={() => setActiveField(isActive ? null : field.key)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">{field.label}</span>
                        <span className="text-[10px] font-mono text-stone-2 bg-ink-5 rounded px-1.5 py-0.5">{field.trigger}</span>
                      </div>
                      <div className="mt-1.5 text-xs text-stone-2 truncate">
                        {bot[field.key] || <span className="italic">Not set</span>}
                      </div>
                    </button>
                    {isActive && (
                      <MessageEditorPanel
                        fieldDef={field}
                        value={bot[field.key] || ''}
                        onChange={(v) => set(field.key, v)}
                        onClose={() => setActiveField(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-ink-6 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Language</label>
                <select className="input" value={bot.language || 'en'} onChange={(e) => set('language', e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="btn-em w-full" onClick={() => onSave({ botSettings: bot })}>
                  Save All Messages
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: WhatsApp Live Preview ─────────────── */}
        <div className="sticky top-0">
          {/* Phone frame */}
          <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
            {/* Status bar */}
            <div className="bg-[#075E54] px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                {bizName[0]}
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold text-sm leading-tight">{bizName}</div>
                <div className="text-[#90EE90] text-[10px]">online</div>
              </div>
              <div className="text-white text-xs opacity-70">📞 ⋮</div>
            </div>

            {/* Chat area */}
            <div
              className="bg-[#ECE5DD] p-3 space-y-2 overflow-y-auto"
              style={{ minHeight: 440, maxHeight: 560, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9b8a8' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
            >
              {/* Date chip */}
              <div className="text-center">
                <span className="bg-white/70 rounded-full text-[10px] px-3 py-1 text-gray-500">TODAY</span>
              </div>

              {PREVIEW_FLOW.map((item, idx) => {
                const isVisible = idx <= previewStep * 2 + 1;
                if (!isVisible) return null;
                const isBot = item.side === 'bot';
                const isClickable = !!item.field;
                const isActive = item.field && activeField === item.field;
                return (
                  <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={[
                        'max-w-[82%] rounded-xl px-3 py-2 text-[12px] leading-snug shadow-sm transition-all',
                        isBot ? 'bg-white rounded-tl-none' : 'bg-[#dcf8c6] rounded-tr-none',
                        isClickable ? 'cursor-pointer ring-offset-1' : '',
                        isActive ? 'ring-2 ring-blue-400' : isClickable ? 'hover:ring-1 hover:ring-blue-300' : '',
                      ].join(' ')}
                      onClick={isClickable ? () => setActiveField(isActive ? null : item.field) : undefined}
                      title={isClickable ? 'Click to edit this message' : ''}
                    >
                      <div className="whitespace-pre-line text-gray-900">{item.text}</div>
                      <div className="text-right mt-1">
                        <span className="text-[9px] text-gray-400">{isBot ? '✓' : '✓✓'} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {isClickable && (
                        <div className={`text-[9px] mt-0.5 font-mono ${isActive ? 'text-blue-500' : 'text-gray-300'}`}>
                          {isActive ? '▲ editing' : '✏ tap to edit'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview controls */}
            <div className="bg-[#F0F0F0] px-3 py-2 flex items-center gap-2 border-t border-gray-300">
              <button
                className="rounded-full bg-gray-300 text-gray-600 text-[11px] px-3 py-1 hover:bg-gray-400 transition-colors"
                onClick={() => setPreviewStep(Math.max(0, previewStep - 1))}
                disabled={previewStep === 0}
              >
                ← Prev
              </button>
              <div className="flex-1 text-center text-[10px] text-gray-500">
                Step {previewStep + 1} of {Math.ceil(PREVIEW_FLOW.length / 2)}
              </div>
              <button
                className="rounded-full bg-[#075E54] text-white text-[11px] px-3 py-1 hover:bg-[#064e46] transition-colors"
                onClick={() => setPreviewStep(Math.min(Math.ceil(PREVIEW_FLOW.length / 2) - 1, previewStep + 1))}
                disabled={previewStep >= Math.ceil(PREVIEW_FLOW.length / 2) - 1}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Open hours panel */}
          {openHours.length > 0 && (
            <div className="mt-4 card p-4">
              <div className="text-xs font-semibold text-slate-900 mb-2">Open Hours</div>
              <div className="grid grid-cols-2 gap-1.5">
                {openHours.map((day) => (
                  <div key={day.day} className="rounded-lg bg-ink-3 px-2.5 py-1.5">
                    <div className="text-[10px] font-mono uppercase text-stone-2">{day.day}</div>
                    <div className="text-xs text-slate-900">{day.openTime}–{day.closeTime}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services chip list */}
          {(botPreview?.services || services || []).length > 0 && (
            <div className="mt-3 card p-4">
              <div className="text-xs font-semibold text-slate-900 mb-2">Bookable Services</div>
              <div className="flex flex-wrap gap-1.5">
                {(botPreview?.services || services).map((s) => (
                  <span key={s._id || s.id} className="rounded-full border border-em/20 bg-em/5 px-2.5 py-1 text-[10px] text-em">
                    {s.name} · {s.duration}m
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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