const DAY_MS = 24 * 60 * 60 * 1000;

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function addDuration(startDate, value, unit = 'day') {
  const safeValue = Math.max(1, Number(value) || 1);
  const result = new Date(startDate);

  if (unit === 'month') {
    result.setMonth(result.getMonth() + safeValue);
    return result;
  }

  result.setDate(result.getDate() + safeValue);
  return result;
}

function getExpiryDate(business) {
  if (business?.license?.endAt) return new Date(business.license.endAt);
  if (business?.subscription?.currentPeriodEnd) return new Date(business.subscription.currentPeriodEnd);
  return null;
}

function getDaysRemaining(expiryDate, now = new Date()) {
  if (!expiryDate) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfExpiry = new Date(expiryDate);
  startOfExpiry.setHours(0, 0, 0, 0);
  return Math.ceil((startOfExpiry.getTime() - startOfToday.getTime()) / DAY_MS);
}

function getLicenseSnapshot(business, now = new Date()) {
  const expiryDate = getExpiryDate(business);
  const rawStatus = business?.license?.status || business?.subscription?.status || 'pending';
  const daysRemaining = getDaysRemaining(expiryDate, now);
  const isExpiredByDate = expiryDate ? expiryDate.getTime() < now.getTime() : false;
  const isBlocked = rawStatus === 'pending' || rawStatus === 'suspended' || rawStatus === 'expired' || isExpiredByDate;
  const effectiveStatus = isExpiredByDate && rawStatus !== 'suspended' ? 'expired' : rawStatus;

  return {
    expiryDate,
    daysRemaining,
    rawStatus,
    effectiveStatus,
    isBlocked,
    isExpired: effectiveStatus === 'expired',
    isExpiringSoon: daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7,
    needsReminder: daysRemaining === 7 || daysRemaining === 3,
  };
}

module.exports = {
  normalizePhone,
  addDuration,
  getExpiryDate,
  getDaysRemaining,
  getLicenseSnapshot,
};
