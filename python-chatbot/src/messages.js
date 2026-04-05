// ============================================================
//  src/messages.js  —  All bot reply templates
// ============================================================

const moment = require("moment");

const MSG = {

  // ── Entry ──────────────────────────────────────────────────
  welcome: (name = "there") =>
`👋 Hello ${name}! Welcome to the *Appointment Booking Bot*.

Please choose what you'd like to do:

1️⃣  Book an Appointment
2️⃣  View My Appointments
3️⃣  Cancel an Appointment
4️⃣  Reschedule an Appointment

Reply with a number (1–4).`,

  // ── Business selection ─────────────────────────────────────
  selectBusiness: (businesses) => {
    const list = businesses
      .map((b, i) => `${i + 1}️⃣  ${b.name}\n     _${b.category}_`)
      .join("\n\n");
    return `🏢 *Choose a Business:*\n\n${list}\n\nReply with a number.`;
  },

  // ── Staff selection ────────────────────────────────────────
  selectStaff: (staff) => {
    const list = staff
      .map((s, i) => `${i + 1}️⃣  *${s.name}*\n     _${s.role}_`)
      .join("\n\n");
    return `👤 *Choose a Staff Member:*\n\n${list}\n\nReply with a number.`;
  },

  // ── Date selection ─────────────────────────────────────────
  selectDate: (workingDays) => {
    const today = moment();
    const available = [];
    let d = today.clone();

    while (available.length < 7) {
      const dayName = d.format("dddd");
      if (workingDays.includes(dayName)) {
        available.push({
          label: d.format("ddd, DD MMM YYYY"),
          value: d.format("YYYY-MM-DD"),
        });
      }
      d.add(1, "day");
    }

    const list = available
      .map((dt, i) => `${i + 1}️⃣  ${dt.label}`)
      .join("\n");

    return `📅 *Select a Date:*\n\n${list}\n\nReply with a number (1–${available.length}).`;
  },

  // ── Slot selection ─────────────────────────────────────────
  selectSlot: (slots, takenSlots) => {
    const lines = slots.map((s, i) => {
      const taken = takenSlots.includes(s);
      return taken
        ? `${i + 1}️⃣  ~~${s}~~ ❌ Booked`
        : `${i + 1}️⃣  ${s} ✅`;
    });
    return `⏰ *Available Time Slots:*\n\n${lines.join("\n")}\n\nReply with a number for an available slot.`;
  },

  // ── Ask name ───────────────────────────────────────────────
  askName: () =>
`📝 Please enter your *full name* for the appointment booking.`,

  // ── Confirm booking ────────────────────────────────────────
  confirmBooking: ({ businessName, staffName, date, slot, name }) =>
`✅ *Appointment Confirmed!*

🏢 *Business:*  ${businessName}
👤 *Staff:*     ${staffName}
📅 *Date:*      ${moment(date).format("ddd, DD MMM YYYY")}
⏰ *Time:*      ${slot}
👤 *Name:*      ${name}

Your booking ID will be shown in your appointments list.
Reply *0* to go back to the main menu.`,

  // ── Slot already taken ─────────────────────────────────────
  slotTaken: () =>
`❌ Sorry, that slot was just booked by someone else. Please choose another time slot.`,

  // ── View appointments ──────────────────────────────────────
  viewAppointments: (appts) => {
    if (!appts || appts.length === 0) {
      return `📋 You have *no appointments* yet.\n\nReply *0* for main menu.`;
    }

    const active = appts.filter((a) => a.status === "confirmed");
    const cancelled = appts.filter((a) => a.status === "cancelled");

    let msg = `📋 *Your Appointments:*\n`;

    if (active.length > 0) {
      msg += `\n*✅ Upcoming:*\n`;
      active.forEach((a) => {
        msg += `\n🔖 ID: \`${a.id}\`\n`;
        msg += `   🏢 ${a.businessName}\n`;
        msg += `   👤 ${a.staffName}\n`;
        msg += `   📅 ${moment(a.date).format("ddd, DD MMM YYYY")} at ${a.slot}\n`;
        msg += `   👤 ${a.name}\n`;
      });
    }

    if (cancelled.length > 0) {
      msg += `\n*❌ Cancelled:*\n`;
      cancelled.forEach((a) => {
        msg += `\n🔖 ID: \`${a.id}\` — ${a.businessName} (${moment(a.date).format("DD MMM")} ${a.slot})\n`;
      });
    }

    msg += `\nReply *0* for main menu.`;
    return msg;
  },

  // ── Cancel: ask ID ─────────────────────────────────────────
  askCancelId: (appts) => {
    const active = appts.filter((a) => a.status === "confirmed");
    if (active.length === 0) {
      return `❌ You have no active appointments to cancel.\n\nReply *0* for main menu.`;
    }
    const list = active
      .map((a, i) => `${i + 1}️⃣  \`${a.id}\` — ${a.businessName}\n     📅 ${moment(a.date).format("DD MMM")} at ${a.slot}`)
      .join("\n\n");
    return `🗑️ *Which appointment to cancel?*\n\n${list}\n\nReply with the number.`;
  },

  cancelConfirm: (a) =>
`✅ *Appointment Cancelled!*

🔖 ID: \`${a.id}\`
🏢 ${a.businessName}
📅 ${moment(a.date).format("ddd, DD MMM YYYY")} at ${a.slot}

Reply *0* for main menu.`,

  // ── Reschedule: ask ID ─────────────────────────────────────
  askRescheduleId: (appts) => {
    const active = appts.filter((a) => a.status === "confirmed");
    if (active.length === 0) {
      return `❌ You have no active appointments to reschedule.\n\nReply *0* for main menu.`;
    }
    const list = active
      .map((a, i) => `${i + 1}️⃣  \`${a.id}\` — ${a.businessName}\n     📅 ${moment(a.date).format("DD MMM")} at ${a.slot}`)
      .join("\n\n");
    return `🔄 *Which appointment to reschedule?*\n\n${list}\n\nReply with the number.`;
  },

  rescheduleConfirm: (a) =>
`✅ *Appointment Rescheduled!*

🔖 ID: \`${a.id}\`
🏢 ${a.businessName}
📅 New Date: ${moment(a.date).format("ddd, DD MMM YYYY")} at ${a.slot}

Reply *0* for main menu.`,

  // ── Generic ────────────────────────────────────────────────
  invalidInput: () =>
`❓ I didn't understand that. Please reply with a valid number from the options above.\n\nReply *0* to go back to the main menu.`,

  goodbye: () =>
`👋 Thank you! Have a great day.\n\nSend *hi* anytime to start again.`,
};

module.exports = MSG;