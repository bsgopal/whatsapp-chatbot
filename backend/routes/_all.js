// staff.js
const express = require('express');
const staffRouter = express.Router();
const { Staff } = require('../models/index');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const Appointment = require('../models/Appointment');
const logger = require('../utils/logger');
const { createAuditLog } = require('../utils/audit');

staffRouter.use(protect);

staffRouter.get('/', async (req, res, next) => {
  try {
    const staff = await Staff.find({ business: req.user.business }).populate('services', 'name price').lean();
    res.json({ success: true, data: staff });
  } catch (err) { next(err); }
});

staffRouter.post('/', async (req, res, next) => {
  try {
    const s = await Staff.create({ ...req.body, business: req.user.business });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
});

staffRouter.put('/:id', async (req, res, next) => {
  try {
    const s = await Staff.findOneAndUpdate({ _id: req.params.id, business: req.user.business }, req.body, { new: true });
    if (!s) return next(new AppError('Staff not found', 404));
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
});

staffRouter.delete('/:id', async (req, res, next) => {
  try {
    await Staff.findOneAndDelete({ _id: req.params.id, business: req.user.business });
    res.json({ success: true, message: 'Staff deleted' });
  } catch (err) { next(err); }
});

// services.js
const serviceRouter = express.Router();
const { Service } = require('../models/index');

serviceRouter.use(protect);

serviceRouter.get('/', async (req, res, next) => {
  try {
    const services = await Service.find({ business: req.user.business }).sort('name').lean();
    res.json({ success: true, data: services });
  } catch (err) { next(err); }
});

serviceRouter.post('/', async (req, res, next) => {
  try {
    const svc = await Service.create({ ...req.body, business: req.user.business });
    res.status(201).json({ success: true, data: svc });
  } catch (err) { next(err); }
});

serviceRouter.put('/:id', async (req, res, next) => {
  try {
    const svc = await Service.findOneAndUpdate({ _id: req.params.id, business: req.user.business }, req.body, { new: true });
    if (!svc) return next(new AppError('Service not found', 404));
    res.json({ success: true, data: svc });
  } catch (err) { next(err); }
});

serviceRouter.delete('/:id', async (req, res, next) => {
  try {
    await Service.findOneAndDelete({ _id: req.params.id, business: req.user.business });
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) { next(err); }
});

// settings.js
const settingsRouter = express.Router();
const Business = require('../models/Business');

settingsRouter.use(protect);

settingsRouter.get('/', async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.business).select('+whatsapp.accessToken');
    res.json({ success: true, data: business });
  } catch (err) { next(err); }
});

settingsRouter.put('/', async (req, res, next) => {
  try {
    const allowed = ['name', 'category', 'phone', 'email', 'address', 'timezone', 'businessHours', 'botSettings'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const business = await Business.findByIdAndUpdate(req.user.business, updates, { new: true });
    await createAuditLog({
      actor: req.user,
      business: req.user.business,
      scope: 'client',
      action: 'settings.updated',
      title: 'Business settings updated',
      description: `${req.user.name} updated business settings.`,
      metadata: { updatedFields: Object.keys(updates) },
    });
    res.json({ success: true, data: business });
  } catch (err) { next(err); }
});

settingsRouter.put('/whatsapp', async (req, res, next) => {
  try {
    const { phoneNumberId, wabaId, accessToken, verifyToken } = req.body;
    const business = await Business.findByIdAndUpdate(
      req.user.business,
      { whatsapp: { phoneNumberId, wabaId, accessToken, verifyToken, webhookUrl: `${process.env.CLIENT_URL}/api/v1/webhook/whatsapp` } },
      { new: true }
    );
    await createAuditLog({
      actor: req.user,
      business: req.user.business,
      scope: 'client',
      action: 'settings.whatsapp.updated',
      title: 'WhatsApp settings updated',
      description: `${req.user.name} updated WhatsApp Cloud API settings.`,
      metadata: {
        phoneNumberId,
        verifyToken,
      },
    });
    res.json({ success: true, data: business });
  } catch (err) { next(err); }
});

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `WA-${block()}-${block()}`;
}

settingsRouter.put('/license', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return next(new AppError('Only the workspace owner can manage the license from settings', 403));
    }

    const {
      durationValue,
      durationUnit = 'day',
      status,
      notes,
      plan,
    } = req.body;

    const business = await Business.findById(req.user.business);
    if (!business) return next(new AppError('Business not found', 404));

    const now = new Date();
    const currentEnd = business.license?.endAt ? new Date(business.license.endAt) : null;
    const startAt = currentEnd && currentEnd > now ? currentEnd : now;
    const updates = {};

    if (!business.license?.key) {
      updates['license.key'] = generateLicenseKey();
      updates['license.generatedAt'] = now;
    }

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

    const updated = await Business.findByIdAndUpdate(req.user.business, { $set: updates }, { new: true }).lean();

    await createAuditLog({
      actor: req.user,
      business: req.user.business,
      scope: 'client',
      action: 'license.updated',
      title: 'License updated from settings',
      description: `${req.user.name} updated the workspace license from settings.`,
      metadata: {
        durationValue: durationValue || null,
        durationUnit: durationUnit || null,
        status: status || updated.license?.status || null,
        plan: plan || updated.subscription?.plan || null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

settingsRouter.get('/bot-preview', async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.business).lean();
    const services = await Service.find({
      business: req.user.business,
      isActive: true,
      availableForOnline: true,
    }).sort({ name: 1 }).lean();
    const engineStatus = await getPythonChatbotHealth();

    const openDays = (business?.businessHours || []).filter((day) => day.isOpen);
    const sampleFlow = [
      { from: 'customer', text: 'Hi' },
      { from: 'bot', text: buildServiceMenu(business, services).split('\n').slice(0, 6).join('\n') },
      { from: 'customer', text: services[0] ? '1' : 'Book appointment' },
      { from: 'bot', text: services[0] ? `Great choice. You selected ${services[0].name}.\n\n${business?.botSettings?.datePrompt || 'Please send your preferred date in YYYY-MM-DD format.'}` : (business?.botSettings?.noServicesMessage || 'Please add a service first.') },
      { from: 'customer', text: '2026-04-07' },
      { from: 'bot', text: `Nice. ${business?.botSettings?.timePrompt || 'Please send your preferred time.'}\nExample: 10:30 or 3 pm` },
    ];

    res.json({
      success: true,
      data: {
        services: services.map((service) => ({
          _id: service._id,
          name: service.name,
          price: service.price,
          duration: service.duration,
          category: service.category,
        })),
        businessHours: openDays,
        botSettings: business?.botSettings || {},
        sampleFlow,
        stats: {
          serviceCount: services.length,
          openDaysCount: openDays.length,
          autoConfirm: !!business?.botSettings?.autoConfirm,
          remindersEnabled: !!business?.botSettings?.reminderEnabled,
        },
        engine: {
          configured: getChatbotEngineConfig().engine,
          active: engineStatus.engine,
          mode: engineStatus.mode,
          isAvailable: engineStatus.isAvailable,
          url: engineStatus.url,
          error: engineStatus.error,
        },
      },
    });
  } catch (err) { next(err); }
});

settingsRouter.post('/whatsapp/test', async (req, res, next) => {
  try {
    const business = await Business.findById(req.user.business).select('+whatsapp.accessToken');
    const phoneNumberId = req.body.phoneNumberId || business?.whatsapp?.phoneNumberId || process.env.WA_PHONE_NUMBER_ID;
    const accessToken = req.body.accessToken || business?.whatsapp?.accessToken || process.env.WA_ACCESS_TOKEN;
    const testPhone = normalizeWhatsAppNumber(req.body.testPhone);

    if (!phoneNumberId || !accessToken) {
      return next(new AppError('Phone Number ID and Access Token are required', 400));
    }

    let meta;
    const profileResponse = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      const errorBody = await profileResponse.text();
      throw new Error(`WhatsApp test failed: ${profileResponse.status} ${errorBody}`);
    }

    meta = await profileResponse.json();

    if (testPhone) {
      const previewBusiness = {
        ...business?.toObject?.(),
        whatsapp: { ...(business?.whatsapp || {}), phoneNumberId, accessToken },
      };
      await sendWhatsAppText(
        previewBusiness,
        testPhone,
        `Test message from ${business?.name || 'WA Appt OS'}.\n\nYour WhatsApp chatbot connection is working.`
      );
    }

    res.json({
      success: true,
      data: {
        verifiedName: meta.verified_name,
        displayPhoneNumber: meta.display_phone_number,
        phoneNumberId,
        testMessageSent: !!testPhone,
      },
      message: testPhone ? 'WhatsApp connection is active and the test message was sent.' : 'WhatsApp connection is active.',
    });
  } catch (err) { next(err); }
});

// chat.js
const chatRouter = express.Router();
const { ChatMessage, Contact: ContactModel } = require('../models/index');

chatRouter.use(protect);

chatRouter.get('/conversations', async (req, res, next) => {
  try {
    const businessId = req.user.business;
    const conversations = await ChatMessage.aggregate([
      { $match: { business: businessId } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$contact', lastMessage: { $first: '$$ROOT' }, unreadCount: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } } } },
      { $lookup: { from: 'contacts', localField: '_id', foreignField: '_id', as: 'contact' } },
      { $unwind: '$contact' },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $limit: 50 },
    ]);
    res.json({ success: true, data: conversations });
  } catch (err) { next(err); }
});

chatRouter.get('/:contactId/messages', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await ChatMessage.find({
      business: req.user.business,
      contact: req.params.contactId,
    }).sort({ createdAt: -1 }).skip((page - 1) * parseInt(limit)).limit(parseInt(limit)).lean();
    // Mark as read
    await ChatMessage.updateMany({ business: req.user.business, contact: req.params.contactId, isRead: false }, { isRead: true });
    res.json({ success: true, data: messages.reverse() });
  } catch (err) { next(err); }
});

chatRouter.post('/:contactId/send', async (req, res, next) => {
  try {
    const { content, type = 'text' } = req.body;
    const contact = await ContactModel.findOne({
      _id: req.params.contactId,
      business: req.user.business,
    });
    if (!contact) return next(new AppError('Contact not found', 404));

    const business = await Business.findById(req.user.business).select('+whatsapp.accessToken');
    let status = 'sent';
    let failedReason;

    if (type === 'text') {
      try {
        await sendWhatsAppText(business, contact.waId || contact.phone, content);
      } catch (err) {
        status = 'failed';
        failedReason = err.message;
      }
    }

    const msg = await ChatMessage.create({
      business: req.user.business,
      contact: req.params.contactId,
      direction: 'outbound',
      type,
      content,
      sentBy: 'staff',
      staffId: req.user._id,
      status,
      failedReason,
    });
    const io = req.app.get('io');
    if (io) io.to(`business_${req.user.business}`).emit('new_message', {
      ...msg.toObject(),
      contact: {
        _id: contact._id,
        name: contact.name,
        phone: contact.phone,
        waId: contact.waId,
        botState: contact.botState,
      },
    });
    if (status === 'failed') {
      return res.status(201).json({
        success: true,
        warning: failedReason || 'Failed to send WhatsApp message',
        data: msg,
      });
    }
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
});

// notifications.js
const notifRouter = express.Router();
const { Notification } = require('../models/index');

notifRouter.use(protect);

notifRouter.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { business: req.user.business };
    if (unreadOnly === 'true') filter.isRead = false;
    const notifs = await Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * parseInt(limit)).limit(parseInt(limit));
    const unreadCount = await Notification.countDocuments({ business: req.user.business, isRead: false });
    res.json({ success: true, data: notifs, unreadCount });
  } catch (err) { next(err); }
});

notifRouter.put('/mark-all-read', async (req, res, next) => {
  try {
    await Notification.updateMany({ business: req.user.business, isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

notifRouter.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, business: req.user.business }, { isRead: true, readAt: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// webhook.js  
const webhookRouter = express.Router();

const BOT_RESET_WORDS = new Set(['reset', 'restart', 'menu', 'start', 'hi', 'hello']);

function normalizeText(text) {
  return (text || '').trim();
}

function normalizeWhatsAppNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

async function resolveWhatsAppContact(business, rawFrom, profile) {
  const normalizedPhone = normalizeWhatsAppNumber(rawFrom);
  if (!normalizedPhone) {
    throw new Error('Invalid WhatsApp sender number');
  }

  const profileName = profile?.profile?.name;

  // Use findOneAndUpdate with upsert to atomically find-or-create,
  // preventing race-condition duplicate contacts entirely.
  let contact = await ContactModel.findOneAndUpdate(
    { business: business._id, phone: normalizedPhone },
    {
      $setOnInsert: {
        business: business._id,
        name: profileName || rawFrom,
        phone: normalizedPhone,
        waId: normalizedPhone,
        source: 'whatsapp',
        customerProfile: { isProfileComplete: false },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Apply any updates to existing contacts (e.g. name from WA profile)
  const updates = {};
  if (contact.waId !== normalizedPhone) updates.waId = normalizedPhone;
  if (profileName && profileName !== contact.name) updates.name = profileName;

  if (Object.keys(updates).length) {
    contact = await ContactModel.findByIdAndUpdate(contact._id, updates, { new: true });
  }

  // Merge any leftover duplicates that may have existed before this fix
  const duplicates = await ContactModel.find({
    business: business._id,
    phone: normalizedPhone,
    _id: { $ne: contact._id },
  }).sort({ createdAt: 1 });

  for (const duplicate of duplicates) {
    await ChatMessage.updateMany({ contact: duplicate._id }, { contact: contact._id });
    await ContactModel.findByIdAndDelete(duplicate._id);
  }

  return contact;
}

function formatCurrency(amount, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch (err) {
    return `${currency} ${amount || 0}`;
  }
}

function buildServiceMenu(business, services) {
  const intro = business.botSettings?.welcomeMessage || `Hello! Welcome to ${business.name}.`;
  const menuPrompt = business.botSettings?.menuPrompt || 'Please choose a service by sending the number:';
  const lines = services.map((service, index) => (
    `${index + 1}. ${service.name} - ${formatCurrency(service.price, business.currency)} (${service.duration} mins)`
  ));

  return `${intro}\n\n${menuPrompt}\n${lines.join('\n')}\n\nYou can type "menu" anytime to restart.`;
}

function getBotMessage(business, key, fallback) {
  const value = business?.botSettings?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseServiceSelection(text, services) {
  const clean = normalizeText(text).toLowerCase();
  if (!clean) return null;

  const number = Number.parseInt(clean, 10);
  if (!Number.isNaN(number) && number >= 1 && number <= services.length) {
    return services[number - 1];
  }

  return services.find((service) => service.name.toLowerCase() === clean)
    || services.find((service) => service.name.toLowerCase().includes(clean));
}

function parseDateInput(text) {
  const clean = normalizeText(text).toLowerCase();
  if (!clean) return null;

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (clean === 'today') return base;
  if (clean === 'tomorrow') {
    const tomorrow = new Date(base);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  let match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  match = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const parsed = new Date(`${match[3]}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function parseTimeInput(text) {
  const clean = normalizeText(text).toLowerCase();
  if (!clean) return null;

  let match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match) {
    let hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2] || '0', 10);
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (match[3] === 'pm' && hours !== 12) hours += 12;
    if (match[3] === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return null;
}

function formatDateLabel(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function combineDateAndTime(date, time) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

function getBusinessDay(date) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
}

function isWithinBusinessHours(business, scheduledAt, duration) {
  const dayName = getBusinessDay(scheduledAt);
  const hours = business.businessHours?.find((item) => item.day === dayName);
  if (!hours || !hours.isOpen) return false;

  const start = scheduledAt.toTimeString().slice(0, 5);
  const endDate = new Date(scheduledAt.getTime() + duration * 60000);
  const end = endDate.toTimeString().slice(0, 5);

  if (start < hours.openTime || end > hours.closeTime) return false;
  if (hours.breakStart && hours.breakEnd && start < hours.breakEnd && end > hours.breakStart) return false;

  return true;
}

async function isSlotAvailable(businessId, scheduledAt, duration, staffId = null) {
  const endAt = new Date(scheduledAt.getTime() + duration * 60000);
  const query = {
    business: businessId,
    status: { $nin: ["cancelled", "no_show"] },
    scheduledAt: { $lt: endAt },
    endAt: { $gt: scheduledAt },
  };
  if (staffId) query.staff = staffId;
  const existing = await Appointment.findOne(query).lean();
  return !existing;
}

async function getBotDayAppointments(businessId, selectedDate) {
  if (!selectedDate) return [];

  const start = new Date(`${selectedDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return Appointment.find({
    business: businessId,
    status: { $nin: ['cancelled', 'no_show'] },
    scheduledAt: { $gte: start, $lt: end },
  }).select('scheduledAt endAt status').lean();
}

function getChatbotEngineConfig() {
  const engine = (process.env.CHATBOT_ENGINE || 'python').toLowerCase();
  const pythonUrl = (process.env.PYTHON_CHATBOT_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
  return { engine, pythonUrl };
}

async function getPythonChatbotHealth() {
  const { engine, pythonUrl } = getChatbotEngineConfig();

  if (engine !== 'python') {
    return {
      isAvailable: false,
      engine: 'node',
      mode: 'node',
      url: pythonUrl,
    };
  }

  try {
    const response = await fetch(`${pythonUrl}/health`, {
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      isAvailable: true,
      engine: 'python',
      mode: 'python',
      url: pythonUrl,
      service: data.service || 'python-chatbot',
    };
  } catch (err) {
    return {
      isAvailable: false,
      engine: 'node',
      mode: 'fallback',
      url: pythonUrl,
      error: err.message,
    };
  }
}

async function getPythonChatbotDecision({ business, contact, incomingText, services, existingAppointments }) {
  const { pythonUrl } = getChatbotEngineConfig();
  const response = await fetch(`${pythonUrl}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      business: {
        _id: business._id,
        name: business.name,
        currency: business.currency,
        timezone: business.timezone,
        businessHours: business.businessHours,
        botSettings: business.botSettings,
      },
      contact: {
        _id: contact._id,
        name: contact.name,
        phone: contact.phone,
        waId: contact.waId,
        botState: contact.botState,
        customerProfile: contact.customerProfile,
      },
      incomingText,
      services: services.map((service) => ({
        _id: String(service._id),
        name: service.name,
        duration: service.duration,
        price: service.price,
      })),
      existingAppointments: existingAppointments.map((item) => ({
        scheduledAt: item.scheduledAt,
        endAt: item.endAt,
        status: item.status,
      })),
      currentTime: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Python chatbot failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

async function persistOutboundMessage({ business, contact, content, status = 'sent', failedReason, appointmentRef, io }) {
  const message = await ChatMessage.create({
    business: business._id,
    contact: contact._id,
    direction: 'outbound',
    type: 'text',
    content,
    sentBy: 'bot',
    status,
    failedReason,
    appointmentRef,
  });

  // io is passed explicitly - business.app is never populated on a Mongoose document
  if (io) {
    io.to(`business_${business._id}`).emit('new_message', {
      ...message.toObject(),
      contact: {
        _id: contact._id,
        name: contact.name,
        phone: contact.phone,
        waId: contact.waId,
        botState: contact.botState,
      },
    });
  }

  return message;
}

async function sendWhatsAppText(business, to, text) {
  return sendWhatsAppMessage(business, to, {
    message_type: 'text',
    reply_text: text,
  });
}

async function sendWhatsAppMessage(business, to, messageData) {
  const accessToken = business.whatsapp?.accessToken || process.env.WA_ACCESS_TOKEN;
  const phoneNumberId = business.whatsapp?.phoneNumberId || process.env.WA_PHONE_NUMBER_ID;
  const normalizedTo = normalizeWhatsAppNumber(to);

  if (!accessToken || !phoneNumberId || !normalizedTo) {
    throw new Error('Missing WhatsApp credentials');
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
  };

  if (messageData.message_type === 'interactive' && messageData.interactive) {
    payload.type = 'interactive';
    payload.interactive = messageData.interactive;
  } else {
    payload.type = 'text';
    payload.text = { body: messageData.reply_text };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      // Handle recipient not in allowed list error in development
      if (process.env.NODE_ENV === 'development' && errorBody.includes('Recipient phone number not in allowed list')) {
        logger.warn(`WhatsApp send skipped for development: Recipient ${normalizedTo} not in allowed list. Add to recipient list in WhatsApp Business Manager.`);
        // Return mock success for development
        return { messages: [{ id: `dev_mock_${Date.now()}` }] };
      }

      throw new Error(`WhatsApp send failed: ${response.status} ${errorBody}`);
    }

    return response.json();
  } catch (err) {
    if (process.env.NODE_ENV === 'development' && err.message.includes('Recipient phone number not in allowed list')) {
      logger.warn(`WhatsApp send failed for development: ${err.message}`);
      // Return mock success for development
      return { messages: [{ id: `dev_mock_${Date.now()}` }] };
    }
    throw err;
  }
}

async function replyToContact({ app, business, contact, text, appointmentRef, messageData }) {
  const io = app ? app.get('io') : null;
  try {
    if (messageData && messageData.message_type === 'interactive') {
      await sendWhatsAppMessage(business, contact.waId || contact.phone, messageData);
    } else {
      await sendWhatsAppText(business, contact.waId || contact.phone, text);
    }
    await persistOutboundMessage({ business, contact, content: text, appointmentRef, io });
  } catch (err) {
    logger.error(`Bot reply failed for contact ${contact._id}: ${err.message}`);
    await persistOutboundMessage({
      business,
      contact,
      content: text,
      status: 'failed',
      failedReason: err.message,
      appointmentRef,
      io,
    });
  }
}

async function createBotAppointment({ app, business, contact, service, scheduledAt, customerName }) {
  const status = business.botSettings?.autoConfirm ? 'confirmed' : 'pending';
  const appointment = await Appointment.create({
    business: business._id,
    contact: contact._id,
    service: service._id,
    scheduledAt,
    status,
    source: 'whatsapp',
    serviceName: service.name,
    servicePrice: service.price,
    serviceDuration: service.duration,
  });

  await ContactModel.findByIdAndUpdate(contact._id, {
    name: customerName || contact.name,
    preferredService: service._id,
    lastVisit: scheduledAt,
    $inc: { totalAppointments: 1 },
    customerProfile: {
      providedName: customerName || contact.customerProfile?.providedName || contact.name,
      isProfileComplete: true,
      firstCapturedAt: contact.customerProfile?.firstCapturedAt || new Date(),
      lastUpdatedAt: new Date(),
    },
    botState: {
      stage: 'idle',
      selectedService: null,
      selectedDate: null,
      selectedTime: null,
      lastIntent: 'book_appointment',
      lastUpdatedAt: new Date(),
    },
  });

  await Business.findByIdAndUpdate(business._id, {
    $inc: { 'stats.totalAppointments': 1 },
  });

  await Notification.create({
    business: business._id,
    type: 'new_appointment',
    title: 'New WhatsApp Booking',
    message: `${customerName || contact.name} booked ${service.name}`,
    icon: '📅',
    color: '#00E676',
    relatedId: appointment._id,
    relatedModel: 'Appointment',
  });

  const io = app.get('io');
  if (io) {
    io.to(`business_${business._id}`).emit('new_appointment', { appointment });
  }

  return appointment;
}

async function handleBookingBotWithPython({ app, business, contact, incomingText, services }) {
  const existingAppointments = await getBotDayAppointments(business._id, contact.botState?.selectedDate);
  const decision = await getPythonChatbotDecision({
    business,
    contact,
    incomingText,
    services,
    existingAppointments,
  });

  const nextState = decision.next_state || {
    stage: 'idle',
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    lastIntent: 'book_appointment',
    lastUpdatedAt: new Date(),
  };

  const updates = {
    botState: {
      stage: nextState.stage || 'idle',
      selectedService: nextState.selectedService || null,
      selectedDate: nextState.selectedDate || null,
      selectedTime: nextState.selectedTime || null,
      lastIntent: nextState.lastIntent || 'book_appointment',
      lastUpdatedAt: nextState.lastUpdatedAt ? new Date(nextState.lastUpdatedAt) : new Date(),
    },
  };

  if (decision.preferred_service_id) {
    updates.preferredService = decision.preferred_service_id;
  }

  if (decision.create_appointment) {
    const selectedService = services.find((service) => String(service._id) === String(decision.create_appointment.service_id));
    if (!selectedService) {
      throw new Error('Python chatbot returned an unknown service');
    }

    const scheduledAt = new Date(decision.create_appointment.scheduled_at);
    const appointment = await createBotAppointment({
      app,
      business,
      contact,
      service: selectedService,
      scheduledAt,
      customerName: decision.create_appointment.customer_name,
    });

    // createBotAppointment already resets botState to idle on the contact,
    // so we only apply non-botState updates (e.g. preferredService) here.
    const nonBotStateUpdates = {};
    if (updates.preferredService) nonBotStateUpdates.preferredService = updates.preferredService;
    if (Object.keys(nonBotStateUpdates).length) {
      await ContactModel.findByIdAndUpdate(contact._id, nonBotStateUpdates);
    }

    await replyToContact({
      app,
      business,
      contact,
      appointmentRef: appointment._id,
      text: decision.reply_text,
      messageData: decision,
    });
    return true;
  }

  await ContactModel.findByIdAndUpdate(contact._id, updates);
  await replyToContact({
    app,
    business,
    contact,
    text: decision.reply_text,
    messageData: decision,
  });
  return true;
}

async function handleBookingBotWithNode({ app, business, contact, incomingText, services }) {
  if (!business.botSettings?.isEnabled) return;

  if (!services.length) {
    await replyToContact({
      app,
      business,
      contact,
      text: getBotMessage(business, 'noServicesMessage', `Hello! ${business.name} has no bookable services configured yet. Please contact the business directly.`),
    });
    return;
  }

  const normalized = normalizeText(incomingText);
  const lower = normalized.toLowerCase();
  const shouldReset = !contact.botState?.stage
    || contact.botState.stage === 'idle'
    || BOT_RESET_WORDS.has(lower)
    || lower.includes('book')
    || lower.includes('appointment');

  if (shouldReset) {
    await ContactModel.findByIdAndUpdate(contact._id, {
      botState: {
        stage: 'awaiting_service',
        selectedService: null,
        selectedDate: null,
        selectedTime: null,
        lastIntent: 'book_appointment',
        lastUpdatedAt: new Date(),
      },
    });
    await replyToContact({
      app,
      business,
      contact,
      text: buildServiceMenu(business, services),
    });
    return;
  }

  const stage = contact.botState?.stage || 'awaiting_service';
  const savedCustomerName = contact.customerProfile?.providedName || (contact.customerProfile?.isProfileComplete ? contact.name : '');

  if (stage === 'awaiting_service') {
    const service = parseServiceSelection(normalized, services);
    if (!service) {
      await replyToContact({
        app,
        business,
        contact,
        text: `${getBotMessage(business, 'invalidServiceMessage', "I couldn't match that service. Please choose one from the menu.")}\n\n${buildServiceMenu(business, services)}`,
      });
      return;
    }

    await ContactModel.findByIdAndUpdate(contact._id, {
      botState: {
        ...contact.botState,
        stage: 'awaiting_date',
        selectedService: service._id,
        selectedDate: null,
        selectedTime: null,
        lastUpdatedAt: new Date(),
      },
      preferredService: service._id,
    });

    await replyToContact({
      app,
      business,
      contact,
      text: `Great choice. You selected ${service.name}.\n\n${business.botSettings?.datePrompt || 'Please send your preferred date in YYYY-MM-DD format.'}\nExample: 2026-04-06\nYou can also type "today" or "tomorrow".`,
    });
    return;
  }

  if (stage === 'awaiting_date') {
    const pickedDate = parseDateInput(normalized);
    if (!pickedDate) {
      await replyToContact({
        app,
        business,
        contact,
        text: getBotMessage(business, 'invalidDateMessage', 'Please send a valid date like 2026-04-06, today, or tomorrow.'),
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pickedDate < today) {
      await replyToContact({
        app,
        business,
        contact,
        text: 'That date is in the past. Please send a future date.',
      });
      return;
    }

    await ContactModel.findByIdAndUpdate(contact._id, {
      botState: {
        ...contact.botState,
        stage: 'awaiting_time',
        selectedDate: pickedDate.toISOString().slice(0, 10),
        selectedTime: null,
        lastUpdatedAt: new Date(),
      },
    });

    await replyToContact({
      app,
      business,
      contact,
      text: `Nice. ${business.botSettings?.timePrompt || 'Please send your preferred time.'} for ${formatDateLabel(pickedDate)}.\nExample: 10:30 or 3 pm`,
    });
    return;
  }

  if (stage === 'awaiting_time') {
    const selectedService = services.find((service) => String(service._id) === String(contact.botState?.selectedService));
    const selectedDate = contact.botState?.selectedDate ? new Date(`${contact.botState.selectedDate}T00:00:00`) : null;
    const selectedTime = parseTimeInput(normalized);

    if (!selectedService || !selectedDate) {
      await ContactModel.findByIdAndUpdate(contact._id, {
        botState: {
          stage: 'awaiting_service',
          selectedService: null,
          selectedDate: null,
          selectedTime: null,
          lastIntent: 'book_appointment',
          lastUpdatedAt: new Date(),
        },
      });
      await replyToContact({
        app,
        business,
        contact,
        text: buildServiceMenu(business, services),
      });
      return;
    }

    if (!selectedTime) {
      await replyToContact({
        app,
        business,
        contact,
        text: getBotMessage(business, 'invalidTimeMessage', 'Please send a valid time like 10:30, 15:00, or 3 pm.'),
      });
      return;
    }

    const scheduledAt = combineDateAndTime(selectedDate, selectedTime);
    if (scheduledAt <= new Date()) {
      await replyToContact({
        app,
        business,
        contact,
        text: 'That time has already passed. Please send another time.',
      });
      return;
    }

    if (!isWithinBusinessHours(business, scheduledAt, selectedService.duration)) {
      await replyToContact({
        app,
        business,
        contact,
        text: getBotMessage(business, 'outOfHoursMessage', 'That time is outside business hours. Please choose another time between the configured opening hours.'),
      });
      return;
    }

    const selectedStaffId = contact.botState?.selectedStaff || null;
    const available = await isSlotAvailable(business._id, scheduledAt, selectedService.duration, selectedStaffId);
    if (!available) {
      await replyToContact({
        app,
        business,
        contact,
        text: getBotMessage(business, 'slotUnavailableMessage', 'That slot is already booked. Please send another time.'),
      });
      return;
    }

    if (savedCustomerName) {
      const appointment = await createBotAppointment({
        app,
        business,
        contact,
        service: selectedService,
        scheduledAt,
        customerName: savedCustomerName,
      });

      await replyToContact({
        app,
        business,
        contact,
        appointmentRef: appointment._id,
        text: `${business.botSettings?.confirmationTemplate || 'Your appointment is booked.'}\n\nName: ${savedCustomerName}\nService: ${selectedService.name}\nDate: ${formatDateLabel(selectedDate)}\nTime: ${selectedTime}\nStatus: ${appointment.status}\n\nReply "menu" if you want to make another booking.`,
      });
      return;
    }

    await ContactModel.findByIdAndUpdate(contact._id, {
      botState: {
        ...contact.botState,
        stage: 'awaiting_name',
        selectedTime,
        lastUpdatedAt: new Date(),
      },
    });

    await replyToContact({
      app,
      business,
      contact,
      text: `Slot looks available for ${selectedService.name} on ${formatDateLabel(selectedDate)} at ${selectedTime}.\n\n${getBotMessage(business, 'namePromptMessage', 'Please send your name to confirm the booking.')}`,
    });
    return;
  }

  if (stage === 'awaiting_name') {
    const selectedService = services.find((service) => String(service._id) === String(contact.botState?.selectedService));
    const selectedDate = contact.botState?.selectedDate ? new Date(`${contact.botState.selectedDate}T00:00:00`) : null;
    const selectedTime = contact.botState?.selectedTime;

    if (!selectedService || !selectedDate || !selectedTime) {
      await ContactModel.findByIdAndUpdate(contact._id, {
        botState: {
          stage: 'awaiting_service',
          selectedService: null,
          selectedDate: null,
          selectedTime: null,
          lastIntent: 'book_appointment',
          lastUpdatedAt: new Date(),
        },
      });
      await replyToContact({
        app,
        business,
        contact,
        text: buildServiceMenu(business, services),
      });
      return;
    }

    const scheduledAt = combineDateAndTime(selectedDate, selectedTime);
    const namedStaffId = contact.botState?.selectedStaff || null;
    const available = await isSlotAvailable(business._id, scheduledAt, selectedService.duration, namedStaffId);
    if (!available) {
      await ContactModel.findByIdAndUpdate(contact._id, {
        botState: {
          ...contact.botState,
          stage: 'awaiting_time',
          lastUpdatedAt: new Date(),
        },
      });
      await replyToContact({
        app,
        business,
        contact,
        text: getBotMessage(business, 'slotUnavailableMessage', 'That slot was just taken. Please send another time.'),
      });
      return;
    }

    const customerName = normalizeText(normalized) || contact.customerProfile?.providedName || contact.name;
    await ContactModel.findByIdAndUpdate(contact._id, {
      customerProfile: {
        providedName: customerName,
        isProfileComplete: true,
        firstCapturedAt: contact.customerProfile?.firstCapturedAt || new Date(),
        lastUpdatedAt: new Date(),
      },
    });
    const appointment = await createBotAppointment({
      app,
      business,
      contact,
      service: selectedService,
      scheduledAt,
      customerName,
    });

    await replyToContact({
      app,
      business,
      contact,
      appointmentRef: appointment._id,
      text: `${business.botSettings?.confirmationTemplate || 'Your appointment is booked.'}\n\nName: ${customerName}\nService: ${selectedService.name}\nDate: ${formatDateLabel(selectedDate)}\nTime: ${selectedTime}\nStatus: ${appointment.status}\n\nReply "menu" if you want to make another booking.`,
    });
  }
}

async function handleBookingBot({ app, business, contact, incomingText }) {
  if (!business.botSettings?.isEnabled) return;

  const services = await Service.find({
    business: business._id,
    isActive: true,
    availableForOnline: true,
  }).sort({ name: 1 }).lean();

  const { engine } = getChatbotEngineConfig();
  if (engine === 'python') {
    try {
      return await handleBookingBotWithPython({ app, business, contact, incomingText, services });
    } catch (err) {
      logger.warn(`Python chatbot unavailable, falling back to Node flow: ${err.message}`);
    }
  }

  return handleBookingBotWithNode({ app, business, contact, incomingText, services });
}

// WhatsApp webhook verification
webhookRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp webhook events
webhookRouter.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body;
    logger.info(`WhatsApp webhook received: ${JSON.stringify(body)}`);
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages') {
          const value = change.value;
          const businessPhone = value.metadata?.phone_number_id;

          for (const msg of value.messages || []) {
            if (msg.from === businessPhone) continue;

            // Find business by phoneNumberId — check DB first, then fall back to env variable
            let business = await Business.findOne({ 'whatsapp.phoneNumberId': businessPhone }).select('+whatsapp.accessToken');
            if (!business && businessPhone === process.env.WA_PHONE_NUMBER_ID) {
              // phoneNumberId is in .env but not yet saved to DB — find the first business and use it
              business = await Business.findOne({}).select('+whatsapp.accessToken');
              if (business) {
                logger.warn(`Business found via env fallback. Save WhatsApp settings in Settings page to fix this properly.`);
                // Auto-save the phoneNumberId to DB so future lookups work
                await Business.findByIdAndUpdate(business._id, {
                  'whatsapp.phoneNumberId': businessPhone,
                  'whatsapp.wabaId': process.env.WA_WABA_ID || business.whatsapp?.wabaId,
                  'whatsapp.verifyToken': process.env.WA_VERIFY_TOKEN || business.whatsapp?.verifyToken,
                  'whatsapp.isConnected': true,
                  'whatsapp.connectedPhone': '+91 ' + String(process.env.WA_PHONE_NUMBER_ID || '').slice(-10),
                });
              }
            }
            if (!business) { logger.warn(`No business found for phoneNumberId: ${businessPhone}`); continue; }

            // Save message text and normalize incoming text
            const text = msg.text?.body || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[media]';
            const interactiveId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
            const incomingText = interactiveId || text;
            const normalizedSender = normalizeWhatsAppNumber(msg.from);
            const normalizedText = normalizeText(text).toLowerCase();
            const senderLast10 = normalizedSender.slice(-10);

            // Upsert contact
            const profile = value.contacts?.find(c => c.wa_id === msg.from);
            let contact = await resolveWhatsAppContact(business, msg.from, profile);

            // Deduplicate incoming WhatsApp message — skip if already stored
            if (msg.id) {
              const alreadyStored = await ChatMessage.exists({ waMessageId: msg.id });
              if (alreadyStored) {
                logger.info(`Skipping duplicate webhook message ${msg.id}`);
                continue;
              }
            }

            // Save message
            try {
              const savedMsg = await ChatMessage.create({
                business: business._id,
                contact: contact._id,
                direction: 'inbound',
                type: msg.type || 'text',
                content: text,
                waMessageId: msg.id,
                waTimestamp: new Date(parseInt(msg.timestamp) * 1000),
                status: 'delivered',
                sentBy: 'system',
                isRead: false,
              });
              logger.info(`ChatMessage saved OK: ${savedMsg._id}`);
            } catch (saveErr) {
              logger.error(`ChatMessage.create FAILED: ${saveErr.message} | ${JSON.stringify(saveErr.errors)}`);
            }

            // Update contact stats and re-fetch so botState is fresh (not stale)
            contact = await ContactModel.findByIdAndUpdate(
              contact._id,
              { lastMessageAt: new Date(), $inc: { totalMessages: 1 } },
              { new: true }
            );

            // Emit to connected clients
            const io = req.app.get('io');
            if (io) io.to(`business_${business._id}`).emit('whatsapp_message', { contact, message: text });

            if (msg.type === 'text' || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title) {
              await handleBookingBot({
                app: req.app,
                business,
                contact,
                incomingText,
              });
            }
          }

          // Status updates
          for (const status of value.statuses || []) {
            await ChatMessage.findOneAndUpdate(
              { waMessageId: status.id },
              { status: status.status, ...(status.status === 'read' ? { isRead: true } : {}) }
            );
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// botSync — Sync appointments and contacts from WhatsApp bot
const botSyncRouter = express.Router();

// Verify shared secret
botSyncRouter.use((req, res, next) => {
  const secret = req.headers['x-bot-secret'];
  if (secret !== (process.env.BOT_SYNC_SECRET || 'wa_bot_sync_secret_2024')) {
    return res.status(401).json({ success: false, message: 'Invalid bot secret' });
  }
  next();
});

botSyncRouter.post('/appointment', async (req, res) => {
  try {
    const {
      action, phone, name, businessName,
      staffName, serviceName, servicePrice, serviceDuration,
      date, slot, bookingId,
      newDate, newSlot,
    } = req.body;

    // ── 1. Resolve business ───────────────────────────────────
    const business = await Business.findOne({ name: businessName });
    if (!business) {
      console.warn(`[botSync] Business not found: "${businessName}"`);
      return res.status(404).json({ success: false, message: `Business not found: ${businessName}` });
    }

    // ── 2. Find or create contact ─────────────────────────────
    let contact = await ContactModel.findOne({ business: business._id, phone });
    if (!contact) {
      contact = await ContactModel.create({
        business: business._id,
        phone,
        // Contact.name is required — use provided name or fall back to phone number
        name: (name && name.trim()) ? name.trim() : phone,
        source: 'whatsapp',   // must be one of the allowed enum values
        lastMessageAt: new Date(),
      });
    }

    // ── 3. Resolve service ObjectId by name ──────────────────
    const serviceDoc = await Service.findOne({ business: business._id, name: serviceName });

    // ── 4. Resolve staff ObjectId by name ────────────────────
    const staffDoc = await Staff.findOne({ business: business._id, name: staffName });

    if (action === 'book') {
      // Build scheduledAt from "YYYY-MM-DD" date + "HH:MM" slot
      let scheduledAt;
      try {
        scheduledAt = new Date(`${date}T${slot}:00`);
        if (isNaN(scheduledAt)) throw new Error('bad date');
      } catch {
        // Fallback: store current time so required field is satisfied
        scheduledAt = new Date();
        console.warn(`[botSync] Could not parse date="${date}" slot="${slot}", using now`);
      }

      const endAt = serviceDuration
        ? new Date(scheduledAt.getTime() + Number(serviceDuration) * 60000)
        : undefined;

      const apptData = {
        business: business._id,
        contact: contact._id,
        service: serviceDoc?._id,          // ObjectId (may be null if service not in DB yet)
        staff: staffDoc?._id,             // ObjectId (may be null)
        serviceName: serviceName,               // denormalised
        servicePrice: servicePrice,
        serviceDuration: serviceDuration,
        scheduledAt,
        endAt,
        status: 'confirmed',
        source: 'whatsapp',                // valid enum value
        notes: `Booked via WhatsApp bot — Ref: ${bookingId}`,
      };

      // service is required by schema; if we couldn't resolve it, create a
      // placeholder Service so the appointment saves cleanly.
      if (!apptData.service) {
        console.warn(`[botSync] Service "${serviceName}" not found in DB — creating placeholder`);
        const placeholder = await Service.create({
          business: business._id,
          name: serviceName,
          price: servicePrice || 0,
          duration: serviceDuration || 30,
        });
        apptData.service = placeholder._id;
      }

      const appointment = await Appointment.create(apptData);

      // Update contact stats
      await ContactModel.findByIdAndUpdate(contact._id, {
        $inc: { totalAppointments: 1, totalSpent: servicePrice || 0 },
        lastVisit: scheduledAt,
      });

      // Real-time push to dashboard
      const io = req.app.get('io');
      if (io) {
        const populated = await Appointment.findById(appointment._id)
          .populate('contact', 'name phone')
          .populate('staff', 'name')
          .populate('service', 'name price duration')
          .lean();
        io.to(`business_${business._id}`).emit('new_appointment', populated);
      }

      console.log(`[botSync] ✅ Booked appointment ${bookingId} for ${phone} @ ${scheduledAt}`);
      return res.json({ success: true, appointment: appointment._id });

    } else if (action === 'cancel') {
      // Find the most recent confirmed appointment for this contact
      const appointment = await Appointment.findOneAndUpdate(
        { business: business._id, contact: contact._id, status: 'confirmed' },
        {
          status: 'cancelled',
          'cancellation.cancelledAt': new Date(),
          'cancellation.cancelledBy': 'client',
        },
        { new: true, sort: { scheduledAt: -1 } }
      );
      if (!appointment) return res.status(404).json({ success: false, message: 'No confirmed appointment found to cancel' });

      const io = req.app.get('io');
      if (io) io.to(`business_${business._id}`).emit('appointment_updated', appointment);

      console.log(`[botSync] ❌ Cancelled appointment for ${phone}`);
      return res.json({ success: true });

    } else if (action === 'reschedule') {
      let newScheduledAt;
      try {
        newScheduledAt = new Date(`${newDate}T${newSlot}:00`);
        if (isNaN(newScheduledAt)) throw new Error('bad date');
      } catch {
        newScheduledAt = new Date();
      }

      const appointment = await Appointment.findOneAndUpdate(
        { business: business._id, contact: contact._id, status: 'confirmed' },
        {
          scheduledAt: newScheduledAt,
          $push: {
            rescheduleHistory: {
              rescheduledTo: newScheduledAt,
              at: new Date(),
            },
          },
        },
        { new: true, sort: { scheduledAt: -1 } }
      );
      if (!appointment) return res.status(404).json({ success: false, message: 'No confirmed appointment found to reschedule' });

      const io = req.app.get('io');
      if (io) io.to(`business_${business._id}`).emit('appointment_updated', appointment);

      console.log(`[botSync] 🔄 Rescheduled appointment for ${phone} to ${newScheduledAt}`);
      return res.json({ success: true });

    } else {
      return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[botSync] appointment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

botSyncRouter.post('/contact', async (req, res) => {
  try {
    const { phone, businessName, name } = req.body;

    const business = await Business.findOne({ name: businessName });
    if (!business) return res.status(404).json({ success: false, message: `Business not found: ${businessName}` });

    let contact = await ContactModel.findOne({ business: business._id, phone });
    if (!contact) {
      contact = await ContactModel.create({
        business: business._id,
        phone,
        name: (name && name.trim()) ? name.trim() : phone,
        source: 'whatsapp',
        lastMessageAt: new Date(),
      });
    } else {
      await ContactModel.findByIdAndUpdate(contact._id, {
        lastMessageAt: new Date(),
        $inc: { totalMessages: 1 },
      });
    }

    res.json({ success: true, contact: contact._id });
  } catch (err) {
    console.error('[botSync] contact error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// Save inbound/outbound message from WhatsApp bot → shows in WhatsApp Inbox
botSyncRouter.post('/message', async (req, res) => {
  try {
    const { phone, businessName, text, direction = 'inbound' } = req.body;

    const business = await Business.findOne({ name: businessName });
    if (!business) return res.status(404).json({ success: false, message: `Business not found: ${businessName}` });

    const contact = await ContactModel.findOne({ business: business._id, phone });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });

    const msg = await ChatMessage.create({
      business: business._id,
      contact: contact._id,
      direction,
      type: 'text',
      content: text,
      sentBy: direction === 'inbound' ? 'system' : 'bot',
      status: 'delivered',
      isRead: false,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`business_${business._id}`).emit('new_message', {
        ...msg.toObject(),
        contact: {
          _id: contact._id,
          name: contact.name,
          phone: contact.phone,
          waId: contact.waId,
        },
      });
    }

    res.json({ success: true, message: msg._id });
  } catch (err) {
    console.error('[botSync] message error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/v1/bot-sync/business/:businessId
// Called by the WhatsApp bot on startup to fetch its own config (staff, services, settings)
botSyncRouter.get('/business/:businessId', async (req, res) => {
  try {
    const business = await Business.findById(req.params.businessId).lean();
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });

    const [staffList, serviceList] = await Promise.all([
      Staff.find({ business: business._id, isActive: true }).lean(),
      Service.find({ business: business._id, isActive: true, availableForOnline: true }).sort('name').lean(),
    ]);

    res.json({
      success: true,
      data: {
        _id: business._id,
        name: business.name,
        category: business.category,
        currency: business.currency || 'INR',
        timezone: business.timezone || 'Asia/Kolkata',
        businessHours: business.businessHours || [],
        botSettings: business.botSettings || {},
        staff: staffList.map(s => ({
          id: String(s._id),
          name: s.name,
          role: s.role || s.specializations?.[0] || '',
          workingDays: s.workingDays || [],
          workStart: s.workStart || '09:00',
          workEnd: s.workEnd || '18:00',
        })),
        services: serviceList.map(s => ({
          id: String(s._id),
          name: s.name,
          price: s.price,
          duration: s.duration,
          category: s.category || '',
        })),
      },
    });
  } catch (err) {
    console.error('[botSync] business fetch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = {
  staffRouter,
  serviceRouter,
  settingsRouter,
  chatRouter,
  notifRouter,
  webhookRouter,
  botSyncRouter,
};