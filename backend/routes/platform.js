const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const User = require('../models/User');
const Business = require('../models/Business');
const Appointment = require('../models/Appointment');
const { Contact, Staff, Service, ChatMessage, Notification } = require('../models/index');

router.use(protect);

function ensurePlatformOwner(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return next(new AppError('Only the platform owner can access this route', 403));
  }
  next();
}

router.use(ensurePlatformOwner);

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `WA-${block()}-${block()}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

router.get('/clients', async (req, res, next) => {
  try {
    const businesses = await Business.find({})
      .populate('owner', 'name email phone isActive')
      .sort({ createdAt: -1 })
      .lean();

    const businessIds = businesses.map((business) => business._id);
    const [contactCounts, appointmentCounts, unreadCounts] = await Promise.all([
      Contact.aggregate([{ $match: { business: { $in: businessIds } } }, { $group: { _id: '$business', count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $match: { business: { $in: businessIds } } }, { $group: { _id: '$business', count: { $sum: 1 } } }]),
      ChatMessage.aggregate([
        { $match: { business: { $in: businessIds }, isRead: false, direction: 'inbound' } },
        { $group: { _id: '$business', count: { $sum: 1 } } },
      ]),
    ]);

    const contactMap = new Map(contactCounts.map((item) => [String(item._id), item.count]));
    const appointmentMap = new Map(appointmentCounts.map((item) => [String(item._id), item.count]));
    const unreadMap = new Map(unreadCounts.map((item) => [String(item._id), item.count]));

    res.json({
      success: true,
      data: businesses.map((business) => ({
        ...business,
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
      clientName,
      businessName,
      category = 'salon',
      phone,
      email,
      password,
      durationDays = 30,
      plan = 'starter',
      notes = '',
    } = req.body;

    const normalizedPhone = normalizePhone(phone);
    if (!clientName?.trim()) throw new AppError('Client name is required', 400);
    if (!businessName?.trim()) throw new AppError('Business name is required', 400);
    if (!normalizedPhone || normalizedPhone.length !== 10) throw new AppError('A valid 10-digit phone is required', 400);
    if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const existingUser = await User.findOne({ phone: normalizedPhone });
    if (existingUser) throw new AppError('Phone already belongs to another client', 400);

    const licenseKey = generateLicenseKey();
    const startAt = new Date();
    const endAt = addDays(startAt, Number(durationDays));

    const owner = await User.create({
      name: clientName.trim(),
      phone: normalizedPhone,
      email: email?.trim()?.toLowerCase() || undefined,
      password,
      role: 'owner',
    });

    const business = await Business.create({
      name: businessName.trim(),
      category,
      owner: owner._id,
      phone: normalizedPhone,
      email: email?.trim()?.toLowerCase() || undefined,
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
        startAt,
        endAt,
        lastPaymentAt: startAt,
        lastDurationDays: Number(durationDays),
        notes,
      },
    });

    owner.business = business._id;
    await owner.save({ validateBeforeSave: false });

    res.status(201).json({ success: true, data: { business, owner } });
  } catch (err) {
    next(err);
  }
});

router.put('/clients/:businessId/license', async (req, res, next) => {
  try {
    const { durationDays, status, notes, plan } = req.body;
    const business = await Business.findById(req.params.businessId);
    if (!business) return next(new AppError('Client business not found', 404));

    const startAt = business.license?.endAt && new Date(business.license.endAt) > new Date()
      ? new Date(business.license.endAt)
      : new Date();

    const updates = {};
    if (durationDays) {
      updates['license.startAt'] = startAt;
      updates['license.endAt'] = addDays(startAt, Number(durationDays));
      updates['license.lastPaymentAt'] = new Date();
      updates['license.lastDurationDays'] = Number(durationDays);
      updates['license.status'] = 'active';
      updates['subscription.currentPeriodStart'] = startAt;
      updates['subscription.currentPeriodEnd'] = addDays(startAt, Number(durationDays));
      updates['subscription.status'] = 'active';
    }
    if (status) updates['license.status'] = status;
    if (notes !== undefined) updates['license.notes'] = notes;
    if (plan) updates['subscription.plan'] = plan;

    const updated = await Business.findByIdAndUpdate(req.params.businessId, { $set: updates }, { new: true })
      .populate('owner', 'name email phone');

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/clients/:businessId', async (req, res, next) => {
  try {
    const businessId = req.params.businessId;
    const business = await Business.findById(businessId).populate('owner', 'name email phone role isActive').lean();
    if (!business) return next(new AppError('Client business not found', 404));

    const [contacts, staff, services, appointments, messages, notifications] = await Promise.all([
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
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        business,
        stats: {
          contacts: contacts.length,
          staff: staff.length,
          services: services.length,
          appointments: appointments.length,
          messages: messages.length,
        },
        contacts,
        staff,
        services,
        appointments,
        messages,
        notifications,
        activity,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
