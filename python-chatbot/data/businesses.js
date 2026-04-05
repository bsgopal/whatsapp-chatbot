// ============================================================
//  data/businesses.js  —  Multi-business config with services
//  Each business has: staff, services, workingDays, slots
// ============================================================

const businesses = [
  {
    id: "clinic",
    name: "🏥 City Health Clinic",
    category: "Doctor",
    staff: [
      { id: "dr_ravi",  name: "Dr. Ravi Kumar",  role: "General Physician" },
      { id: "dr_priya", name: "Dr. Priya Sharma", role: "Dermatologist"     },
    ],
    services: [
      { id: "general_checkup",    name: "General Checkup",      price: 500,  duration: 30 },
      { id: "skin_consultation",  name: "Skin Consultation",    price: 800,  duration: 30 },
      { id: "follow_up",          name: "Follow-up Visit",      price: 300,  duration: 20 },
      { id: "blood_test",         name: "Blood Test Referral",  price: 200,  duration: 15 },
    ],
    workingDays: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    slots: ["09:00 AM","10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM"],
    slotDuration: 30,
  },
  {
    id: "salon",
    name: "💇 Style Studio Salon",
    category: "Hair Salon",
    staff: [
      { id: "stylist_anu",   name: "Anu",   role: "Senior Stylist"   },
      { id: "stylist_kiran", name: "Kiran", role: "Hair Color Expert" },
    ],
    services: [
      { id: "haircut",    name: "Haircut & Styling",   price: 400,  duration: 45  },
      { id: "hair_color", name: "Hair Coloring",       price: 1200, duration: 90  },
      { id: "facial",     name: "Facial & Cleanup",    price: 600,  duration: 60  },
      { id: "bridal",     name: "Bridal Makeup",       price: 5000, duration: 180 },
      { id: "manicure",   name: "Manicure & Pedicure", price: 500,  duration: 60  },
    ],
    workingDays: ["Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    slots: ["10:00 AM","11:00 AM","12:00 PM","01:00 PM","03:00 PM","04:00 PM","05:00 PM","06:00 PM"],
    slotDuration: 45,
  },
  {
    id: "gym",
    name: "💪 FitZone Gym",
    category: "Gym / Fitness",
    staff: [
      { id: "trainer_raj",   name: "Raj",   role: "Personal Trainer" },
      { id: "trainer_meena", name: "Meena", role: "Yoga Instructor"  },
    ],
    services: [
      { id: "personal_training",  name: "Personal Training Session", price: 800, duration: 60 },
      { id: "yoga_class",         name: "Yoga Class",                price: 500, duration: 60 },
      { id: "diet_consult",       name: "Diet & Nutrition Consult",  price: 600, duration: 45 },
      { id: "fitness_assessment", name: "Fitness Assessment",        price: 400, duration: 30 },
    ],
    workingDays: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    slots: ["06:00 AM","07:00 AM","08:00 AM","05:00 PM","06:00 PM","07:00 PM"],
    slotDuration: 60,
  },
];

module.exports = businesses;