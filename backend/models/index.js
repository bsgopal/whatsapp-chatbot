const mongoose = require('mongoose');

// ─── Contact ───────────────────────────────────────────────────────────────────
const contactSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    phone: { type: String, required: [true, 'Phone is required'], trim: true },
    email: { type: String, lowercase: true, trim: true },
    avatar: { type: String, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', 'unknown'], default: 'unknown' },
    dob: Date,
    address: { city: String, state: String },
    tags: [{ type: String }],
    notes: { type: String, maxlength: 2000 },
    // WhatsApp
    waId: { type: String }, // wa phone number
    waOptIn: { type: Boolean, default: true },
    lastMessageAt: Date,
    totalMessages: { type: Number, default: 0 },
    // Stats
    totalAppointments: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastVisit: Date,
    // Status
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
    source: { type: String, enum: ['whatsapp', 'manual', 'import', 'web'], default: 'whatsapp' },
    preferredStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    preferredService: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    botState: {
      stage: {
        type: String,
        enum: ['idle', 'awaiting_service', 'awaiting_date', 'awaiting_time', 'awaiting_confirmation'],
        default: 'idle',
      },
      selectedService: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
      selectedDate: String,
      selectedTime: String,
      lastIntent: String,
      lastUpdatedAt: Date,
    },
  },
  { timestamps: true }
);
contactSchema.index({ business: 1, phone: 1 }, { unique: true });
contactSchema.index({ business: 1, name: 'text', phone: 'text' });

// ─── Staff ─────────────────────────────────────────────────────────────────────
const staffSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    phone: String,
    email: String,
    avatar: String,
    role: { type: String, default: 'stylist' },
    specializations: [String],
    color: { type: String, default: '#00E676' }, // for calendar
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalAppointments: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    workingDays: [{ type: String, enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] }],
    workStart: { type: String, default: '09:00' },
    workEnd: { type: String, default: '18:00' },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  },
  { timestamps: true }
);

// ─── Service ───────────────────────────────────────────────────────────────────
const serviceSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500 },
    category: String,
    price: { type: Number, required: true, min: 0 },
    discountedPrice: Number,
    duration: { type: Number, required: true, min: 5 }, // minutes
    image: String,
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    bookingsCount: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    color: String,
    tags: [String],
    availableForOnline: { type: Boolean, default: true },
    maxCapacity: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// ─── ChatMessage ───────────────────────────────────────────────────────────────
const chatMessageSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    type: { type: String, enum: ['text', 'template', 'image', 'document', 'audio', 'video', 'location', 'interactive', 'system'], default: 'text' },
    content: { type: String, maxlength: 4096 },
    mediaUrl: String,
    mediaCaption: String,
    // WhatsApp metadata
    waMessageId: String,
    waTimestamp: Date,
    status: { type: String, enum: ['sending', 'sent', 'delivered', 'read', 'failed'], default: 'sent' },
    failedReason: String,
    // Template
    templateName: String,
    templateParams: [String],
    // Bot / Staff
    sentBy: { type: String, enum: ['bot', 'staff', 'system'], default: 'bot' },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Appointment reference
    appointmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);
chatMessageSchema.index({ business: 1, contact: 1, createdAt: -1 });

// ─── Notification ───────────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    type: { type: String, enum: ['new_appointment', 'cancellation', 'payment', 'reminder', 'review', 'system', 'low_stock'] },
    title: String,
    message: String,
    icon: String,
    color: String,
    relatedId: mongoose.Schema.Types.ObjectId,
    relatedModel: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true }
);
notificationSchema.index({ business: 1, isRead: 1, createdAt: -1 });

module.exports = {
  Contact: mongoose.model('Contact', contactSchema),
  Staff: mongoose.model('Staff', staffSchema),
  Service: mongoose.model('Service', serviceSchema),
  ChatMessage: mongoose.model('ChatMessage', chatMessageSchema),
  Notification: mongoose.model('Notification', notificationSchema),
};
