// ============================================================
//  src/sessionManager.js  —  Tracks each user's conversation
//  state independently (multi-user support)
// ============================================================

// sessions[phone] = { step, data, lastActivity }
const sessions = {};

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes idle → reset

function get(phone) {
  const s = sessions[phone];
  if (!s) return null;

  // Auto-expire idle sessions
  if (Date.now() - s.lastActivity > TIMEOUT_MS) {
    delete sessions[phone];
    return null;
  }

  s.lastActivity = Date.now();
  return s;
}

function set(phone, step, data = {}) {
  sessions[phone] = {
    step,
    data: { ...(sessions[phone]?.data || {}), ...data },
    lastActivity: Date.now(),
  };
}

function reset(phone) {
  delete sessions[phone];
}

function update(phone, data) {
  if (!sessions[phone]) return;
  sessions[phone].data = { ...sessions[phone].data, ...data };
  sessions[phone].lastActivity = Date.now();
}

module.exports = { get, set, reset, update };