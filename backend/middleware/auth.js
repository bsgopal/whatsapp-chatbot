const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const { AppError } = require('./errorHandler');
const { getLicenseSnapshot } = require('../utils/license');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new AppError('User not found', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 401));
    }

    if (user.role !== 'super_admin' && user.role !== 'owner' && user.business) {
      const business = await Business.findById(user.business).select('license subscription');
      const snapshot = getLicenseSnapshot(business);

      if (snapshot.isExpired && business?.license?.status !== 'expired') {
        await Business.findByIdAndUpdate(user.business, {
          $set: {
            'license.status': 'expired',
            'subscription.status': 'expired',
          },
        });
      }

      if (snapshot.isBlocked) {
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

        return next(new AppError(message, 403, {
          code,
          details: {
            expiresAt: snapshot.expiryDate,
            daysRemaining: snapshot.daysRemaining,
          },
        }));
      }
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Role '${req.user.role}' is not authorized for this action`, 403));
    }
    next();
  };
};

module.exports = { protect, authorize };
