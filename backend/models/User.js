const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    // ── phone is PRIMARY login identifier — mandatory & unique ─────────────────
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^\d{10}$/, 'Enter a valid 10-digit mobile number'],
    },
    // ── email is optional (stored for reference, NOT used for login) ───────────
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,           // allows multiple null values with unique index
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'staff', 'receptionist'],
      default: 'owner',
    },
    avatar: {
      type: String,
      default: null,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Hash password before save ─────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Compare password ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Sign JWT (includes phone + role in payload) ───────────────────────────────
userSchema.methods.getSignedJwt = function () {
  return jwt.sign(
    { id: this._id, role: this.role, phone: this.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = mongoose.model('User', userSchema);
