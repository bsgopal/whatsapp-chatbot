const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    // Denormalized for speed
    serviceName: String,
    servicePrice: Number,
    serviceDuration: Number,

    scheduledAt: {
      type: Date,
      required: [true, 'Appointment date/time is required'],
      index: true,
    },
    endAt: Date,

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'rescheduled'],
      default: 'pending',
      index: true,
    },

    // Booking source
    source: {
      type: String,
      enum: ['whatsapp', 'web', 'phone', 'walk_in', 'staff'],
      default: 'whatsapp',
    },

    notes: { type: String, maxlength: 1000 },
    internalNotes: { type: String, maxlength: 1000 },

    // Payment
    payment: {
      status: { type: String, enum: ['unpaid', 'partial', 'paid', 'refunded'], default: 'unpaid' },
      amount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      method: { type: String, enum: ['cash', 'upi', 'card', 'razorpay', 'other'], default: 'cash' },
      transactionId: String,
      paidAt: Date,
    },

    // WhatsApp conversation thread
    waMessageId: String,
    waConversationId: String,

    // Reminders
    reminders: [
      {
        type: { type: String, enum: ['24h', '1h', 'custom'] },
        sentAt: Date,
        status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      },
    ],

    // Cancellation
    cancellation: {
      reason: String,
      cancelledBy: { type: String, enum: ['client', 'staff', 'system'] },
      cancelledAt: Date,
    },

    // Reschedule history
    rescheduleHistory: [
      {
        originalDate: Date,
        rescheduledTo: Date,
        rescheduledBy: mongoose.Schema.Types.ObjectId,
        reason: String,
        at: { type: Date, default: Date.now },
      },
    ],

    // Rating / Review
    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      submittedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for common queries
appointmentSchema.index({ business: 1, scheduledAt: -1 });
appointmentSchema.index({ business: 1, status: 1 });
appointmentSchema.index({ business: 1, contact: 1 });
appointmentSchema.index({ contact: 1, scheduledAt: -1 });

// Virtual: duration label
appointmentSchema.virtual('durationLabel').get(function () {
  const d = this.serviceDuration;
  if (!d) return '';
  if (d < 60) return `${d}m`;
  return `${Math.floor(d / 60)}h ${d % 60}m`;
});

// Pre-save: set endAt
appointmentSchema.pre('save', function (next) {
  if (this.scheduledAt && this.serviceDuration && !this.endAt) {
    this.endAt = new Date(this.scheduledAt.getTime() + this.serviceDuration * 60000);
  }
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
