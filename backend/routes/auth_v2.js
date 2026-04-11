const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Business = require('../models/Business');
const LicenseRequest = require('../models/LicenseRequest');
const { protect } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { createAuditLog } = require('../utils/audit');
const { getLicenseSnapshot, normalizePhone } = require('../utils/license');

const router = express.Router();

function serializeBusinessForAuth(business) {
  if (!business) return null;

  return {
    id: business._id,
    name: business.name,
    category: business.category,
    phone: business.phone,
    email: business.email,
    subscription: business.subscription,
    license: business.license
      ? {
          key: business.license.key,
          status: business.license.status,
          startAt: business.license.startAt,
          endAt: business.license.endAt,
          lastDurationValue: business.license.lastDurationValue,
          lastDurationUnit: business.license.lastDurationUnit,
          notes: business.license.notes,
        }
      : null,
    whatsapp: {
      isConnected: business.whatsapp?.isConnected,
      connectedPhone: business.whatsapp?.connectedPhone,
    },
  };
}

function getLicenseAppError(snapshot) {
  const code = snapshot.effectiveStatus === 'pending'
    ? 'LICENSE_PENDING'
    : snapshot.effectiveStatus === 'suspended'
      ? 'LICENSE_SUSPENDED'
      : 'LICENSE_EXPIRED';

  const message = code === 'LICENSE_PENDING'
    ? 'This client license is still pending approval. Please contact the platform owner.'
    : code === 'LICENSE_SUSPENDED'
      ? 'This client license is suspended. Please contact the platform owner.'
      : 'This client license has expired. Please renew access.';

  return new AppError(message, 403, {
    code,
    details: {
      expiresAt: snapshot.expiryDate,
      daysRemaining: snapshot.daysRemaining,
    },
  });
}

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
      business: serializeBusinessForAuth(business),
    },
  });
};

router.post(
  '/license-request',
  [
    body('shopName').trim().notEmpty().withMessage('Shop name is required'),
    body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
    body('phone')
      .notEmpty().withMessage('Phone number is required')
      .customSanitizer((v) => String(v).replace(/\D/g, '').slice(-10))
      .isLength({ min: 10, max: 10 }).withMessage('Enter a valid 10-digit mobile number'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email format'),
    body('message').optional({ values: 'falsy' }).isLength({ max: 2000 }).withMessage('Message is too long'),
    body('preferredPlan').optional({ values: 'falsy' }).isIn(['starter', 'pro', 'enterprise']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const request = await LicenseRequest.create({
        shopName: req.body.shopName,
        ownerName: req.body.ownerName,
        phone: normalizePhone(req.body.phone),
        email: req.body.email?.trim()?.toLowerCase() || undefined,
        message: req.body.message?.trim() || '',
        preferredPlan: req.body.preferredPlan || 'starter',
      });

      await createAuditLog({
        scope: 'platform',
        action: 'license.request.created',
        title: 'New license request submitted',
        description: `${request.ownerName} requested access for ${request.shopName}.`,
        metadata: {
          requestId: request._id,
          shopName: request.shopName,
          phone: request.phone,
          email: request.email,
          preferredPlan: request.preferredPlan,
        },
      });

      res.status(201).json({
        success: true,
        message: 'License request sent successfully. The platform owner can review it in the owner dashboard.',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }
);

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

      const user = await User.findOne({ phone }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return next(new AppError('Invalid mobile number or password', 401));
      }
      if (!user.isActive) {
        return next(new AppError('Your account has been deactivated. Contact support.', 401));
      }

      const business = await Business.findById(user.business);
      if (user.role !== 'super_admin' && user.role !== 'owner' && business) {
        const snapshot = getLicenseSnapshot(business);
        if (snapshot.isExpired && business.license?.status !== 'expired') {
          business.license.status = 'expired';
          business.subscription.status = 'expired';
          await business.save({ validateBeforeSave: false });
        }
        if (snapshot.isBlocked) {
          return next(getLicenseAppError(snapshot));
        }
      }

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      await createAuditLog({
        actor: user,
        business: business?._id,
        scope: user.role === 'super_admin' ? 'platform' : 'client',
        action: 'auth.login',
        title: user.role === 'super_admin' ? 'Platform owner logged in' : 'Client logged in',
        description: `${user.name} signed in successfully.`,
        metadata: {
          userId: user._id,
          phone: user.phone,
        },
      });

      sendToken(user, business, 200, res);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
      .notEmpty().withMessage('Mobile number is required')
      .customSanitizer((v) => String(v).replace(/\D/g, '').slice(-10))
      .isLength({ min: 10, max: 10 }).withMessage('Enter a valid 10-digit mobile number'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

      const existingPhone = await User.findOne({ phone });
      if (existingPhone) return next(new AppError('Mobile number already registered', 400));

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

      await createAuditLog({
        actor: user,
        business: business._id,
        scope: 'client',
        action: 'auth.register',
        title: 'Owner self-registered',
        description: `${user.name} registered ${business.name}.`,
        metadata: {
          businessId: business._id,
          phone: user.phone,
        },
      });

      sendToken(user, business, 201, res);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const business = await Business.findById(user.business);
    sendToken(user, business, 200, res);
  } catch (err) {
    next(err);
  }
});

router.put('/update-profile', protect, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = { name };
    if (email) updates.email = email;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    await createAuditLog({
      actor: req.user,
      business: req.user.business,
      scope: req.user.role === 'super_admin' ? 'platform' : 'client',
      action: 'auth.profile.updated',
      title: 'Profile updated',
      description: `${req.user.name} updated account profile details.`,
      metadata: {
        updatedFields: Object.keys(updates),
      },
    });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
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

      await createAuditLog({
        actor: req.user,
        business: req.user.business,
        scope: req.user.role === 'super_admin' ? 'platform' : 'client',
        action: 'auth.password.changed',
        title: 'Password changed',
        description: `${req.user.name} changed the login password.`,
      });

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
