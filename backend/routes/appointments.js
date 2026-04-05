const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { Contact, Notification } = require('../models/index');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// All routes require auth
router.use(protect);

// ─── GET /api/v1/appointments ─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, from, to, staff, service, contact, page = 1, limit = 20, search } = req.query;
    const businessId = req.user.business;

    const filter = { business: businessId };
    if (status) filter.status = status;
    if (staff) filter.staff = staff;
    if (service) filter.service = service;
    if (contact) filter.contact = contact;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to) filter.scheduledAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Appointment.countDocuments(filter);

    const appointments = await Appointment.find(filter)
      .populate('contact', 'name phone avatar waId')
      .populate('staff', 'name avatar color')
      .populate('service', 'name price duration color')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: appointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/appointments/today ──────────────────────────────────────────
router.get('/today', async (req, res, next) => {
  try {
    const businessId = req.user.business;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      business: businessId,
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate('contact', 'name phone avatar')
      .populate('staff', 'name avatar color')
      .populate('service', 'name price duration')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/appointments/:id ────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      business: req.user.business,
    })
      .populate('contact', 'name phone email avatar tags totalAppointments totalSpent')
      .populate('staff', 'name avatar color specializations')
      .populate('service', 'name price duration category description');

    if (!appointment) return next(new AppError('Appointment not found', 404));
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/appointments ───────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { contactId, staffId, serviceId, scheduledAt, notes, source = 'staff' } = req.body;
    const businessId = req.user.business;

    // Get service details for denormalization
    const Service = require('../models/index').Service || require('mongoose').model('Service');
    const service = await require('mongoose').model('Service').findById(serviceId);
    if (!service) return next(new AppError('Service not found', 404));

    const appointment = await Appointment.create({
      business: businessId,
      contact: contactId,
      staff: staffId,
      service: serviceId,
      scheduledAt,
      notes,
      source,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDuration: service.duration,
    });

    // Update contact stats
    await Contact.findByIdAndUpdate(contactId, { $inc: { totalAppointments: 1 }, lastVisit: scheduledAt });

    // Create notification
    const contact = await Contact.findById(contactId);
    await Notification.create({
      business: businessId,
      type: 'new_appointment',
      title: 'New Appointment Booked',
      message: `${contact?.name} booked ${service.name}`,
      icon: '📅',
      color: '#00E676',
      relatedId: appointment._id,
      relatedModel: 'Appointment',
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`business_${businessId}`).emit('new_appointment', { appointment });
    }

    const populated = await Appointment.findById(appointment._id)
      .populate('contact', 'name phone avatar')
      .populate('staff', 'name avatar color')
      .populate('service', 'name price duration');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/v1/appointments/:id ────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { status, notes, staffId, scheduledAt, payment } = req.body;
    const appointment = await Appointment.findOne({ _id: req.params.id, business: req.user.business });
    if (!appointment) return next(new AppError('Appointment not found', 404));

    if (status) {
      // Handle rescheduling
      if (status === 'rescheduled' && scheduledAt) {
        appointment.rescheduleHistory.push({
          originalDate: appointment.scheduledAt,
          rescheduledTo: new Date(scheduledAt),
          rescheduledBy: req.user._id,
        });
      }
      // Handle cancellation
      if (status === 'cancelled') {
        appointment.cancellation = {
          reason: req.body.cancellationReason,
          cancelledBy: 'staff',
          cancelledAt: new Date(),
        };
      }
      appointment.status = status;
    }
    if (notes !== undefined) appointment.notes = notes;
    if (staffId) appointment.staff = staffId;
    if (scheduledAt) appointment.scheduledAt = scheduledAt;
    if (payment) Object.assign(appointment.payment, payment);

    await appointment.save();

    // Revenue update on completion
    if (status === 'completed') {
      await require('../models/Business').findByIdAndUpdate(req.user.business, {
        $inc: { 'stats.totalRevenue': appointment.servicePrice || 0 },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`business_${req.user.business}`).emit('appointment_updated', { appointment });
    }

    const populated = await Appointment.findById(appointment._id)
      .populate('contact', 'name phone avatar')
      .populate('staff', 'name avatar color')
      .populate('service', 'name price duration');

    res.json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/appointments/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const appointment = await Appointment.findOneAndDelete({
      _id: req.params.id,
      business: req.user.business,
    });
    if (!appointment) return next(new AppError('Appointment not found', 404));
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
