// ============================================================
//  src/flowHandler.js  —  Smart AI-like conversation flow
//
//  Features:
//  • Free-text NLP  — no need to type numbers only
//  • Per-staff slot availability (different staff = independent slots)
//  • Walk-in mode   — instant same-day booking for in-shop customers
//  • Custom messages from dashboard botSettings (all keys respected)
//  • Fuzzy service/staff name matching
//  • Understands dates: "tomorrow", "next monday", "14 apr", ISO
//  • Understands times: "3pm", "14:00", "afternoon", "10:30 am"
//  • Contextual recovery with helpful re-prompts on bad input
//  • Timezone-aware (IST by default, reads from business.timezone)
// ============================================================

const moment  = require('moment-timezone');
const { getBusiness, refreshBusiness } = require('../data/businesses');
const session = require('./sessionManager');
const store   = require('./appointmentStore');

// ─── Timezone helper ──────────────────────────────────────────
// All "now" / "today" calculations go through this.
// biz.timezone should be e.g. "Asia/Kolkata". Falls back to IST.
let _bizTimezone = 'Asia/Kolkata';

function setTimezone(tz) {
  if (tz && tz.trim()) _bizTimezone = tz.trim();
}

function nowInBiz() {
  return moment().tz(_bizTimezone);
}

function todayInBiz() {
  return nowInBiz().startOf('day');
}

// ─── Intent keyword sets ─────────────────────────────────────
const GREETINGS     = new Set(['hi','hello','hey','hii','hai','helo','sup','yo','start','begin','restart','hola','howdy']);
const RESET_WORDS   = new Set(['menu','back','restart','reset','main','home']);
const CONFIRM_YES   = new Set(['yes','y','yeah','yep','yup','sure','ok','okay','confirm','correct','right','haan','ha','done','go ahead']);
const CONFIRM_NO    = new Set(['no','n','nope','nahi','na','wrong','cancel it']);
const HELP_WORDS    = new Set(['help','faq','info','support','contact','?']);
const BOOK_KW       = ['book','appointment','appt','schedule','slot','fix','reserve','set','want','need'];
const VIEW_KW       = ['view','see','show','list','my appointments','check','status','upcoming'];
const CANCEL_KW     = ['cancel','delete','remove','drop','abort'];
const RESCHEDULE_KW = ['reschedule','change','move','shift','postpone','earlier','later','another day'];
const WALKIN_KW     = ['walk','walkin','walk-in','walk in','im here','i am here','arrived','at shop','at salon','at store'];

// ─── Utilities ───────────────────────────────────────────────
function msg(biz, key, fallback) {
  const v = biz && biz.botSettings && biz.botSettings[key];
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
}

function fmt(amount, currency) {
  try { return new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:0}).format(amount||0); }
  catch { return '₹'+(amount||0); }
}

function detectIntent(lower) {
  if (GREETINGS.has(lower))                          return 'greeting';
  if (RESET_WORDS.has(lower)||lower==='0')           return 'reset';
  if (HELP_WORDS.has(lower))                         return 'help';
  if (WALKIN_KW.some(w=>lower.includes(w)))          return 'walkin';
  if (CANCEL_KW.some(w=>lower.includes(w)))          return 'cancel';
  if (RESCHEDULE_KW.some(w=>lower.includes(w)))      return 'reschedule';
  if (VIEW_KW.some(w=>lower.includes(w)))            return 'view';
  if (BOOK_KW.some(w=>lower.includes(w)))            return 'book';
  return null;
}

function fuzzyFind(query, items, key='name') {
  const q = query.toLowerCase().trim();
  return items.find(i=>i[key].toLowerCase()===q)
    || items.find(i=>i[key].toLowerCase().startsWith(q))
    || items.find(i=>i[key].toLowerCase().includes(q))
    || (() => {
      const words = q.split(/\s+/).filter(w=>w.length>2);
      let best=null, best_score=0;
      for (const item of items) {
        const score = words.filter(w=>item[key].toLowerCase().includes(w)).length;
        if (score>best_score) { best_score=score; best=item; }
      }
      return best_score>0 ? best : null;
    })();
}

function parseIdx(text, max) {
  const n=parseInt(text.trim(),10);
  return (!isNaN(n)&&n>=1&&n<=max) ? n-1 : null;
}

// FIX: All date parsing now uses timezone-aware "today" via todayInBiz()
function extractDate(text) {
  const lower = text.toLowerCase().trim();
  const today = todayInBiz(); // ← was: moment().startOf('day') — wrong for IST
  if (/\btoday\b/.test(lower))       return today.clone();
  if (/\btomorrow\b/.test(lower))    return today.clone().add(1,'day');
  if (/\bday after\b/.test(lower))   return today.clone().add(2,'day');
  const dayMatch = lower.match(/\b(?:next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (dayMatch) {
    const idx=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(dayMatch[1]);
    const d=today.clone().day(idx);
    if (d.isSameOrBefore(today,'day')) d.add(7,'days');
    return d;
  }
  const iso=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    // Parse the ISO date in business timezone
    const m=moment.tz(`${iso[1]}-${iso[2]}-${iso[3]}`,'YYYY-MM-DD',_bizTimezone);
    return m.isValid()?m:null;
  }
  const dm=text.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (dm) {
    const m=moment.tz(`${dm[2]}-${dm[1]}`,'MM-DD',_bizTimezone).year(nowInBiz().year());
    if (m.isBefore(today)) m.add(1,'year');
    return m.isValid()?m:null;
  }
  const months='jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
  const mRe=new RegExp(`\\b(\\d{1,2})\\s+(${months})\\b|\\b(${months})\\s+(\\d{1,2})\\b`);
  const mMatch=lower.match(mRe);
  if (mMatch) {
    const dayN=mMatch[1]||mMatch[4], monN=mMatch[2]||mMatch[3];
    const m=moment.tz(`${dayN} ${monN}`,'D MMM',_bizTimezone).year(nowInBiz().year());
    if (!m.isValid()) return null;
    if (m.isBefore(today)) m.add(1,'year');
    return m;
  }
  return null;
}

// FIX: extractTime returns a timezone-aware moment for "now"
function extractTime(text) {
  const lower=text.toLowerCase().trim();
  // Use start-of-day in business timezone as the base
  const base = todayInBiz(); // ← was: moment().startOf('day')
  let m=lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (m) {
    let h=parseInt(m[1],10), min=parseInt(m[2],10);
    if (m[3]==='pm'&&h!==12) h+=12;
    if (m[3]==='am'&&h===12) h=0;
    if (h>=0&&h<=23&&min>=0&&min<=59) return base.clone().hours(h).minutes(min).seconds(0);
  }
  m=lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let h=parseInt(m[1],10);
    if (m[2]==='pm'&&h!==12) h+=12;
    if (m[2]==='am'&&h===12) h=0;
    if (h>=0&&h<=23) return base.clone().hours(h).minutes(0).seconds(0);
  }
  if (/\bmorn/.test(lower))        return base.clone().hours(10).minutes(0).seconds(0);
  if (/\bnoon\b/.test(lower))      return base.clone().hours(12).minutes(0).seconds(0);
  if (/\bafternoon\b/.test(lower)) return base.clone().hours(14).minutes(0).seconds(0);
  if (/\bevening\b/.test(lower))   return base.clone().hours(17).minutes(0).seconds(0);
  return null;
}

// ─── Business logic ───────────────────────────────────────────
function getAvailableDates(biz, count=7) {
  const openDays=new Set((biz.businessHours||[]).filter(h=>h.isOpen).map(h=>h.day.toLowerCase()));
  const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const today=todayInBiz(); // ← was: moment().startOf('day')
  const result=[];
  let d=today.clone();
  while (result.length<count) {
    if (openDays.size===0||openDays.has(dayNames[d.day()])) result.push(d.clone());
    d.add(1,'day');
  }
  return result;
}

function isOpenDate(biz, dateMoment) {
  const openDays=new Set((biz.businessHours||[]).filter(h=>h.isOpen).map(h=>h.day.toLowerCase()));
  if (openDays.size===0) return true;
  const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return openDays.has(dayNames[dateMoment.day()]);
}

function getSlotsForStaff(biz, staffMember) {
  const start=staffMember.workStart||'09:00';
  const end=staffMember.workEnd||'18:00';
  const durations=(biz.services||[]).map(s=>s.duration||30).filter(d=>d>0);
  const step=durations.length>0?Math.min(...durations):30;
  const slots=[];
  // FIX: parse slot times relative to today in business timezone
  const base = todayInBiz(); // ← was: moment() base which could be UTC
  let cur=base.clone().startOf('day').add(
    parseInt(start.split(':')[0],10),'hours'
  ).add(parseInt(start.split(':')[1]||'0',10),'minutes');
  const fin=base.clone().startOf('day').add(
    parseInt(end.split(':')[0],10),'hours'
  ).add(parseInt(end.split(':')[1]||'0',10),'minutes');
  while (cur.isBefore(fin)) { slots.push(cur.clone()); cur.add(step,'minutes'); }
  return slots;
}

function resolveDate(text, biz) {
  const dates=getAvailableDates(biz,7);
  const idx=parseIdx(text,dates.length);
  if (idx!==null) return {moment:dates[idx],dateStr:dates[idx].format('YYYY-MM-DD')};
  const extracted=extractDate(text);
  if (!extracted) return null;
  const today=todayInBiz(); // ← was: moment().startOf('day')
  if (extracted.isBefore(today,'day')) return {past:true};
  if (!isOpenDate(biz,extracted)) return {closed:true,day:extracted.format('dddd')};
  return {moment:extracted,dateStr:extracted.format('YYYY-MM-DD')};
}

async function resolveSlot(text, biz, staffMember, dateStr) {
  const slots=getSlotsForStaff(biz,staffMember);
  const takenRaw=await store.getTakenSlots(biz._id,staffMember.id,dateStr);
  const takenSet=new Set(takenRaw);
  const idx=parseIdx(text,slots.length);
  if (idx!==null) {
    const slot=slots[idx], slotStr=slot.format('hh:mm A');
    return takenSet.has(slotStr)?{taken:true,slot,slotStr}:{slot,slotStr};
  }
  const extracted=extractTime(text);
  if (extracted) {
    let best=null, bestDiff=Infinity;
    for (const s of slots) {
      const diff=Math.abs(s.diff(extracted,'minutes'));
      if (diff<bestDiff) { bestDiff=diff; best=s; }
    }
    if (best&&bestDiff<=30) {
      const slotStr=best.format('hh:mm A');
      return takenSet.has(slotStr)?{taken:true,slot:best,slotStr}:{slot:best,slotStr};
    }
  }
  return null;
}

// ─── Message builders ────────────────────────────────────────
function buildWelcome(biz) {
  const welcome=msg(biz,'welcomeMessage',`👋 Welcome to *${biz.name}*! We're here to help you.`);
  return welcome+'\n\n'+
    '1️⃣  📅 *Book an Appointment*\n'+
    '2️⃣  🚶 *Walk-in Booking* _(I\'m at the shop now)_\n'+
    '3️⃣  📋 *View My Appointments*\n'+
    '4️⃣  ❌ *Cancel an Appointment*\n'+
    '5️⃣  🔄 *Reschedule an Appointment*\n'+
    '6️⃣  ℹ️  *Help & FAQs*\n\n'+
    'Reply with a *number* or just tell me what you need 😊';
}

function buildStaffMenu(biz, intro) {
  const header=intro||'👤 *Who would you like to book with?*';
  const list=biz.staff.map((s,i)=>`${i+1}️⃣  *${s.name}*${s.role?`\n     _${s.role}_`:''}`).join('\n\n');
  return `${header}\n\n${list}\n\nReply with a *number* or *name*, or *0* for main menu.`;
}

function buildServiceMenu(biz, intro) {
  const prompt=intro||msg(biz,'menuPrompt','✂️ *Which service would you like?*');
  const list=biz.services.map((s,i)=>`${i+1}️⃣  *${s.name}*\n     💰 ${fmt(s.price,biz.currency)}  ⏱ ${s.duration} min`).join('\n\n');
  return `${prompt}\n\n${list}\n\nReply with a *number* or *service name*, or *0* for main menu.`;
}

function buildDateMenu(biz, hint) {
  const prompt=msg(biz,'datePrompt','📅 *When would you like to come in?*');
  const today=todayInBiz(); // ← was: moment().startOf('day')
  const dates=getAvailableDates(biz,7);
  const list=dates.map((d,i)=>{
    const diff=d.diff(today,'days');
    const label=diff===0?`Today — ${d.format('ddd, DD MMM YYYY')}`
               :diff===1?`Tomorrow — ${d.format('ddd, DD MMM YYYY')}`
               :d.format('ddd, DD MMM YYYY');
    return `${i+1}️⃣  ${label}`;
  });
  const hintLine=hint?`\n\n_Didn't catch "${hint}" — please choose from below:_`:'';
  return `${prompt}${hintLine}\n\n${list.join('\n')}\n\nReply with a *number*, *date* (e.g. "tomorrow", "Mon", "14 Apr"), or *0*.`;
}

async function buildSlotMenu(biz, staffMember, date) {
  const slots=getSlotsForStaff(biz,staffMember);
  const takenRaw=await store.getTakenSlots(biz._id,staffMember.id,date);
  const takenSet=new Set(takenRaw);

  // FIX: For today, grey out slots that are in the past (current IST time)
  const now=nowInBiz(); // ← was missing entirely — past slots were never hidden
  const isToday=(date===now.format('YYYY-MM-DD'));

  const lines=slots.map((s,i)=>{
    const slotStr=s.format('hh:mm A');
    if (takenSet.has(slotStr))             return `${i+1}️⃣  ${slotStr} ❌ _Booked_`;
    if (isToday && s.isSameOrBefore(now))  return `${i+1}️⃣  ${slotStr} ⏳ _Past_`;
    return `${i+1}️⃣  ${slotStr} ✅`;
  });

  const prompt=msg(biz,'timePrompt','⏰ *Choose a time slot:*');
  const allUnavailable=slots.every(s=>{
    const slotStr=s.format('hh:mm A');
    return takenSet.has(slotStr)||(isToday&&s.isSameOrBefore(now));
  });
  const footer=allUnavailable
    ?'\n\n⚠️ _All slots are booked or past for this day. Reply *back* to choose another date._'
    :'\n\nReply with a *number* or *time* (e.g. "3pm", "14:00"), or *0* for menu.';
  const dateLabel=moment.tz(date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM YYYY');
  return `${prompt} for *${staffMember.name}* on *${dateLabel}*:\n\n${lines.join('\n')}${footer}`;
}

function buildConfirmPrompt({ biz, staff, service, date, slot, name, isWalkin=false }) {
  const dateLabel=moment.tz(date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM YYYY');
  const slotLabel=(typeof slot==='string')?slot:slot.format('hh:mm A');
  const walkinTag=isWalkin?'\n🚶 *Walk-in booking*':'';
  return `📋 *Please confirm your booking:*\n\n`+
    `🏢 *${biz.name}*${walkinTag}\n`+
    `✂️ *Service:*  ${service.name}\n`+
    `👤 *Staff:*    ${staff.name}\n`+
    `📅 *Date:*     ${dateLabel}\n`+
    `⏰ *Time:*     ${slotLabel}\n`+
    `👤 *Name:*     ${name}\n`+
    `💰 *Price:*    ${fmt(service.price,biz.currency)}\n`+
    `⏱ *Duration:* ${service.duration} min\n\n`+
    `Reply *YES* to confirm or *NO* to cancel.`;
}

function buildSuccess({ biz, appt, service, staff, date, slot, name, isWalkin=false }) {
  const dateLabel=moment.tz(date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM YYYY');
  const slotLabel=(typeof slot==='string')?slot:slot.format('hh:mm A');
  const tmpl=msg(biz,'confirmationTemplate','✅ *Your appointment is confirmed!*');
  return `${tmpl}\n\n`+
    `🔖 *Booking ID:* \`${appt.id}\`\n`+
    `━━━━━━━━━━━━━━━━━━━━\n`+
    `🏢 *${biz.name}*${isWalkin?'  🚶 Walk-in':''}\n`+
    `✂️ *Service:*  ${service.name}\n`+
    `👤 *Staff:*    ${staff.name}\n`+
    `📅 *Date:*     ${dateLabel}\n`+
    `⏰ *Time:*     ${slotLabel}\n`+
    `⏱ *Duration:* ${service.duration} min\n`+
    `👤 *Name:*     ${name}\n`+
    `💰 *Price:*    ${fmt(service.price,biz.currency)}\n`+
    `━━━━━━━━━━━━━━━━━━━━\n\n`+
    `Reply *0* for main menu or *hi* to make another booking.`;
}

function buildViewAppointments(appts) {
  if (!appts||appts.length===0) return '📋 You have *no appointments* yet.\n\nReply *1* to book one, or *0* for main menu.';
  const active=appts.filter(a=>a.status==='confirmed');
  const cancelled=appts.filter(a=>a.status==='cancelled');
  const today=nowInBiz().format('YYYY-MM-DD'); // ← was: moment().format('YYYY-MM-DD')
  let out='📋 *Your Appointments:*\n';
  if (active.length>0) {
    out+=`\n✅ *Upcoming (${active.length}):*\n`;
    active.forEach(a=>{
      const tag=a.date===today?' 🔔 *TODAY*':a.date<today?' _(past)_':'';
      out+=`\n🔖 \`${a.id}\`${tag}\n   🏢 ${a.businessName}\n   ✂️ ${a.serviceName||'—'}\n   👤 ${a.staffName}\n   📅 ${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM')} at ${a.slot}\n   💰 ${fmt(a.servicePrice,null)}\n`;
    });
  }
  if (cancelled.length>0) {
    out+=`\n❌ *Cancelled (${cancelled.length}):*\n`;
    cancelled.forEach(a=>{out+=`\n🔖 \`${a.id}\` — ${a.businessName} _(${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('DD MMM')} ${a.slot})_\n`;});
  }
  out+='\nReply *0* for main menu.';
  return out;
}

function buildHelp(biz) {
  const name=(biz&&biz.name)||'the business';
  return `ℹ️ *Help & FAQs — ${name}*\n\n`+
    `📌 *Book an appointment?*\nSay "book" or reply *1* from the main menu.\n\n`+
    `📌 *Walk-in booking?*\nSay "I'm here" or reply *2* to book for today right now.\n\n`+
    `📌 *View appointments?*\nReply *3* or say "show my bookings".\n\n`+
    `📌 *Cancel?*\nReply *4* or say "cancel my appointment".\n\n`+
    `📌 *Reschedule?*\nReply *5* or say "reschedule".\n\n`+
    `📌 *Tips:*\nYou can type naturally — e.g. "book haircut tomorrow at 3pm".\n\n`+
    `━━━━━━━━━━━━━━━━━\nReply *0* for main menu.`;
}

// ─── Flow entry helpers ───────────────────────────────────────
async function startBook(phone, biz) {
  if (!biz.staff||biz.staff.length===0) return msg(biz,'noServicesMessage',`Hello! *${biz.name}* has no staff configured. Please contact us.`);
  if (biz.staff.length===1) { session.set(phone,'BOOK_SELECT_SERVICE',{staff:biz.staff[0]}); return buildServiceMenu(biz); }
  session.set(phone,'BOOK_SELECT_STAFF');
  return buildStaffMenu(biz);
}

async function startWalkin(phone, biz) {
  if (!biz.staff||biz.staff.length===0) return msg(biz,'noServicesMessage',`Hello! *${biz.name}* has no staff configured.`);
  if (biz.staff.length===1) { session.set(phone,'BOOK_SELECT_SERVICE',{staff:biz.staff[0],isWalkin:true}); return buildServiceMenu(biz); }
  session.set(phone,'BOOK_SELECT_STAFF',{isWalkin:true});
  return `🚶 *Walk-in Booking* — Welcome! Let's get you sorted quickly.\n\n${buildStaffMenu(biz,'👤 *Who would you like to see today?*')}`;
}

async function startView(phone) {
  const appts=await store.getByPhone(phone);
  session.reset(phone);
  return buildViewAppointments(appts);
}

async function startCancel(phone, biz) {
  const active=(await store.getByPhone(phone)).filter(a=>a.status==='confirmed');
  if (!active.length) return '❌ You have no active appointments to cancel.\n\nReply *0* for main menu.';
  session.set(phone,'CANCEL_SELECT',{cancelList:active});
  return `🗑️ *Which appointment would you like to cancel?*\n\n`+
    active.map((a,i)=>`${i+1}️⃣  \`${a.id}\`\n   ✂️ ${a.serviceName||'—'}\n   👤 ${a.staffName}\n   📅 ${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM')} at ${a.slot}`).join('\n\n')+
    '\n\nReply with the *number*.';
}

async function startReschedule(phone, biz) {
  const active=(await store.getByPhone(phone)).filter(a=>a.status==='confirmed');
  if (!active.length) return '❌ You have no active appointments to reschedule.\n\nReply *0* for main menu.';
  session.set(phone,'RESCHEDULE_SELECT',{rescheduleList:active});
  return `🔄 *Which appointment would you like to reschedule?*\n\n`+
    active.map((a,i)=>`${i+1}️⃣  \`${a.id}\`\n   ✂️ ${a.serviceName||'—'}\n   👤 ${a.staffName}\n   📅 ${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM')} at ${a.slot}`).join('\n\n')+
    '\n\nReply with the *number*.';
}

// ─── Main handler ─────────────────────────────────────────────
async function handleMessage(phone, rawText) {
  const text  = rawText.trim();
  const lower = text.toLowerCase();

  let biz;
  try { biz=await getBusiness(); }
  catch (err) {
    console.error('[flow] Could not load business:', err.message);
    return `⚠️ The bot is not fully configured. Please contact the administrator.\n\nError: ${err.message}`;
  }

  // FIX: Load the business timezone on every message so it's always current
  setTimezone(biz.timezone || 'Asia/Kolkata');

  // Admin command
  if (lower==='refresh_bot_config') {
    try { biz=await refreshBusiness(); return `✅ Config reloaded: "${biz.name}" — ${biz.services.length} services, ${biz.staff.length} staff.`; }
    catch (e) { return `❌ Reload failed: ${e.message}`; }
  }

  const intent=detectIntent(lower);

  // Global overrides — work from any state
  if (intent==='reset'||text==='0') { session.reset(phone); return buildWelcome(biz); }
  if (intent==='greeting')           { session.set(phone,'MAIN_MENU'); return buildWelcome(biz); }
  if (intent==='help')               return buildHelp(biz);

  let s=session.get(phone);

  // Walk-in from any state
  if (intent==='walkin'||(text==='2'&&(!s||['MAIN_MENU','DONE'].includes(s.step)))) {
    return startWalkin(phone, biz);
  }

  // Intent overrides when at top-level states
  if (!s||s.step==='MAIN_MENU'||s.step==='DONE') {
    if (intent==='cancel')     return startCancel(phone, biz);
    if (intent==='reschedule') return startReschedule(phone, biz);
    if (intent==='view')       return startView(phone);
    if (intent==='book')       return startBook(phone, biz);
    if (!s) { session.set(phone,'MAIN_MENU'); return buildWelcome(biz); }
  }

  // ── MAIN MENU ─────────────────────────────────────────────
  if (s.step==='MAIN_MENU') {
    if (text==='1') return startBook(phone, biz);
    if (text==='3') return startView(phone);
    if (text==='4') return startCancel(phone, biz);
    if (text==='5') return startReschedule(phone, biz);
    if (text==='6') return buildHelp(biz);
    return `❓ Please reply with a number *(1–6)*, or just tell me what you need.\n\nE.g. "book haircut", "cancel my appointment", "show bookings"`;
  }

  // ── BOOK: SELECT STAFF ────────────────────────────────────
  if (s.step==='BOOK_SELECT_STAFF') {
    const isWalkin=s.data.isWalkin||false;
    if (biz.staff.length===1) { session.set(phone,'BOOK_SELECT_SERVICE',{staff:biz.staff[0],isWalkin}); return buildServiceMenu(biz); }
    const idx=parseIdx(text,biz.staff.length);
    const picked=idx!==null?biz.staff[idx]:fuzzyFind(text,biz.staff);
    if (!picked) return `❓ I didn't catch that.\n\n${buildStaffMenu(biz)}`;
    session.set(phone,'BOOK_SELECT_SERVICE',{staff:picked,isWalkin});
    return buildServiceMenu(biz,`✅ Great, *${picked.name}* it is!\n\n${msg(biz,'menuPrompt','✂️ *Which service would you like?*')}`);
  }

  // ── BOOK: SELECT SERVICE ──────────────────────────────────
  if (s.step==='BOOK_SELECT_SERVICE') {
    const isWalkin=s.data.isWalkin||false;
    if (!biz.services||biz.services.length===0) return msg(biz,'noServicesMessage',`Hello! *${biz.name}* has no services configured yet.`);
    const idx=parseIdx(text,biz.services.length);
    const picked=idx!==null?biz.services[idx]:fuzzyFind(text,biz.services);
    if (!picked) return `${msg(biz,'invalidServiceMessage',"❓ I couldn't match that service.")}\n\n${buildServiceMenu(biz)}`;
    if (isWalkin) {
      const today=nowInBiz().format('YYYY-MM-DD'); // ← was: moment().format('YYYY-MM-DD')
      session.set(phone,'BOOK_SELECT_SLOT',{service:picked,date:today,isWalkin:true});
      return await buildSlotMenu(biz,s.data.staff,today);
    }
    session.set(phone,'BOOK_SELECT_DATE',{service:picked});
    return buildDateMenu(biz);
  }

  // ── BOOK: SELECT DATE ─────────────────────────────────────
  if (s.step==='BOOK_SELECT_DATE') {
    const resolved=resolveDate(text,biz);
    if (!resolved)       return `${msg(biz,'invalidDateMessage','❓ I didn\'t understand that date.')}\n\n${buildDateMenu(biz,text)}`;
    if (resolved.past)   return `⚠️ That date is in the past.\n\n${buildDateMenu(biz)}`;
    if (resolved.closed) return `⚠️ We're closed on *${resolved.day}*.\n\n${buildDateMenu(biz)}`;
    session.set(phone,'BOOK_SELECT_SLOT',{date:resolved.dateStr});
    return await buildSlotMenu(biz,s.data.staff,resolved.dateStr);
  }

  // ── BOOK: SELECT SLOT ─────────────────────────────────────
  if (s.step==='BOOK_SELECT_SLOT') {
    const {staff,service,date,isWalkin}=s.data;
    const resolved=await resolveSlot(text,biz,staff,date);
    if (!resolved)      return `${msg(biz,'invalidTimeMessage','❓ I didn\'t catch that time.')}\n\n${await buildSlotMenu(biz,staff,date)}`;
    if (resolved.taken) return `${msg(biz,'slotUnavailableMessage','❌ That slot is already booked.')} Please choose another.\n\n${await buildSlotMenu(biz,staff,date)}`;

    // FIX: Reject past slots when booking for today
    const now=nowInBiz();
    const isToday=(date===now.format('YYYY-MM-DD'));
    if (isToday && resolved.slot.isSameOrBefore(now)) {
      return `⚠️ That time has already passed.\n\n${await buildSlotMenu(biz,staff,date)}`;
    }

    session.set(phone,'BOOK_ASK_NAME',{slot:resolved.slotStr,isWalkin:isWalkin||false});
    return `📝 ${msg(biz,'namePromptMessage','Please enter your *full name* to confirm the booking.')}`;
  }

  // ── BOOK: ASK NAME ────────────────────────────────────────
  if (s.step==='BOOK_ASK_NAME') {
    const name=text.trim();
    if (name.length<2||/^\d+$/.test(name)) return `⚠️ Please enter a valid name (at least 2 letters).`;
    session.set(phone,'BOOK_CONFIRM',{name});
    const {staff,service,date,slot,isWalkin}=s.data;
    return buildConfirmPrompt({biz,staff,service,date,slot,name,isWalkin:isWalkin||false});
  }

  // ── BOOK: CONFIRM ─────────────────────────────────────────
  if (s.step==='BOOK_CONFIRM') {
    const {staff,service,date,slot,name,isWalkin}=s.data;
    if (CONFIRM_YES.has(lower)||text==='1') {
      const takenNow=await store.getTakenSlots(biz._id,staff.id,date);
      if (takenNow.includes(slot)) {
        session.set(phone,'BOOK_SELECT_SLOT',{});
        return `${msg(biz,'slotUnavailableMessage','❌ Sorry, that slot was just taken.')} Please choose another.\n\n${await buildSlotMenu(biz,staff,date)}`;
      }
      const result=await store.book({
        phone, name,
        businessId:String(biz._id), businessName:biz.name,
        staffId:staff.id, staffName:staff.name,
        serviceId:service.id, serviceName:service.name,
        servicePrice:service.price, serviceDuration:service.duration,
        date, slot,
        source: isWalkin?'walk_in':'whatsapp',
      });
      session.set(phone,'DONE');
      if (!result.success) return `${msg(biz,'slotUnavailableMessage','❌ Sorry, that slot was just taken.')}\n\nReply *0* for main menu.`;
      return buildSuccess({biz,appt:result.appointment,service,staff,date,slot,name,isWalkin:isWalkin||false});
    }
    if (CONFIRM_NO.has(lower)||text==='2') { session.reset(phone); return `❌ Booking cancelled.\n\nReply *0* for main menu or *hi* to start again.`; }
    return `Please reply *YES* to confirm or *NO* to cancel.\n\n${buildConfirmPrompt({biz,staff,service,date,slot,name,isWalkin:isWalkin||false})}`;
  }

  // ── CANCEL: SELECT ────────────────────────────────────────
  if (s.step==='CANCEL_SELECT') {
    const {cancelList}=s.data;
    const idx=parseIdx(text,cancelList.length);
    if (idx===null) return `❓ Please choose a number between 1 and ${cancelList.length}.`;
    session.set(phone,'CANCEL_CONFIRM',{appt:cancelList[idx]});
    const a=cancelList[idx];
    return `⚠️ Are you sure you want to cancel:\n\n🔖 \`${a.id}\`\n✂️ ${a.serviceName||'—'}\n📅 ${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM')} at ${a.slot}\n\nReply *YES* to confirm or *NO* to keep it.`;
  }

  if (s.step==='CANCEL_CONFIRM') {
    if (CONFIRM_YES.has(lower)||text==='1') {
      const result=await store.cancel(phone,s.data.appt.id);
      session.set(phone,'DONE');
      if (!result.success) return '❌ Could not cancel. Try again from the main menu.';
      const a=result.appointment;
      return `✅ *Appointment Cancelled*\n\n🔖 ID: \`${a.id}\`\n🏢 ${a.businessName}\n✂️ ${a.serviceName||'—'}\n📅 ${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM YYYY')} at ${a.slot}\n\nReply *0* for main menu.`;
    }
    if (CONFIRM_NO.has(lower)||text==='2') { session.reset(phone); return `✅ Your appointment is kept.\n\nReply *0* for main menu.`; }
    return `Please reply *YES* to cancel or *NO* to keep the appointment.`;
  }

  // ── RESCHEDULE: SELECT ────────────────────────────────────
  if (s.step==='RESCHEDULE_SELECT') {
    const {rescheduleList}=s.data;
    const idx=parseIdx(text,rescheduleList.length);
    if (idx===null) return `❓ Please choose a number between 1 and ${rescheduleList.length}.`;
    const appt=rescheduleList[idx];
    const staff=biz.staff.find(st=>st.id===appt.staffId)||biz.staff[0];
    session.set(phone,'RESCHEDULE_DATE',{appt,staff});
    return buildDateMenu(biz);
  }

  if (s.step==='RESCHEDULE_DATE') {
    const {appt,staff}=s.data;
    const resolved=resolveDate(text,biz);
    if (!resolved)       return `${msg(biz,'invalidDateMessage','❓ I didn\'t understand that date.')}\n\n${buildDateMenu(biz)}`;
    if (resolved.past)   return `⚠️ That date is in the past.\n\n${buildDateMenu(biz)}`;
    if (resolved.closed) return `⚠️ We're closed on *${resolved.day}*.\n\n${buildDateMenu(biz)}`;
    session.set(phone,'RESCHEDULE_SLOT',{newDate:resolved.dateStr});
    return await buildSlotMenu(biz,staff,resolved.dateStr);
  }

  if (s.step==='RESCHEDULE_SLOT') {
    const {appt,staff,newDate}=s.data;
    const resolved=await resolveSlot(text,biz,staff,newDate);
    if (!resolved)      return `${msg(biz,'invalidTimeMessage','❓ I didn\'t catch that time.')}\n\n${await buildSlotMenu(biz,staff,newDate)}`;
    if (resolved.taken) return `${msg(biz,'slotUnavailableMessage','❌ That slot is already booked.')}\n\n${await buildSlotMenu(biz,staff,newDate)}`;
    const result=await store.reschedule(phone,appt.id,newDate,resolved.slotStr);
    session.set(phone,'DONE');
    if (!result.success) return '❌ Could not reschedule. Please try again.';
    const a=result.appointment;
    return `✅ *Appointment Rescheduled!*\n\n🔖 ID: \`${a.id}\`\n🏢 ${a.businessName}\n✂️ ${a.serviceName||'—'}\n👤 ${a.staffName}\n📅 *New Date:* ${moment.tz(a.date,'YYYY-MM-DD',_bizTimezone).format('ddd, DD MMM YYYY')} at ${a.slot}\n\nReply *0* for main menu.`;
  }

  // ── Fallback ──────────────────────────────────────────────
  session.set(phone,'MAIN_MENU');
  return `❓ I didn't understand that. Let me show you the main menu.\n\n${buildWelcome(biz)}`;
}

module.exports = { handleMessage };