const logger = require('./logger');
const { AuditLog } = require('../models/index');

async function createAuditLog({
  actor,
  business = null,
  scope = 'client',
  action,
  title,
  description = '',
  metadata = {},
}) {
  if (!action || !title) return null;

  try {
    return await AuditLog.create({
      actor: actor?._id || actor || undefined,
      actorName: actor?.name || undefined,
      actorRole: actor?.role || undefined,
      business,
      scope,
      action,
      title,
      description,
      metadata,
    });
  } catch (err) {
    logger.warn(`Audit log write failed: ${err.message}`);
    return null;
  }
}

module.exports = { createAuditLog };
