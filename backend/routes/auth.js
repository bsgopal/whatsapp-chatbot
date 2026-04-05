const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Business = require('../models/Business');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// ── Helper: strip non-digits from phone ───────────────────────────────────────
const normalizePhone = (phone) => String(phone).replace(/\D/g, '').slice(-10);

// ── Helper: send token response ───────────────────────────────────────────────
const sendToken = (user, business, statusCode, res) => {
  const token = user.getSignedJwt();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      business: business
        ? {
            id: business._id,
            name: business.name,
            category: business.category,
            subscription: business.subscription,
            whatsapp: {
              isConnected: business.whatsapp?.isConnected,
              connectedPhone: business.whatsapp?.connectedPhone,
            },
          }
        : null,
    },
  });
};

// ════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/login
//  Login with MOBILE NUMBER + PASSWORD
// ════════════════════════════════════════════════════════════════════
router.post(
  '/login',
  [
    body('phone')
      .notEmpty().withMessage('Mobile number is required')
      .customSanitizer((v) => String(v).replace(/\D/g, '').slice(-10))
      .isLength({ min: 10, max: 10 }).withMessage('Enter a valid 10-digit mobile number'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const phone = normalizePhone(req.body.phone);
      const { password } = req.body;

      // Find by phone (primary login field)
      const user = await User.findOne({ phone }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return next(new AppError('Invalid mobile number or password', 401));
      }
      if (!user.isActive) {
        return next(new AppError('Your account has been deactivated. Contact support.', 401));
      }

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      const business = await Business.findById(user.business);
      sendToken(user, business, 200, res);
    } catch (err) {
      next(err);
    }
  }
);

// ════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/register
//  Register new business owner — phone + password mandatory
// ════════════════════════════════════════════════════════════════════
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
      .notEmpty().withMessage('Mobile number is required')
      .customSanitizer((v) => String(v).replace(/\D/g, '').slice(-10))
      .isLength({ min: 10, max: 10 }).withMessage('Enter a valid 10-digit mobile number'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('businessName').trim().notEmpty().withMessage('Business name is required'),
    body('businessCategory')
      .optional()
      .isIn(['salon', 'medical', 'automotive', 'education', 'fitness', 'spa', 'dental', 'legal', 'other']),
    body('email').optional().isEmail().withMessage('Invalid email format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const phone = normalizePhone(req.body.phone);
      const { name, email, password, businessName, businessCategory } = req.body;

      // Check duplicate phone
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) return next(new AppError('Mobile number already registered', 400));

      // Check duplicate email (if provided)
      if (email) {
        const existingEmail = await User.findOne({ email });
        if (existingEmail) return next(new AppError('Email already registered', 400));
      }

      const user = await User.create({
        name,
        phone,
        email: email || undefined,
        password,
        role: 'owner',
      });

      const business = await Business.create({
        name: businessName,
        category: businessCategory || 'salon',
        owner: user._id,
        subscription: {
          plan: 'starter',
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      user.business = business._id;
      await user.save({ validateBeforeSave: false });

      sendToken(user, business, 201, res);
    } catch (err) {
      next(err);
    }
  }
);

// ════════════════════════════════════════════════════════════════════
//  GET /api/v1/auth/me  — get current logged-in user
// ════════════════════════════════════════════════════════════════════
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const business = await Business.findById(user.business);
    sendToken(user, business, 200, res);
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════════
//  PUT /api/v1/auth/update-profile
// ════════════════════════════════════════════════════════════════════
router.put('/update-profile', protect, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = { name };
    if (email) updates.email = email;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════════
//  PUT /api/v1/auth/change-password
// ════════════════════════════════════════════════════════════════════
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');
      if (!(await user.comparePassword(currentPassword))) {
        return next(new AppError('Current password is incorrect', 400));
      }
      user.password = newPassword;
      await user.save();
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
