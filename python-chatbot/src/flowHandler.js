// ============================================================
//  src/flowHandler.js  —  Conversation flow
//
//  Single-business bot: the business is configured via
//  BOT_BUSINESS_ID in .env and loaded dynamically from the
//  backend API. No hardcoded shop list is shown to users.
//  Custom messages come from dashboard → Settings → Bot Messages.
// ============================================================

const moment  = require('moment');
const { getBusiness, refreshBusiness } = require('../data/businesses');
const session = require('./sessionManager');
const store   = require('./appointmentStore');

// ── Helpers ──────────────────────────────────────────────────

function parseNum(text, max) {
  const n = parseInt(text.trim(), 10);
  if (isNaN(n) || n < 1 || n > max) return null;
  return n - 1;
}

function getAvailableDates(biz, count = 7) {
  const openDays = new Set(
    (biz.businessHours || []).filter(h => h.isOpen).map(h => h.day.toLowerCase())
  );
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today = moment();
  const available = [];
  let d = today.clone();
  while (available.length < count) {
    const dayName = dayNames[d.day()];
    if (openDays.size === 0 || openDays.has(dayName)) available.push(d.format('YYYY-MM-DD'));
    d.add(1, 'day');
  }
  return available;
}

function getSlotsForStaff(biz, staffMember) {
  const start = staffMember.workStart || '09:00';
  const end   = staffMember.workEnd   || '18:00';
  const minDuration = Math.max(15,
    Math.min(...(biz.services || []).map(s => s.duration || 30))
  );
  const slots = [];
  let cur = moment(start, 'HH:mm');
  const fin = moment(end, 'HH:mm');
  while (cur.isBefore(fin)) {
    slots.push(cur.format('hh:mm A'));
    cur.add(minDuration, 'minutes');
  }
  return slots;
}

function msg(biz, key, fallback) {
  const v = biz && biz.botSettings && biz.botSettings[key];
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
}

function fmt(amount, currency) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch { return '₹' + (amount || 0); }
}

// ── Message builders ─────────────────────────────────────────

function buildWelcome(biz) {
  const welcome = msg(biz, 'welcomeMessage',
    '👋 Welcome to *' + biz.name + '*! How can we help you today?');
  return welcome + '\n\n1️⃣  📅 Book an Appointment\n2️⃣  📋 View My Appointments\n3️⃣  ❌ Cancel an Appointment\n4️⃣  🔄 Reschedule an Appointment\n5️⃣  ℹ️  Help & FAQs\n\nReply with a number *(1–5)*.';
}

function buildStaffMenu(biz) {
  const list = biz.staff
    .map((s, i) => (i+1) + '️⃣  *' + s.name + '*' + (s.role ? '\n     _' + s.role + '_' : ''))
    .join('\n\n');
  return '👤 *Choose a Staff Member:*\n\n' + list + '\n\nReply with a number, or *0* for main menu.';
}

function buildServiceMenu(biz) {
  const prompt = msg(biz, 'menuPrompt', 'Please choose a service:');
  const list = biz.services
    .map((s, i) => (i+1) + '️⃣  *' + s.name + '*\n     💰 ' + fmt(s.price, biz.currency) + '  ⏱ ' + s.duration + ' min')
    .join('\n\n');
  return '✂️ *' + prompt + '*\n\n' + list + '\n\nReply with a number, or *0* for main menu.';
}

function buildDateMenu(biz) {
  const dates = getAvailableDates(biz);
  const today = moment().format('YYYY-MM-DD');
  const list = dates.map((d, i) => {
    const diff = moment(d).diff(moment(today), 'days');
    const label = diff === 0 ? 'Today — ' + moment(d).format('ddd, DD MMM YYYY')
                : diff === 1 ? 'Tomorrow — ' + moment(d).format('ddd, DD MMM YYYY')
                : moment(d).format('ddd, DD MMM YYYY');
    return (i+1) + '️⃣  ' + label;
  });
  const prompt = msg(biz, 'datePrompt', 'Please choose a date:');
  return '📅 *' + prompt + '*\n\n' + list.join('\n') + '\n\nReply with a number *(1–' + dates.length + ')*, or *0* for main menu.';
}

function buildSlotMenu(biz, staffMember, taken) {
  const slots = getSlotsForStaff(biz, staffMember);
  const lines = slots.map((s, i) => taken.includes(s) ? (i+1) + '️⃣  ~~' + s + '~~ ❌' : (i+1) + '️⃣  ' + s + ' ✅');
  const prompt = msg(biz, 'timePrompt', 'Please choose a time slot:');
  const footer = slots.every(s => taken.includes(s))
    ? '\n\n⚠️ _All slots are booked for this day. Reply *0* to choose another date._'
    : '\n\nReply with a number, or *0* for main menu.';
  return '⏰ *' + prompt + '*\n\n' + lines.join('\n') + footer;
}

function buildConfirmPrompt({ biz, staff, service, date, slot, name }) {
  return '📋 *Please confirm your booking:*\n\n🏢 *' + biz.name + '*\n✂️ *Service:* ' + service.name + '\n👤 *Staff:*   ' + staff.name + '\n📅 *Date:*    ' + moment(date).format('ddd, DD MMM YYYY') + '\n⏰ *Time:*    ' + slot + '\n👤 *Name:*    ' + name + '\n💰 *Price:*   ' + fmt(service.price, biz.currency) + '\n\nReply *YES* to confirm or *NO* to cancel.';
}

function buildViewAppointments(appts) {
  if (!appts || appts.length === 0) return '📋 You have *no appointments* yet.\n\nReply *1* to book one, or *0* for main menu.';
  const active    = appts.filter(a => a.status === 'confirmed');
  const cancelled = appts.filter(a => a.status === 'cancelled');
  const today     = moment().format('YYYY-MM-DD');
  let out = '📋 *Your Appointments:*\n';
  if (active.length > 0) {
    out += '\n*✅ Upcoming (' + active.length + '):*\n';
    active.forEach(a => {
      const tag = a.date === today ? ' 🔔 *TODAY*' : a.date < today ? ' _(past)_' : '';
      out += '\n🔖 `' + a.id + '`' + tag + '\n   🏢 ' + a.businessName + '\n   ✂️ ' + (a.serviceName || '—') + '\n   👤 ' + a.staffName + '\n   📅 ' + moment(a.date).format('ddd, DD MMM') + ' at ' + a.slot + '\n   💰 ₹' + (a.servicePrice || 0) + '\n';
    });
  }
  if (cancelled.length > 0) {
    out += '\n*❌ Cancelled (' + cancelled.length + '):*\n';
    cancelled.forEach(a => { out += '\n🔖 `' + a.id + '` — ' + a.businessName + ' _(' + moment(a.date).format('DD MMM') + ' ' + a.slot + ')_\n'; });
  }
  out += '\nReply *0* for main menu.';
  return out;
}

function buildHelp(biz) {
  const name = (biz && biz.name) || 'the business';
  return 'ℹ️ *Help & FAQs — ' + name + '*\n\n📌 *How to book?*\nReply *1* from the main menu and follow the steps.\n\n📌 *How to view my appointments?*\nReply *2* from the main menu.\n\n📌 *How to cancel?*\nReply *3* from the main menu and select your appointment.\n\n📌 *How to reschedule?*\nReply *4* from the main menu.\n\n📌 *Lost your Booking ID?*\nReply *2* to see all your appointments.\n\n📌 *Need human support?*\nContact us directly at *' + name + '*.\n\n━━━━━━━━━━━━━━━━━\nReply *0* to go back to the main menu.';
}

// ── Main handler ─────────────────────────────────────────────

async function handleMessage(phone, rawText) {
  const text  = rawText.trim();
  const lower = text.toLowerCase();

  let biz;
  try {
    biz = await getBusiness();
  } catch (err) {
    console.error('[flow] Could not load business:', err.message);
    return '⚠️ The bot is not fully configured yet. Please contact the administrator.\n\nError: ' + err.message;
  }

  if (text === '0' || lower === 'menu' || lower === 'back') { session.reset(phone); return buildWelcome(biz); }
  if (['hi','hello','hey','start','hii','hai','book','appointment'].includes(lower)) { session.set(phone, 'MAIN_MENU'); return buildWelcome(biz); }
  if (lower === 'help' || lower === 'faq') return buildHelp(biz);
  if (lower === 'refresh_bot_config') {
    try { biz = await refreshBusiness(); return '✅ Bot config reloaded: "' + biz.name + '" — ' + biz.services.length + ' services, ' + biz.staff.length + ' staff.'; }
    catch (e) { return '❌ Reload failed: ' + e.message; }
  }

  const s = session.get(phone);
  if (!s) { session.set(phone, 'MAIN_MENU'); return buildWelcome(biz); }

  // ── MAIN MENU ─────────────────────────────────────────────
  if (s.step === 'MAIN_MENU') {
    if (text === '1') {
      if (!biz.staff || biz.staff.length === 0) return msg(biz, 'noServicesMessage', 'Hello! *' + biz.name + '* has no staff configured yet. Please contact us directly.');
      if (biz.staff.length === 1) { session.set(phone, 'BOOK_SELECT_SERVICE', { staff: biz.staff[0] }); return buildServiceMenu(biz); }
      session.set(phone, 'BOOK_SELECT_STAFF');
      return buildStaffMenu(biz);
    }
    if (text === '2') { const a = await store.getByPhone(phone); session.reset(phone); return buildViewAppointments(a); }
    if (text === '3') {
      const active = (await store.getByPhone(phone)).filter(a => a.status === 'confirmed');
      if (!active.length) return '❌ You have no active appointments to cancel.\n\nReply *0* for main menu.';
      session.set(phone, 'CANCEL_SELECT', { cancelList: active });
      return '🗑️ *Which appointment to cancel?*\n\n' + active.map((a,i) => (i+1) + '️⃣  `' + a.id + '` — ' + a.businessName + '\n     📅 ' + moment(a.date).format('DD MMM') + ' at ' + a.slot + '\n     ✂️ ' + (a.serviceName||'—')).join('\n\n') + '\n\nReply with the number.';
    }
    if (text === '4') {
      const active = (await store.getByPhone(phone)).filter(a => a.status === 'confirmed');
      if (!active.length) return '❌ You have no active appointments to reschedule.\n\nReply *0* for main menu.';
      session.set(phone, 'RESCHEDULE_SELECT', { rescheduleList: active });
      return '🔄 *Which appointment to reschedule?*\n\n' + active.map((a,i) => (i+1) + '️⃣  `' + a.id + '` — ' + a.businessName + '\n     📅 ' + moment(a.date).format('DD MMM') + ' at ' + a.slot + '\n     ✂️ ' + (a.serviceName||'—')).join('\n\n') + '\n\nReply with the number.';
    }
    if (text === '5') { session.reset(phone); return buildHelp(biz); }
    return '❓ Please reply with a number *(1–5)*, or send *hi* to start again.';
  }

  // ── BOOKING FLOW ──────────────────────────────────────────
  if (s.step === 'BOOK_SELECT_STAFF') {
    const idx = parseNum(text, biz.staff.length);
    if (idx === null) return '❓ Please choose a number between 1 and ' + biz.staff.length + '.';
    session.set(phone, 'BOOK_SELECT_SERVICE', { staff: biz.staff[idx] });
    return buildServiceMenu(biz);
  }

  if (s.step === 'BOOK_SELECT_SERVICE') {
    const idx = parseNum(text, biz.services.length);
    if (idx === null) return '❓ Please choose a number between 1 and ' + biz.services.length + '.';
    session.set(phone, 'BOOK_SELECT_DATE', { service: biz.services[idx] });
    return buildDateMenu(biz);
  }

  if (s.step === 'BOOK_SELECT_DATE') {
    const dates = getAvailableDates(biz);
    const idx = parseNum(text, dates.length);
    if (idx === null) return '❓ Please choose a date number between 1 and ' + dates.length + '.';
    const date  = dates[idx];
    const staff = s.data.staff;
    const taken = await store.getTakenSlots(biz._id, staff.id, date);
    session.set(phone, 'BOOK_SELECT_SLOT', { date, slots: getSlotsForStaff(biz, staff) });
    return buildSlotMenu(biz, staff, taken);
  }

  if (s.step === 'BOOK_SELECT_SLOT') {
    const { staff, service, date, slots } = s.data;
    const idx = parseNum(text, slots.length);
    if (idx === null) return '❓ Please choose a slot number between 1 and ' + slots.length + '.';
    const slot  = slots[idx];
    const taken = await store.getTakenSlots(biz._id, staff.id, date);
    if (taken.includes(slot)) return msg(biz, 'slotUnavailableMessage', '❌ That slot is already booked.') + '\n\n' + buildSlotMenu(biz, staff, taken);
    session.set(phone, 'BOOK_ASK_NAME', { slot });
    return '📝 ' + msg(biz, 'namePromptMessage', 'Please enter your *full name* for the appointment.');
  }

  if (s.step === 'BOOK_ASK_NAME') {
    const name = text;
    if (name.length < 2 || /^\d+$/.test(name)) return '⚠️ Please enter a valid full name (letters only).';
    session.set(phone, 'BOOK_CONFIRM', { name });
    return buildConfirmPrompt({ biz, staff: s.data.staff, service: s.data.service, date: s.data.date, slot: s.data.slot, name });
  }

  if (s.step === 'BOOK_CONFIRM') {
    const { staff, service, date, slot, name } = s.data;
    if (lower === 'yes' || lower === 'y' || text === '1') {
      const result = await store.book({ phone, name, businessId: String(biz._id), businessName: biz.name, staffId: staff.id, staffName: staff.name, serviceId: service.id, serviceName: service.name, servicePrice: service.price, serviceDuration: service.duration, date, slot });
      session.set(phone, 'DONE');
      if (!result.success) return msg(biz, 'slotUnavailableMessage', '❌ Sorry, that slot was just taken.') + '\n\nReply *0* for main menu.';
      const tmpl = msg(biz, 'confirmationTemplate', 'Your appointment is booked. ✅');
      return tmpl + '\n\n🔖 *Booking ID:* `' + result.appointment.id + '`\n━━━━━━━━━━━━━━━━━━━━\n🏢 *' + biz.name + '*\n✂️ *Service:*  ' + service.name + '\n👤 *Staff:*    ' + staff.name + '\n📅 *Date:*     ' + moment(date).format('ddd, DD MMM YYYY') + '\n⏰ *Time:*     ' + slot + '\n⏱ *Duration:* ' + service.duration + ' min\n👤 *Name:*     ' + name + '\n💰 *Price:*    ' + fmt(service.price, biz.currency) + '\n━━━━━━━━━━━━━━━━━━━━\n\nReply *0* for main menu.';
    }
    if (lower === 'no' || lower === 'n' || text === '2') { session.reset(phone); return '❌ Booking cancelled.\n\nReply *0* for main menu or *hi* to start again.'; }
    return 'Please reply *YES* to confirm or *NO* to cancel.';
  }

  // ── CANCEL ───────────────────────────────────────────────
  if (s.step === 'CANCEL_SELECT') {
    const { cancelList } = s.data;
    const idx = parseNum(text, cancelList.length);
    if (idx === null) return '❓ Please choose a number between 1 and ' + cancelList.length + '.';
    const result = await store.cancel(phone, cancelList[idx].id);
    session.set(phone, 'DONE');
    if (!result.success) return '❌ Could not cancel. Try again from the main menu.';
    const a = result.appointment;
    return '✅ *Appointment Cancelled*\n\n🔖 ID: `' + a.id + '`\n🏢 ' + a.businessName + '\n✂️ ' + (a.serviceName||'—') + '\n📅 ' + moment(a.date).format('ddd, DD MMM YYYY') + ' at ' + a.slot + '\n\nReply *0* for main menu.';
  }

  // ── RESCHEDULE ───────────────────────────────────────────
  if (s.step === 'RESCHEDULE_SELECT') {
    const { rescheduleList } = s.data;
    const idx = parseNum(text, rescheduleList.length);
    if (idx === null) return '❓ Please choose a number between 1 and ' + rescheduleList.length + '.';
    const appt  = rescheduleList[idx];
    const staff = biz.staff.find(st => st.id === appt.staffId) || biz.staff[0];
    session.set(phone, 'RESCHEDULE_DATE', { appt, staff });
    return buildDateMenu(biz);
  }

  if (s.step === 'RESCHEDULE_DATE') {
    const { appt, staff } = s.data;
    const dates = getAvailableDates(biz);
    const idx = parseNum(text, dates.length);
    if (idx === null) return '❓ Please choose a date number between 1 and ' + dates.length + '.';
    const newDate = dates[idx];
    const taken   = await store.getTakenSlots(biz._id, staff.id, newDate);
    session.set(phone, 'RESCHEDULE_SLOT', { newDate, slots: getSlotsForStaff(biz, staff) });
    return buildSlotMenu(biz, staff, taken);
  }

  if (s.step === 'RESCHEDULE_SLOT') {
    const { appt, staff, newDate, slots } = s.data;
    const idx = parseNum(text, slots.length);
    if (idx === null) return '❓ Please choose a slot number between 1 and ' + slots.length + '.';
    const newSlot = slots[idx];
    const taken   = await store.getTakenSlots(biz._id, staff.id, newDate);
    if (taken.includes(newSlot)) return msg(biz, 'slotUnavailableMessage', '❌ That slot is already booked.') + '\n\n' + buildSlotMenu(biz, staff, taken);
    const result = await store.reschedule(phone, appt.id, newDate, newSlot);
    session.set(phone, 'DONE');
    if (!result.success) return '❌ Could not reschedule. Please try again.';
    const a = result.appointment;
    return '✅ *Appointment Rescheduled!*\n\n🔖 ID: `' + a.id + '`\n🏢 ' + a.businessName + '\n✂️ ' + (a.serviceName||'—') + '\n👤 ' + a.staffName + '\n📅 *New Date:* ' + moment(a.date).format('ddd, DD MMM YYYY') + ' at ' + a.slot + '\n\nReply *0* for main menu.';
  }

  // ── Fallback ─────────────────────────────────────────────
  session.set(phone, 'MAIN_MENU');
  return buildWelcome(biz);
}

module.exports = { handleMessage };