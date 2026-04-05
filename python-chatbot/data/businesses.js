// ============================================================
//  data/businesses.js  —  Add / edit your businesses here
// ============================================================

const businesses = [
  {
    id: "clinic",
    name: "🏥 City Health Clinic",
    category: "Doctor",
    staff: [
      { id: "dr_ravi",   name: "Dr. Ravi Kumar",   role: "General Physician" },
      { id: "dr_priya",  name: "Dr. Priya Sharma",  role: "Dermatologist"     },
    ],
    workingDays: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    slots: ["09:00 AM","10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM"],
    slotDuration: 30, // minutes
  },
  {
    id: "salon",
    name: "💇 Style Studio Salon",
    category: "Hair Salon",
    staff: [
      { id: "stylist_anu",   name: "Anu",   role: "Senior Stylist"  },
      { id: "stylist_kiran", name: "Kiran", role: "Hair Color Expert"},
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
      { id: "trainer_raj",  name: "Raj",  role: "Personal Trainer" },
      { id: "trainer_meena",name: "Meena",role: "Yoga Instructor"  },
    ],
    workingDays: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    slots: ["06:00 AM","07:00 AM","08:00 AM","05:00 PM","06:00 PM","07:00 PM"],
    slotDuration: 60,
  },
];

module.exports = businesses;