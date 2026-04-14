// ============================================================
//  src/appointmentStore.js  —  Persistent appointment store
//  Uses node-persist (file-based) so data survives restarts
// ============================================================

const { v4: uuidv4 } = require("uuid");
const storage        = require("node-persist");
const path           = require("path");

const BOT_SYNC_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const BOT_SYNC_SECRET = process.env.BOT_SYNC_SECRET || 'wa_bot_sync_secret_2024';

async function syncToMongo(endpoint, body) {
  try {
    const http = require('http');
    // simple fire-and-forget POST
    const data = JSON.stringify(body);
    const url = new URL(BOT_SYNC_URL + '/api/v1/bot-sync/' + endpoint);
    const options = { hostname: url.hostname, port: url.port || 5001, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'x-bot-secret': BOT_SYNC_SECRET } };
    const req = http.request(options);
    req.write(data);
    req.end();
  } catch(e) { console.warn('[sync] failed:', e.message); }
}

let initialized = false;

async function init() {
  if (initialized) return;
  await storage.init({
    dir: path.join(__dirname, "../data/.store"),
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: "utf8",
    logging: false,
    ttl: false,
  });
  initialized = true;
}

// ── Internal helpers ──────────────────────────────────────────

async function _load() {
  await init();
  return (await storage.getItem("appointments")) || {};
}

async function _save(data) {
  await init();
  await storage.setItem("appointments", data);
}

// ── Public API ────────────────────────────────────────────────

async function getByPhone(phone) {
  const db = await _load();
  return db[phone] || [];
}

async function getAll() {
  return await _load();
}

async function book({ phone, name, businessId, businessName, staffId, staffName,
                      serviceId, serviceName, servicePrice, serviceDuration,
                      date, slot }) {
  const db = await _load();
  if (!db[phone]) db[phone] = [];

  // Prevent double-booking same slot for same staff
  const conflict = Object.values(db)
    .flat()
    .find(a =>
      a.businessId === businessId &&
      a.staffId    === staffId    &&
      a.date       === date       &&
      a.slot       === slot       &&
      a.status     === "confirmed"
    );

  if (conflict) return { success: false, reason: "slot_taken" };

  const appt = {
    id:              uuidv4().slice(0, 8).toUpperCase(),
    phone,
    name,
    businessId,
    businessName,
    staffId,
    staffName,
    serviceId,
    serviceName,
    servicePrice,
    serviceDuration,
    date,
    slot,
    status:          "confirmed",
    bookedAt:        new Date().toISOString(),
  };

  db[phone].push(appt);
  await _save(db);
  syncToMongo('appointment', { action:'book', phone, name, businessName, staffName, serviceName, servicePrice, serviceDuration, date, slot, bookingId: appt.id });
  return { success: true, appointment: appt };
}

async function cancel(phone, apptId) {
  const db   = await _load();
  const list = db[phone] || [];
  const appt = list.find(a => a.id === apptId);
  if (!appt)                        return { success: false, reason: "not_found" };
  if (appt.status === "cancelled")  return { success: false, reason: "already_cancelled" };
  appt.status = "cancelled";
  appt.cancelledAt = new Date().toISOString();
  await _save(db);
  syncToMongo('appointment', { action:'cancel', phone, bookingId: apptId, businessName: appt.businessName });
  return { success: true, appointment: appt };
}

async function reschedule(phone, apptId, newDate, newSlot) {
  const db   = await _load();
  const list = db[phone] || [];
  const appt = list.find(a => a.id === apptId);
  if (!appt)                       return { success: false, reason: "not_found" };
  if (appt.status === "cancelled") return { success: false, reason: "cancelled" };

  const conflict = Object.values(db)
    .flat()
    .find(a =>
      a.businessId === appt.businessId &&
      a.staffId    === appt.staffId    &&
      a.date       === newDate         &&
      a.slot       === newSlot         &&
      a.status     === "confirmed"     &&
      a.id         !== apptId
    );

  if (conflict) return { success: false, reason: "slot_taken" };

  appt.date          = newDate;
  appt.slot          = newSlot;
  appt.rescheduledAt = new Date().toISOString();
  await _save(db);
  syncToMongo('appointment', { action:'reschedule', phone, bookingId: apptId, businessName: appt.businessName, newDate, newSlot });
  return { success: true, appointment: appt };
}

async function getTakenSlots(businessId, staffId, date) {
  const db = await _load();
  return Object.values(db)
    .flat()
    .filter(a =>
      a.businessId === businessId &&
      a.staffId    === staffId    &&
      a.date       === date       &&
      a.status     === "confirmed"
    )
    .map(a => a.slot);
}

module.exports = { getByPhone, getAll, book, cancel, reschedule, getTakenSlots };