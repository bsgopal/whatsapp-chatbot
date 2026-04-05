// ============================================================
//  src/flowHandler.js  —  All conversation steps & transitions
// ============================================================

const moment    = require("moment");
const businesses = require("../data/businesses");
const session   = require("./sessionManager");
const store     = require("./appointmentStore");
const MSG       = require("./messages");

// Helper: get available dates for a business
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

// Helper: parse numeric input safely
function parseNum(text, max) {
  const n = parseInt(text.trim(), 10);
  if (isNaN(n) || n < 1 || n > max) return null;
  return n - 1; // 0-indexed
}

// ── Main handler ─────────────────────────────────────────────
async function handleMessage(phone, rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // Global: "0" or "menu" → reset to main menu
  if (text === "0" || lower === "menu") {
    session.reset(phone);
    return MSG.welcome();
  }

  const s = session.get(phone);

  // ── No session OR greeting → show main menu ───────────────
  if (!s || ["hi", "hello", "hey", "start", "hii", "hai"].includes(lower)) {
    session.set(phone, "MAIN_MENU");
    return MSG.welcome();
  }

  // ── MAIN MENU ─────────────────────────────────────────────
  if (s.step === "MAIN_MENU") {
    if (text === "1") { session.set(phone, "BOOK_SELECT_BUSINESS"); return MSG.selectBusiness(businesses); }
    if (text === "2") { session.reset(phone); return MSG.viewAppointments(store.getByPhone(phone)); }
    if (text === "3") {
      const appts = store.getByPhone(phone);
      const active = appts.filter((a) => a.status === "confirmed");
      if (active.length === 0) return MSG.askCancelId([]);
      session.set(phone, "CANCEL_SELECT", { cancelList: active });
      return MSG.askCancelId(active);
    }
    if (text === "4") {
      const appts = store.getByPhone(phone);
      const active = appts.filter((a) => a.status === "confirmed");
      if (active.length === 0) return MSG.askRescheduleId([]);
      session.set(phone, "RESCHEDULE_SELECT", { rescheduleList: active });
      return MSG.askRescheduleId(active);
    }
    return MSG.invalidInput();
  }

  // ════════════════════════════════════════════════════════════
  //  BOOKING FLOW
  // ════════════════════════════════════════════════════════════

  // Step B1: Choose business
  if (s.step === "BOOK_SELECT_BUSINESS") {
    const idx = parseNum(text, businesses.length);
    if (idx === null) return MSG.invalidInput();
    const biz = businesses[idx];
    session.set(phone, "BOOK_SELECT_STAFF", { biz });
    return MSG.selectStaff(biz.staff);
  }

  // Step B2: Choose staff
  if (s.step === "BOOK_SELECT_STAFF") {
    const { biz } = s.data;
    const idx = parseNum(text, biz.staff.length);
    if (idx === null) return MSG.invalidInput();
    const staff = biz.staff[idx];
    session.set(phone, "BOOK_SELECT_DATE", { staff });
    return MSG.selectDate(biz.workingDays);
  }

  // Step B3: Choose date
  if (s.step === "BOOK_SELECT_DATE") {
    const { biz } = s.data;
    const dates = getAvailableDates(biz.workingDays);
    const idx = parseNum(text, dates.length);
    if (idx === null) return MSG.invalidInput();
    const date = dates[idx];
    session.set(phone, "BOOK_SELECT_SLOT", { date });
    const taken = store.getTakenSlots(biz.id, s.data.staff.id, date);
    return MSG.selectSlot(biz.slots, taken);
  }

  // Step B4: Choose slot
  if (s.step === "BOOK_SELECT_SLOT") {
    const { biz, staff, date } = s.data;
    const idx = parseNum(text, biz.slots.length);
    if (idx === null) return MSG.invalidInput();
    const slot = biz.slots[idx];
    const taken = store.getTakenSlots(biz.id, staff.id, date);
    if (taken.includes(slot)) return MSG.slotTaken() + "\n\n" + MSG.selectSlot(biz.slots, taken);
    session.set(phone, "BOOK_ASK_NAME", { slot });
    return MSG.askName();
  }

  // Step B5: Collect name → confirm booking
  if (s.step === "BOOK_ASK_NAME") {
    const { biz, staff, date, slot } = s.data;
    const name = text;
    if (name.length < 2) return `⚠️ Please enter a valid name.`;
    const result = store.book({
      phone,
      name,
      businessId:   biz.id,
      businessName: biz.name,
      staffId:      staff.id,
      staffName:    staff.name,
      date,
      slot,
    });
    session.set(phone, "DONE");
    if (!result.success) return MSG.slotTaken();
    return MSG.confirmBooking({ businessName: biz.name, staffName: staff.name, date, slot, name }) +
      `\n\n🔖 *Booking ID:* \`${result.appointment.id}\``;
  }

  // ════════════════════════════════════════════════════════════
  //  CANCEL FLOW
  // ════════════════════════════════════════════════════════════

  if (s.step === "CANCEL_SELECT") {
    const { cancelList } = s.data;
    const idx = parseNum(text, cancelList.length);
    if (idx === null) return MSG.invalidInput();
    const appt = cancelList[idx];
    const result = store.cancel(phone, appt.id);
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
    const biz  = businesses.find((b) => b.id === appt.businessId);
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
    const taken = store.getTakenSlots(biz.id, appt.staffId, newDate);
    return MSG.selectSlot(biz.slots, taken);
  }

  if (s.step === "RESCHEDULE_SLOT") {
    const { appt, biz, newDate } = s.data;
    const idx = parseNum(text, biz.slots.length);
    if (idx === null) return MSG.invalidInput();
    const newSlot = biz.slots[idx];
    const taken = store.getTakenSlots(biz.id, appt.staffId, newDate);
    if (taken.includes(newSlot)) {
      return MSG.slotTaken() + "\n\n" + MSG.selectSlot(biz.slots, taken);
    }
    const result = store.reschedule(phone, appt.id, newDate, newSlot);
    session.set(phone, "DONE");
    if (!result.success) return `❌ Could not reschedule. Please try again.`;
    return MSG.rescheduleConfirm(result.appointment);
  }

  // ── Fallback ──────────────────────────────────────────────
  session.set(phone, "MAIN_MENU");
  return MSG.welcome();
}

module.exports = { handleMessage };