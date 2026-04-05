const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Business = require('../models/Business');
const Appointment = require('../models/Appointment');
const { Contact, Staff, Service, ChatMessage, Notification } = require('../models/index');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wa_appt_os';

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  await Promise.all([
    User.deleteMany({}),
    Business.deleteMany({}),
    Appointment.deleteMany({}),
    Contact.deleteMany({}),
    Staff.deleteMany({}),
    Service.deleteMany({}),
    ChatMessage.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  console.log('Cleared all existing data\n');

  const owner = await User.create({
    name: 'GK',
    phone: '9345578103',
    email: 'bsgopa0@gmail.com',
    password: 'Gopal@123',
    role: 'owner',
  });

  const business = await Business.create({
    name: "Priya's Beauty & Wellness Studio",
    category: 'salon',
    owner: owner._id,
    phone: '9345578103',
    email: 'bsgopa0@gmail.com',
    address: {
      street: '42 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    },
    whatsapp: {
      phoneNumberId: '123456789012345',
      wabaId: '987654321098765',
      verifyToken: 'wa_appt_os_secure',
      isConnected: true,
      connectedAt: new Date(),
      connectedPhone: '+91 93455 78103',
    },
    subscription: {
      plan: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    botSettings: {
      isEnabled: true,
      welcomeMessage: "Hello! Welcome to Priya's Beauty Studio.\n\n1 Book Appointment\n2 View My Bookings\n3 Our Services\n4 Talk to Staff",
      autoConfirm: false,
      reminderEnabled: true,
      reminderBeforeHours: 24,
    },
    stats: { totalAppointments: 247, totalRevenue: 482000, totalContacts: 89 },
  });

  owner.business = business._id;
  await owner.save({ validateBeforeSave: false });

  const staffMembers = await Staff.insertMany([
    {
      business: business._id,
      name: 'Ananya Mehta',
      phone: '+91 90123 45678',
      email: 'ananya@priyasalon.com',
      role: 'Senior Stylist',
      specializations: ['Hair Color', 'Keratin Treatment', 'Bridal Makeup'],
      color: '#00E676',
      rating: 4.8,
      totalReviews: 42,
      totalAppointments: 89,
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      workStart: '10:00',
      workEnd: '19:00',
      isActive: true,
    },
    {
      business: business._id,
      name: 'Kiran Patel',
      phone: '+91 91234 56789',
      email: 'kiran@priyasalon.com',
      role: 'Skin Therapist',
      specializations: ['Facial', 'Chemical Peel', 'Microdermabrasion'],
      color: '#38BDF8',
      rating: 4.6,
      totalReviews: 28,
      totalAppointments: 64,
      workingDays: ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      workStart: '09:00',
      workEnd: '18:00',
      isActive: true,
    },
    {
      business: business._id,
      name: 'Deepa Nair',
      phone: '+91 98876 54321',
      email: 'deepa@priyasalon.com',
      role: 'Nail Artist',
      specializations: ['Gel Nails', 'Nail Art', 'Manicure', 'Pedicure'],
      color: '#A78BFA',
      rating: 4.9,
      totalReviews: 61,
      totalAppointments: 94,
      workingDays: ['monday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      workStart: '10:00',
      workEnd: '20:00',
      isActive: true,
    },
  ]);

  const services = await Service.insertMany([
    { business: business._id, name: "Women's Haircut & Style", category: 'Hair',    price: 800,  duration: 60,  color: '#00E676', isPopular: true,  bookingsCount: 78, totalRevenue: 62400,  isActive: true },
    { business: business._id, name: 'Global Hair Color',       category: 'Hair',    price: 2500, duration: 120, color: '#FBB040', isPopular: true,  bookingsCount: 41, totalRevenue: 102500, isActive: true },
    { business: business._id, name: 'Keratin Treatment',       category: 'Hair',    price: 3500, duration: 180, color: '#38BDF8', isPopular: false, bookingsCount: 22, totalRevenue: 77000,  isActive: true },
    { business: business._id, name: 'Classic Facial',          category: 'Skin',    price: 1200, duration: 60,  color: '#FB7185', isPopular: true,  bookingsCount: 56, totalRevenue: 67200,  isActive: true },
    { business: business._id, name: 'Gel Manicure',            category: 'Nails',   price: 600,  duration: 45,  color: '#A78BFA', isPopular: false, bookingsCount: 93, totalRevenue: 55800,  isActive: true },
    { business: business._id, name: 'Bridal Package',          category: 'Makeup',  price: 8500, duration: 240, color: '#2DD4BF', isPopular: true,  bookingsCount: 12, totalRevenue: 102000, isActive: true },
    { business: business._id, name: 'Full Body Massage',       category: 'Massage', price: 2000, duration: 90,  color: '#F472B6', isPopular: false, bookingsCount: 34, totalRevenue: 68000,  isActive: true },
    { business: business._id, name: "Men's Haircut",           category: 'Hair',    price: 400,  duration: 30,  color: '#34D399', isPopular: false, bookingsCount: 67, totalRevenue: 26800,  isActive: true },
  ]);

  const contactsRaw = [
    { name: 'Priya Sharma',   phone: '+91 98001 11111', email: 'priya.s@gmail.com',  gender: 'female', tags: ['vip', 'regular'], totalAppointments: 14, totalSpent: 28500, waId: '919800111111' },
    { name: 'Meera Reddy',    phone: '+91 98001 22222', email: 'meera.r@gmail.com',  gender: 'female', tags: ['regular'],         totalAppointments: 8,  totalSpent: 12400 },
    { name: 'Sunita Joshi',   phone: '+91 98001 33333',                               gender: 'female', tags: ['new'],             totalAppointments: 2,  totalSpent: 2200  },
    { name: 'Anjali Singh',   phone: '+91 98001 44444', email: 'anjali@outlook.com', gender: 'female', tags: ['vip'],             totalAppointments: 19, totalSpent: 45000 },
    { name: 'Kavitha Nair',   phone: '+91 98001 55555',                               gender: 'female', tags: [],                  totalAppointments: 5,  totalSpent: 7800  },
    { name: 'Rohit Mehta',    phone: '+91 98001 66666',                               gender: 'male',   tags: ['regular'],         totalAppointments: 11, totalSpent: 5600  },
    { name: 'Arjun Verma',    phone: '+91 98001 77777',                               gender: 'male',   tags: [],                  totalAppointments: 6,  totalSpent: 3200  },
    { name: 'Sneha Patel',    phone: '+91 98001 88888', email: 'sneha.p@gmail.com',  gender: 'female', tags: ['bridal'],          totalAppointments: 3,  totalSpent: 18500 },
    { name: 'Divya Krishnan', phone: '+91 98001 99999',                               gender: 'female', tags: ['regular', 'vip'], totalAppointments: 21, totalSpent: 52000 },
    { name: 'Neha Gupta',     phone: '+91 98002 11111',                               gender: 'female', tags: ['new'],             totalAppointments: 1,  totalSpent: 800   },
  ];

  const contacts = await Contact.insertMany(
    contactsRaw.map((c) => ({
      ...c,
      business: business._id,
      source: 'whatsapp',
      status: 'active',
      lastVisit: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    }))
  );

  const statuses = ['pending', 'confirmed', 'completed', 'completed', 'completed', 'cancelled', 'no_show', 'checked_in'];
  const sources  = ['whatsapp', 'whatsapp', 'whatsapp', 'staff', 'web'];
  const now = new Date();
  const aptDocs = [];

  for (let i = 0; i < 60; i++) {
    const svc     = services[Math.floor(Math.random() * services.length)];
    const contact = contacts[Math.floor(Math.random() * contacts.length)];
    const staff   = staffMembers[Math.floor(Math.random() * staffMembers.length)];
    const d       = new Date(now);
    d.setDate(d.getDate() + Math.floor(Math.random() * 60) - 30);
    d.setHours(9 + Math.floor(Math.random() * 9), [0, 30][Math.floor(Math.random() * 2)], 0, 0);
    aptDocs.push({
      business: business._id,
      contact: contact._id,
      staff: staff._id,
      service: svc._id,
      serviceName: svc.name,
      servicePrice: svc.price,
      serviceDuration: svc.duration,
      scheduledAt: d,
      endAt: new Date(d.getTime() + svc.duration * 60000),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      payment: {
        status: 'paid',
        amount: svc.price,
        paidAmount: svc.price,
        method: ['upi', 'cash', 'card'][Math.floor(Math.random() * 3)],
      },
    });
  }

  for (let i = 0; i < 6; i++) {
    const svc     = services[i % services.length];
    const contact = contacts[i % contacts.length];
    const staff   = staffMembers[i % staffMembers.length];
    const d       = new Date();
    d.setHours(10 + i, 0, 0, 0);
    aptDocs.push({
      business: business._id,
      contact: contact._id,
      staff: staff._id,
      service: svc._id,
      serviceName: svc.name,
      servicePrice: svc.price,
      serviceDuration: svc.duration,
      scheduledAt: d,
      endAt: new Date(d.getTime() + svc.duration * 60000),
      status: ['confirmed', 'pending', 'checked_in'][i % 3],
      source: 'whatsapp',
      payment: { status: 'unpaid', amount: svc.price, paidAmount: 0 },
    });
  }

  await Appointment.insertMany(aptDocs);

  const chatDocs = [];
  const convo = [
    { direction: 'inbound',  content: 'Hi, I want to book an appointment' },
    { direction: 'outbound', content: "Hello! Welcome to Priya's Beauty Studio!\n\n1 Book Appointment\n2 View My Bookings\n3 Our Services" },
    { direction: 'inbound',  content: '1' },
    { direction: 'outbound', content: "Please select a service:\n\n1 Women's Haircut (800)\n2 Hair Color (2500)\n3 Facial (1200)\n4 Gel Manicure (600)" },
    { direction: 'inbound',  content: 'Haircut please' },
    { direction: 'outbound', content: "Women's Haircut - 800\n\nToday: 2pm, 4pm, 6pm\nTomorrow: 10am, 12pm, 3pm" },
    { direction: 'inbound',  content: 'Tomorrow 3pm' },
    { direction: 'outbound', content: "Booked!\nTomorrow 3:00 PM\nWomen's Haircut 800\nSee you!" },
  ];

  for (let i = 0; i < Math.min(contacts.length, 5); i++) {
    convo.forEach(function(msg, j) {
      var t = new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000 + j * 2 * 60 * 1000);
      chatDocs.push({
        business: business._id,
        contact: contacts[i]._id,
        direction: msg.direction,
        content: msg.content,
        sentBy: 'bot',
        type: 'text',
        status: 'read',
        isRead: true,
        createdAt: t,
      });
    });
  }

  await ChatMessage.insertMany(chatDocs);

  await Notification.insertMany([
    { business: business._id, type: 'new_appointment', title: 'New Appointment Booked', message: "Priya Sharma booked Women's Haircut via WhatsApp", icon: '📅', color: '#00E676', isRead: false },
    { business: business._id, type: 'payment',         title: 'Payment Received',        message: '₹2,500 received from Anjali Singh',             icon: '💰', color: '#38BDF8', isRead: false },
    { business: business._id, type: 'review',          title: 'New 5-Star Review',       message: 'Divya Krishnan rated Ananya 5 stars',           icon: '⭐', color: '#FBB040', isRead: true  },
    { business: business._id, type: 'cancellation',    title: 'Appointment Cancelled',   message: 'Meera Reddy cancelled her 3pm appointment',     icon: '❌', color: '#FB7185', isRead: true  },
    { business: business._id, type: 'new_appointment', title: 'New Appointment Booked',  message: 'Neha Gupta booked Gel Manicure via WhatsApp',   icon: '📅', color: '#00E676', isRead: false },
  ]);

  console.log('\n Seed complete!\n');
  console.log('YOUR LOGIN CREDENTIALS');
  console.log('Mobile   : 9345578103  (login with this)');
  console.log('Password : Gopal@123');
  console.log('Email    : bsgopa0@gmail.com (reference only)');
  console.log('Name     : GK');
  console.log('Role     : owner (full access)\n');
  console.log('Seeded: ' + contacts.length + ' contacts, ' + aptDocs.length + ' appointments, ' + services.length + ' services, ' + staffMembers.length + ' staff');

  await mongoose.disconnect();
};

seed().catch(function(err) {
  console.error('Seed failed:', err.message);
  process.exit(1);
});