const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['salon', 'medical', 'automotive', 'education', 'fitness', 'spa', 'dental', 'legal', 'other'],
      default: 'salon',
    },
    logo: { type: String, default: null },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // WhatsApp API config
    whatsapp: {
      phoneNumberId: String,
      wabaId: String,
      accessToken: { type: String, select: false },
      verifyToken: String,
      webhookUrl: String,
      isConnected: { type: Boolean, default: false },
      connectedAt: Date,
      connectedPhone: String,
    },
    // Business hours
    businessHours: [
      {
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
        isOpen: { type: Boolean, default: true },
        openTime: { type: String, default: '09:00' },
        closeTime: { type: String, default: '18:00' },
        breakStart: String,
        breakEnd: String,
      },
    ],
    // Subscription
    subscription: {
      plan: { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' },
      status: { type: String, enum: ['active', 'inactive', 'trial', 'expired'], default: 'trial' },
      trialEndsAt: Date,
      currentPeriodStart: Date,
      currentPeriodEnd: Date,
      razorpaySubId: String,
    },
    // Bot settings
    botSettings: {
      isEnabled: { type: Boolean, default: true },
      welcomeMessage: {
        type: String,
        default: 'Hello! 👋 Welcome to our appointment booking system. How can I help you today?',
      },
      language: { type: String, default: 'en' },
      autoConfirm: { type: Boolean, default: false },
      reminderEnabled: { type: Boolean, default: true },
      reminderBeforeHours: { type: Number, default: 24 },
    },
    // Stats (cached)
    stats: {
      totalAppointments: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      totalContacts: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Default business hours on create
businessSchema.pre('save', function (next) {
  if (this.isNew && this.businessHours.length === 0) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    this.businessHours = days.map((day) => ({
      day,
      isOpen: !['sunday'].includes(day),
      openTime: '09:00',
      closeTime: '18:00',
    }));
  }
  next();
});

module.exports = mongoose.model('Business', businessSchema);
