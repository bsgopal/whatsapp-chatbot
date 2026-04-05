const express = require('express');
const router = express.Router();
const { Contact } = require('../models/index');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

router.use(protect);

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

router.get('/', async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const filter = { business: req.user.business };
    if (status) filter.status = status;
    if (search) filter.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Contact.countDocuments(filter);
    const contacts = await Contact.find(filter)
      .populate('preferredStaff', 'name avatar')
      .populate('preferredService', 'name price')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: contacts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, business: req.user.business })
      .populate('preferredStaff', 'name avatar')
      .populate('preferredService', 'name price');
    if (!contact) return next(new AppError('Contact not found', 404));
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, gender, dob, notes, tags } = req.body;
    const normalizedPhone = normalizePhone(phone);
    if (!name?.trim()) return next(new AppError('Name is required', 400));
    if (!normalizedPhone) return next(new AppError('Phone is required', 400));

    const existing = await Contact.findOne({ business: req.user.business, phone: normalizedPhone });
    if (existing) return next(new AppError('Contact with this phone already exists', 400));
    const contact = await Contact.create({
      business: req.user.business,
      name: name.trim(),
      phone: normalizedPhone,
      email,
      gender,
      dob,
      notes,
      tags,
      source: 'manual',
    });
    res.status(201).json({ success: true, data: contact });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.name !== undefined) updates.name = updates.name.trim();
    if (updates.phone !== undefined) updates.phone = normalizePhone(updates.phone);

    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business },
      updates,
      { new: true, runValidators: true }
    );
    if (!contact) return next(new AppError('Contact not found', 404));
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Contact.findOneAndDelete({ _id: req.params.id, business: req.user.business });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) { next(err); }
});

// Contact appointment history
router.get('/:id/appointments', async (req, res, next) => {
  try {
    const Appointment = require('../models/Appointment');
    const apts = await Appointment.find({ business: req.user.business, contact: req.params.id })
      .populate('service', 'name price duration')
      .populate('staff', 'name')
      .sort({ scheduledAt: -1 })
      .limit(20);
    res.json({ success: true, data: apts });
  } catch (err) { next(err); }
});

module.exports = router;
