// ============================================================
//  src/appointmentStore.js  —  Stores all booked appointments
//  (in-memory for simplicity; swap with a DB for production)
// ============================================================

const { v4: uuidv4 } = require("uuid");

// appointments[phone] = [ { id, businessId, staffId, date, slot, name, status } ]
const appointments = {};

function getByPhone(phone) {
  return appointments[phone] || [];
}

function getAll() {
  return appointments;
}

function book({ phone, name, businessId, businessName, staffId, staffName, date, slot }) {
  if (!appointments[phone]) appointments[phone] = [];

  // Prevent double-booking same slot for same staff
  const conflict = Object.values(appointments)
    .flat()
    .find(
      (a) =>
        a.businessId === businessId &&
        a.staffId    === staffId    &&
        a.date       === date       &&
        a.slot       === slot       &&
        a.status     === "confirmed"
    );

  if (conflict) return { success: false, reason: "slot_taken" };

  const appt = {
    id:           uuidv4().slice(0, 8).toUpperCase(),
    phone,
    name,
    businessId,
    businessName,
    staffId,
    staffName,
    date,
    slot,
    status:       "confirmed",
    bookedAt:     new Date().toISOString(),
  };

  appointments[phone].push(appt);
  return { success: true, appointment: appt };
}

function cancel(phone, apptId) {
  const list = appointments[phone] || [];
  const appt = list.find((a) => a.id === apptId);
  if (!appt) return { success: false, reason: "not_found" };
  if (appt.status === "cancelled") return { success: false, reason: "already_cancelled" };
  appt.status = "cancelled";
  return { success: true, appointment: appt };
}

function reschedule(phone, apptId, newDate, newSlot) {
  const list = appointments[phone] || [];
  const appt = list.find((a) => a.id === apptId);
  if (!appt) return { success: false, reason: "not_found" };
  if (appt.status === "cancelled") return { success: false, reason: "cancelled" };

  // Check new slot availability
  const conflict = Object.values(appointments)
    .flat()
    .find(
      (a) =>
        a.businessId === appt.businessId &&
        a.staffId    === appt.staffId    &&
        a.date       === newDate         &&
        a.slot       === newSlot         &&
        a.status     === "confirmed"     &&
        a.id         !== apptId
    );

  if (conflict) return { success: false, reason: "slot_taken" };

  appt.date = newDate;
  appt.slot = newSlot;
  return { success: true, appointment: appt };
}

function getTakenSlots(businessId, staffId, date) {
  return Object.values(appointments)
    .flat()
    .filter(
      (a) =>
        a.businessId === businessId &&
        a.staffId    === staffId    &&
        a.date       === date       &&
        a.status     === "confirmed"
    )
    .map((a) => a.slot);
}

module.exports = { getByPhone, getAll, book, cancel, reschedule, getTakenSlots };