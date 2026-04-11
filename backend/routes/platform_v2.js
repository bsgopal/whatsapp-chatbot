const express = require('express');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const User = require('../models/User');
const Business = require('../models/Business');
const Appointment = require('../models/Appointment');
const {
  Contact,
  Staff,
  Service,
  ChatMessage,
  Notification,
  AuditLog,
  LicenseRequest,
} = require('../models/index');
const { createAuditLog } = require('../utils/audit');
const { normalizePhone, addDuration, getLicenseSnapshot } = require('../utils/license');

const router = express.Router();

router.use(protect);

function ensurePlatformOwner(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return next(new AppError('Only the platform owner can access this route', 403));
  }
  next();
}

router.use(ensurePlatformOwner);

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `WA-${block()}-${block()}`;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || undefined;
}

function serializeBusiness(business) {
  const snapshot = getLicenseSnapshot(business);

  return {
    ...business,
    licenseSummary: {
      status: snapshot.effectiveStatus,
      expiresAt: snapshot.expiryDate,
      daysRemaining: snapshot.daysRemaining,
      expiringSoon: snapshot.isExpiringSoon,
      blocked: snapshot.isBlocked,
    },
  };
}

async function getBusinessMetrics(businessIds) {
  const [contactCounts, appointmentCounts, unreadCounts] = await Promise.all([
    Contact.aggregate([{ $match: { business: { $in: businessIds } } }, { $group: { _id: '$business', count: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: { business: { $in: businessIds } } }, { $group: { _id: '$business', count: { $sum: 1 } } }]),
    ChatMessage.aggregate([
      { $match: { business: { $in: businessIds }, isRead: false, direction: 'inbound' } },
      { $group: { _id: '$business', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    contactMap: new Map(contactCounts.map((item) => [String(item._id), item.count])),
    appointmentMap: new Map(appointmentCounts.map((item) => [String(item._id), item.count])),
    unreadMap: new Map(unreadCounts.map((item) => [String(item._id), item.count])),
  };
}

router.get('/overview', async (req, res, next) => {
  try {
    const [businesses, pendingRequests] = await Promise.all([
      Business.find({}).populate('owner', 'name email phone lastLogin').sort({ createdAt: -1 }).lean(),
      LicenseRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const expiringAlerts = businesses
      .map((business) => {
        const snapshot = getLicenseSnapshot(business);
        if (snapshot.daysRemaining === 7 || snapshot.daysRemaining === 3 || snapshot.daysRemaining < 0) {
          return {
            businessId: business._id,
            businessName: business.name,
            ownerName: business.owner?.name,
            ownerEmail: business.owner?.email || business.email,
            ownerPhone: business.phone,
            adminLoginPhone: business.owner?.phone,
            daysRemaining: snapshot.daysRemaining,
            status: snapshot.effectiveStatus,
            expiresAt: snapshot.expiryDate,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

    const counts = businesses.reduce((acc, business) => {
      const snapshot = getLicenseSnapshot(business);
      acc.totalClients += 1;
      if (snapshot.effectiveStatus === 'active') acc.activeClients += 1;
      if (snapshot.effectiveStatus === 'expired') acc.expiredClients += 1;
      if (snapshot.isExpiringSoon) acc.expiringSoon += 1;
      return acc;
    }, {
      totalClients: 0,
      activeClients: 0,
      expiredClients: 0,
      expiringSoon: 0,
      pendingRequests: pendingRequests.length,
    });

    res.json({
      success: true,
      data: {
        counts,
        expiringAlerts,
        pendingRequests,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/license-requests', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const requests = await LicenseRequest.find(filter)
      .populate('reviewedBy', 'name email')
      .populate('linkedBusiness', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
});

router.patch('/license-requests/:requestId', async (req, res, next) => {
  try {
    const { status, internalNotes, linkedBusiness } = req.body;
    const request = await LicenseRequest.findById(req.params.requestId);
    if (!request) return next(new AppError('License request not found', 404));

    if (status && !['pending', 'contacted', 'approved', 'rejected'].includes(status)) {
      return next(new AppError('Invalid request status', 400));
    }

    if (status) request.status = status;
    if (internalNotes !== undefined) request.internalNotes = internalNotes;
    if (linkedBusiness !== undefined) request.linkedBusiness = linkedBusiness || undefined;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    await createAuditLog({
      actor: req.user,
      scope: 'platform',
      action: 'license.request.updated',
      title: 'License request updated',
      description: `${request.shopName} request marked as ${request.status}.`,
      metadata: {
        requestId: request._id,
        status: request.status,
        linkedBusiness: request.linkedBusiness,
      },
    });

    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
});

router.get('/clients', async (req, res, next) => {
  try {
    const businesses = await Business.find({})
      .populate('owner', 'name email phone isActive lastLogin')
      .sort({ createdAt: -1 })
      .lean();

    const businessIds = businesses.map((business) => business._id);
    const { contactMap, appointmentMap, unreadMap } = await getBusinessMetrics(businessIds);

    res.json({
      success: true,
      data: businesses.map((business) => ({
        ...serializeBusiness(business),
        contactCount: contactMap.get(String(business._id)) || 0,
        appointmentCount: appointmentMap.get(String(business._id)) || 0,
        unreadMessageCount: unreadMap.get(String(business._id)) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/clients', async (req, res, next) => {
  try {
    const {
      ownerName,
      clientName,
      shopName,
      businessName,
      category = 'salon',
      ownerPhone,
      adminPhone,
      phone,
      email,
      adminPassword,
      password,
      durationValue = 30,
      durationUnit = 'day',
      plan = 'starter',
      notes = '',
      requestId,
    } = req.body;

    const resolvedOwnerName = String(ownerName || clientName || '').trim();
    const resolvedShopName = String(shopName || businessName || '').trim();
    const resolvedAdminPhone = normalizePhone(adminPhone || phone);
    const resolvedOwnerPhone = normalizePhone(ownerPhone) || resolvedAdminPhone;
    const resolvedPassword = adminPassword || password;
    const resolvedEmail = normalizeEmail(email);
    const safeDurationValue = Math.max(1, Number(durationValue) || 1);
    const safeDurationUnit = durationUnit === 'month' ? 'month' : 'day';

    if (!resolvedOwnerName) throw new AppError('Owner name is required', 400);
    if (!resolvedShopName) throw new AppError('Shop name is required', 400);
    if (!resolvedOwnerPhone || resolvedOwnerPhone.length !== 10) throw new AppError('A valid owner phone is required', 400);
    if (!resolvedAdminPhone || resolvedAdminPhone.length !== 10) throw new AppError('A valid admin login phone is required', 400);
    if (!resolvedPassword || resolvedPassword.length < 6) throw new AppError('Admin password must be at least 6 characters', 400);

    const existingUser = await User.findOne({ phone: resolvedAdminPhone });
    if (existingUser) throw new AppError('Admin login phone already belongs to another client', 400);

    if (resolvedEmail) {
      const existingEmail = await User.findOne({ email: resolvedEmail });
      if (existingEmail) throw new AppError('Email already belongs to another client', 400);
    }

    const licenseKey = generateLicenseKey();
    const startAt = new Date();
    const endAt = addDuration(startAt, safeDurationValue, safeDurationUnit);
    const lastDurationDays = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / (24 * 60 * 60 * 1000)));

    const owner = await User.create({
      name: resolvedOwnerName,
      phone: resolvedAdminPhone,
      email: resolvedEmail,
      password: resolvedPassword,
      role: 'owner',
    });

    const business = await Business.create({
      name: resolvedShopName,
      category,
      owner: owner._id,
      phone: resolvedOwnerPhone,
      email: resolvedEmail,
      subscription: {
        plan,
        status: 'active',
        currentPeriodStart: startAt,
        currentPeriodEnd: endAt,
      },
      license: {
        key: licenseKey,
        status: 'active',
        assignedBy: req.user._id,
        generatedAt: startAt,
        startAt,
        endAt,
        lastPaymentAt: startAt,
        lastDurationDays,
        lastDurationValue: safeDurationValue,
        lastDurationUnit: safeDurationUnit,
        notes,
      },
    });

    owner.business = business._id;
    await owner.save({ validateBeforeSave: false });

    if (requestId) {
      await LicenseRequest.findByIdAndUpdate(requestId, {
        $set: {
          status: 'approved',
          linkedBusiness: business._id,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      });
    }

    await Promise.all([
      createAuditLog({
        actor: req.user,
        business: business._id,
        scope: 'platform',
        action: 'license.created',
        title: 'Client created with license',
        description: `${resolvedShopName} was provisioned with a ${durationValue}-${durationUnit} license.`,
        metadata: {
          businessId: business._id,
          ownerId: owner._id,
          adminLoginPhone: resolvedAdminPhone,
          ownerPhone: resolvedOwnerPhone,
          durationValue: safeDurationValue,
          durationUnit: safeDurationUnit,
          plan,
          requestId: requestId || null,
        },
      }),
      createAuditLog({
        actor: req.user,
        business: business._id,
        scope: 'client',
        action: 'license.created',
        title: 'License generated',
        description: `Platform owner created the initial license for ${resolvedShopName}.`,
        metadata: {
          licenseKey,
          durationValue: safeDurationValue,
          durationUnit: safeDurationUnit,
          plan,
        },
      }),
    ]);

    res.status(201).json({ success: true, data: { business, owner } });
  } catch (err) {
    next(err);
  }
});

router.put('/clients/:businessId/license', async (req, res, next) => {
  try {
    const {
      durationValue,
      durationUnit = 'day',
      status,
      notes,
      plan,
    } = req.body;

    const business = await Business.findById(req.params.businessId).populate('owner', 'name email phone lastLogin');
    if (!business) return next(new AppError('Client business not found', 404));

    const now = new Date();
    const currentEnd = business.license?.endAt ? new Date(business.license.endAt) : null;
    const startAt = currentEnd && currentEnd > now ? currentEnd : now;
    const updates = {};

    if (durationValue) {
      const safeDurationValue = Math.max(1, Number(durationValue) || 1);
      const safeDurationUnit = durationUnit === 'month' ? 'month' : 'day';
      const endAt = addDuration(startAt, safeDurationValue, safeDurationUnit);
      const durationDays = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / (24 * 60 * 60 * 1000)));

      updates['license.startAt'] = startAt;
      updates['license.endAt'] = endAt;
      updates['license.lastPaymentAt'] = now;
      updates['license.lastDurationDays'] = durationDays;
      updates['license.lastDurationValue'] = safeDurationValue;
      updates['license.lastDurationUnit'] = safeDurationUnit;
      updates['license.status'] = 'active';
      updates['subscription.currentPeriodStart'] = startAt;
      updates['subscription.currentPeriodEnd'] = endAt;
      updates['subscription.status'] = 'active';
    }

    if (status) {
      updates['license.status'] = status;
      if (status === 'expired') updates['subscription.status'] = 'expired';
      if (status === 'suspended') updates['subscription.status'] = 'inactive';
    }
    if (notes !== undefined) updates['license.notes'] = notes;
    if (plan) updates['subscription.plan'] = plan;

    const updated = await Business.findByIdAndUpdate(req.params.businessId, { $set: updates }, { new: true })
      .populate('owner', 'name email phone lastLogin')
      .lean();

    await Promise.all([
      createAuditLog({
        actor: req.user,
        business: req.params.businessId,
        scope: 'platform',
        action: 'license.updated',
        title: 'Client license updated',
        description: `${updated.name} license status changed to ${updates['license.status'] || updated.license?.status}.`,
        metadata: {
          businessId: req.params.businessId,
          durationValue: durationValue ? updates['license.lastDurationValue'] : null,
          durationUnit: durationValue ? updates['license.lastDurationUnit'] : null,
          plan: plan || updated.subscription?.plan,
          status: updates['license.status'] || updated.license?.status,
        },
      }),
      createAuditLog({
        actor: req.user,
        business: req.params.businessId,
        scope: 'client',
        action: 'license.updated',
        title: 'License updated',
        description: `Platform owner updated the license to ${updates['license.status'] || updated.license?.status}.`,
        metadata: {
          durationValue: durationValue ? updates['license.lastDurationValue'] : null,
          durationUnit: durationValue ? updates['license.lastDurationUnit'] : null,
          plan: plan || updated.subscription?.plan,
          status: updates['license.status'] || updated.license?.status,
        },
      }),
    ]);

    res.json({ success: true, data: serializeBusiness(updated) });
  } catch (err) {
    next(err);
  }
});

router.get('/clients/:businessId', async (req, res, next) => {
  try {
    const businessId = req.params.businessId;
    const business = await Business.findById(businessId).populate('owner', 'name email phone role isActive lastLogin').lean();
    if (!business) return next(new AppError('Client business not found', 404));

    const [contacts, staff, services, appointments, messages, notifications, auditLogs] = await Promise.all([
      Contact.find({ business: businessId }).sort({ updatedAt: -1 }).limit(25).lean(),
      Staff.find({ business: businessId }).sort({ createdAt: -1 }).lean(),
      Service.find({ business: businessId }).sort({ createdAt: -1 }).lean(),
      Appointment.find({ business: businessId })
        .populate('contact', 'name phone')
        .populate('staff', 'name')
        .populate('service', 'name')
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      ChatMessage.find({ business: businessId })
        .populate('contact', 'name phone')
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
      Notification.find({ business: businessId }).sort({ createdAt: -1 }).limit(25).lean(),
      AuditLog.find({ business: businessId }).sort({ createdAt: -1 }).limit(40).lean(),
    ]);

    const activity = [
      ...appointments.map((item) => ({
        type: 'appointment',
        createdAt: item.createdAt,
        title: `${item.contact?.name || 'Customer'} booked ${item.service?.name || item.serviceName || 'service'}`,
        meta: item.status,
      })),
      ...messages.map((item) => ({
        type: 'message',
        createdAt: item.createdAt,
        title: `${item.direction === 'inbound' ? 'Incoming' : 'Outgoing'} WhatsApp message`,
        meta: item.contact?.name || item.content?.slice(0, 40),
      })),
      ...notifications.map((item) => ({
        type: 'notification',
        createdAt: item.createdAt,
        title: item.title,
        meta: item.message,
      })),
      ...auditLogs.map((item) => ({
        type: 'audit',
        createdAt: item.createdAt,
        title: item.title,
        meta: item.description,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        business: serializeBusiness(business),
        stats: {
          contacts: contacts.length,
          staff: staff.length,
          services: services.length,
          appointments: appointments.length,
          messages: messages.length,
          audits: auditLogs.length,
        },
        contacts,
        staff,
        services,
        appointments,
        messages,
        notifications,
        auditLogs,
        activity,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;