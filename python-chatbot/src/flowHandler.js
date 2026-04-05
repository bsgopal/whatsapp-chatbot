// ============================================================
//  src/flowHandler.js  —  Full conversation flow with services,
//  confirmation step, help, and smart keyword handling
// ============================================================

const moment    = require("moment");
const businesses = require("../data/businesses");
const session   = require("./sessionManager");
const store     = require("./appointmentStore");
const MSG       = require("./messages");

// ── Available dates helper ────────────────────────────────────
function getAvailableDates(workingDays) {
  const today = moment();
  const available = [];
  let d = today.clone();
  while (available.length < 7) {
    if (workingDays.includes(d.format("dddd"))) {
      available.push(d.format("YYYY-MM-DD"));
    }
    d.add(1, "day");
  }
  return available;
}

// ── Parse numeric input safely (returns 0-indexed) ───────────
function parseNum(text, max) {
  const n = parseInt(text.trim(), 10);
  if (isNaN(n) || n < 1 || n > max) return null;
  return n - 1;
}

// ── Main message handler ──────────────────────────────────────
async function handleMessage(phone, rawText) {
  const text  = rawText.trim();
  const lower = text.toLowerCase();

  // ── Global keywords ─────────────────────────────────────────
  if (text === "0" || lower === "menu" || lower === "back") {
    session.reset(phone);
    return MSG.welcome();
  }

  if (["hi","hello","hey","start","hii","hai","book","appointment"].includes(lower)) {
    session.set(phone, "MAIN_MENU");
    return MSG.welcome();
  }

  if (lower === "help" || lower === "faq") {
    return MSG.help();
  }

  const s = session.get(phone);

  // ── No session → welcome ────────────────────────────────────
  if (!s) {
    session.set(phone, "MAIN_MENU");
    return MSG.welcome();
  }

  // ════════════════════════════════════════════════════════════
  //  MAIN MENU
  // ════════════════════════════════════════════════════════════
  if (s.step === "MAIN_MENU") {
    if (text === "1") {
      session.set(phone, "BOOK_SELECT_BUSINESS");
      return MSG.selectBusiness(businesses);
    }
    if (text === "2") {
      const appts = await store.getByPhone(phone);
      session.reset(phone);
      return MSG.viewAppointments(appts);
    }
    if (text === "3") {
      const appts = await store.getByPhone(phone);
      const active = appts.filter(a => a.status === "confirmed");
      if (active.length === 0) return MSG.askCancelId([]);
      session.set(phone, "CANCEL_SELECT", { cancelList: active });
      return MSG.askCancelId(active);
    }
    if (text === "4") {
      const appts = await store.getByPhone(phone);
      const active = appts.filter(a => a.status === "confirmed");
      if (active.length === 0) return MSG.askRescheduleId([]);
      session.set(phone, "RESCHEDULE_SELECT", { rescheduleList: active });
      return MSG.askRescheduleId(active);
    }
    if (text === "5") {
      session.reset(phone);
      return MSG.help();
    }
    return MSG.invalidInput();
  }

  // ════════════════════════════════════════════════════════════
  //  BOOKING FLOW:  Business → Staff → Service → Date → Slot → Name → Confirm
  // ════════════════════════════════════════════════════════════

  // B1: Choose business
  if (s.step === "BOOK_SELECT_BUSINESS") {
    const idx = parseNum(text, businesses.length);
    if (idx === null) return MSG.invalidInput();
    const biz = businesses[idx];
    session.set(phone, "BOOK_SELECT_STAFF", { biz });
    return MSG.selectStaff(biz.staff);
  }

  // B2: Choose staff
  if (s.step === "BOOK_SELECT_STAFF") {
    const { biz } = s.data;
    const idx = parseNum(text, biz.staff.length);
    if (idx === null) return MSG.invalidInput();
    const staff = biz.staff[idx];
    session.set(phone, "BOOK_SELECT_SERVICE", { staff });
    return MSG.selectService(biz.services);
  }

  // B3: Choose service  ← NEW STEP
  if (s.step === "BOOK_SELECT_SERVICE") {
    const { biz } = s.data;
    const idx = parseNum(text, biz.services.length);
    if (idx === null) return MSG.invalidInput();
    const service = biz.services[idx];
    session.set(phone, "BOOK_SELECT_DATE", { service });
    return MSG.selectDate(biz.workingDays);
  }

  // B4: Choose date
  if (s.step === "BOOK_SELECT_DATE") {
    const { biz } = s.data;
    const dates = getAvailableDates(biz.workingDays);
    const idx = parseNum(text, dates.length);
    if (idx === null) return MSG.invalidInput();
    const date = dates[idx];
    session.set(phone, "BOOK_SELECT_SLOT", { date });
    const { staff } = s.data;
    const taken = await store.getTakenSlots(biz.id, staff.id, date);
    return MSG.selectSlot(biz.slots, taken);
  }

  // B5: Choose slot
  if (s.step === "BOOK_SELECT_SLOT") {
    const { biz, staff, date } = s.data;
    const idx = parseNum(text, biz.slots.length);
    if (idx === null) return MSG.invalidInput();
    const slot = biz.slots[idx];
    const taken = await store.getTakenSlots(biz.id, staff.id, date);
    if (taken.includes(slot)) return MSG.slotTaken() + "\n\n" + MSG.selectSlot(biz.slots, taken);
    session.set(phone, "BOOK_ASK_NAME", { slot });
    return MSG.askName();
  }

  // B6: Collect name
  if (s.step === "BOOK_ASK_NAME") {
    const name = text;
    if (name.length < 2 || /^\d+$/.test(name)) {
      return `⚠️ Please enter a valid full name (letters only).`;
    }
    const { biz, staff, service, date, slot } = s.data;
    session.set(phone, "BOOK_CONFIRM", { name });
    return MSG.askConfirm({
      businessName:  biz.name,
      staffName:     staff.name,
      serviceName:   service.name,
      servicePrice:  service.price,
      date,
      slot,
      name,
    });
  }

  // B7: Final confirmation (YES / NO)
  if (s.step === "BOOK_CONFIRM") {
    const { biz, staff, service, date, slot, name } = s.data;

    if (lower === "yes" || lower === "y" || text === "1") {
      const result = await store.book({
        phone,
        name,
        businessId:      biz.id,
        businessName:    biz.name,
        staffId:         staff.id,
        staffName:       staff.name,
        serviceId:       service.id,
        serviceName:     service.name,
        servicePrice:    service.price,
        serviceDuration: service.duration,
        date,
        slot,
      });

      session.set(phone, "DONE");
      if (!result.success) return MSG.slotTaken();

      return MSG.confirmBooking({
        id:              result.appointment.id,
        businessName:    biz.name,
        staffName:       staff.name,
        serviceName:     service.name,
        servicePrice:    service.price,
        serviceDuration: service.duration,
        date,
        slot,
        name,
      });
    }

    if (lower === "no" || lower === "n" || text === "2") {
      session.reset(phone);
      return `❌ Booking cancelled.\n\nReply *0* for main menu or *hi* to start again.`;
    }

    return `Please reply *YES* to confirm or *NO* to cancel.`;
  }

  // ════════════════════════════════════════════════════════════
  //  CANCEL FLOW
  // ════════════════════════════════════════════════════════════
  if (s.step === "CANCEL_SELECT") {
    const { cancelList } = s.data;
    const idx = parseNum(text, cancelList.length);
    if (idx === null) return MSG.invalidInput();
    const appt = cancelList[idx];
    const result = await store.cancel(phone, appt.id);
    session.set(phone, "DONE");
    if (!result.success) return `❌ Could not cancel. Try again from the main menu.`;
    return MSG.cancelConfirm(result.appointment);
  }

  // ════════════════════════════════════════════════════════════
  //  RESCHEDULE FLOW
  // ════════════════════════════════════════════════════════════
  if (s.step === "RESCHEDULE_SELECT") {
    const { rescheduleList } = s.data;
    const idx = parseNum(text, rescheduleList.length);
    if (idx === null) return MSG.invalidInput();
    const appt = rescheduleList[idx];
    const biz  = businesses.find(b => b.id === appt.businessId);
    session.set(phone, "RESCHEDULE_DATE", { appt, biz });
    return MSG.selectDate(biz.workingDays);
  }

  if (s.step === "RESCHEDULE_DATE") {
    const { appt, biz } = s.data;
    const dates = getAvailableDates(biz.workingDays);
    const idx = parseNum(text, dates.length);
    if (idx === null) return MSG.invalidInput();
    const newDate = dates[idx];
    session.set(phone, "RESCHEDULE_SLOT", { newDate });
    const taken = await store.getTakenSlots(biz.id, appt.staffId, newDate);
    return MSG.selectSlot(biz.slots, taken);
  }

  if (s.step === "RESCHEDULE_SLOT") {
    const { appt, biz, newDate } = s.data;
    const idx = parseNum(text, biz.slots.length);
    if (idx === null) return MSG.invalidInput();
    const newSlot = biz.slots[idx];
    const taken = await store.getTakenSlots(biz.id, appt.staffId, newDate);
    if (taken.includes(newSlot)) {
      return MSG.slotTaken() + "\n\n" + MSG.selectSlot(biz.slots, taken);
    }
    const result = await store.reschedule(phone, appt.id, newDate, newSlot);
    session.set(phone, "DONE");
    if (!result.success) return `❌ Could not reschedule. Please try again.`;
    return MSG.rescheduleConfirm(result.appointment);
  }

  // ── Fallback ────────────────────────────────────────────────
  session.set(phone, "MAIN_MENU");
  return MSG.welcome();
}

module.exports = { handleMessage };