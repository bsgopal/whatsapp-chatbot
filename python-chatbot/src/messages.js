// ============================================================
//  src/messages.js  —  All bot reply templates (Enhanced)
// ============================================================

const moment = require("moment");

const MSG = {

  // ── Entry ──────────────────────────────────────────────────
  welcome: () =>
`👋 *Welcome to the Appointment Booking Bot!*

Please choose what you'd like to do:

1️⃣  📅 Book an Appointment
2️⃣  📋 View My Appointments
3️⃣  ❌ Cancel an Appointment
4️⃣  🔄 Reschedule an Appointment
5️⃣  ℹ️  Help & FAQs

Reply with a number *(1–5)*.`,

  // ── Business selection ─────────────────────────────────────
  selectBusiness: (businesses) => {
    const list = businesses
      .map((b, i) => `${i + 1}️⃣  *${b.name}*\n     _${b.category}_`)
      .join("\n\n");
    return `🏢 *Choose a Business:*\n\n${list}\n\nReply with a number, or *0* for main menu.`;
  },

  // ── Staff selection ────────────────────────────────────────
  selectStaff: (staff) => {
    const list = staff
      .map((s, i) => `${i + 1}️⃣  *${s.name}*\n     _${s.role}_`)
      .join("\n\n");
    return `👤 *Choose a Staff Member:*\n\n${list}\n\nReply with a number, or *0* for main menu.`;
  },

  // ── Service selection ─────────────────────────────────────
  selectService: (services) => {
    const list = services
      .map((s, i) => `${i + 1}️⃣  *${s.name}*\n     💰 ₹${s.price}  ⏱ ${s.duration} min`)
      .join("\n\n");
    return `✂️ *Choose a Service:*\n\n${list}\n\nReply with a number, or *0* for main menu.`;
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
          label: d.isSame(today, "day")
            ? `Today — ${d.format("ddd, DD MMM YYYY")}`
            : d.diff(today, "days") === 1
              ? `Tomorrow — ${d.format("ddd, DD MMM YYYY")}`
              : d.format("ddd, DD MMM YYYY"),
          value: d.format("YYYY-MM-DD"),
        });
      }
      d.add(1, "day");
    }

    const list = available
      .map((dt, i) => `${i + 1}️⃣  ${dt.label}`)
      .join("\n");

    return `📅 *Select a Date:*\n\n${list}\n\nReply with a number *(1–${available.length})*, or *0* for main menu.`;
  },

  // ── Slot selection ─────────────────────────────────────────
  selectSlot: (slots, takenSlots) => {
    const available = slots.filter(s => !takenSlots.includes(s));
    const lines = slots.map((s, i) => {
      const taken = takenSlots.includes(s);
      return taken
        ? `${i + 1}️⃣  ~~${s}~~ ❌`
        : `${i + 1}️⃣  ${s} ✅`;
    });

    const footer = available.length === 0
      ? `\n\n⚠️ _All slots are booked for this day. Reply *0* to choose another date._`
      : `\nReply with a number for an available slot ✅, or *0* for main menu.`;

    return `⏰ *Available Time Slots:*\n\n${lines.join("\n")}${footer}`;
  },

  // ── Ask name ───────────────────────────────────────────────
  askName: () =>
`📝 Please enter your *full name* for the appointment.`,

  // ── Ask phone confirmation ─────────────────────────────────
  askConfirm: ({ businessName, staffName, serviceName, servicePrice, date, slot, name }) =>
`📋 *Please confirm your booking:*

🏢 *Business:*  ${businessName}
✂️ *Service:*   ${serviceName}
👤 *Staff:*     ${staffName}
📅 *Date:*      ${moment(date).format("ddd, DD MMM YYYY")}
⏰ *Time:*      ${slot}
👤 *Name:*      ${name}
💰 *Price:*     ₹${servicePrice}

Reply *YES* to confirm or *NO* to cancel.`,

  // ── Confirm booking ────────────────────────────────────────
  confirmBooking: ({ businessName, staffName, serviceName, servicePrice, serviceDuration, date, slot, name, id }) =>
`✅ *Appointment Confirmed!*

🔖 *Booking ID:* \`${id}\`
━━━━━━━━━━━━━━━━━━━━
🏢 *Business:*  ${businessName}
✂️ *Service:*   ${serviceName}
👤 *Staff:*     ${staffName}
📅 *Date:*      ${moment(date).format("ddd, DD MMM YYYY")}
⏰ *Time:*      ${slot}
⏱ *Duration:*  ${serviceDuration} minutes
👤 *Name:*      ${name}
💰 *Price:*     ₹${servicePrice}
━━━━━━━━━━━━━━━━━━━━

📌 Save your Booking ID: \`${id}\`
You'll receive a reminder before your appointment.

Reply *0* to go back to the main menu.`,

  // ── Slot already taken ─────────────────────────────────────
  slotTaken: () =>
`❌ Sorry, that slot was just booked by someone else. Please choose another slot.`,

  // ── View appointments ──────────────────────────────────────
  viewAppointments: (appts) => {
    if (!appts || appts.length === 0) {
      return `📋 You have *no appointments* yet.\n\nReply *1* to book one, or *0* for main menu.`;
    }

    const active = appts.filter((a) => a.status === "confirmed");
    const cancelled = appts.filter((a) => a.status === "cancelled");
    const today = moment().format("YYYY-MM-DD");

    let msg = `📋 *Your Appointments:*\n`;

    if (active.length > 0) {
      msg += `\n*✅ Upcoming (${active.length}):*\n`;
      active.forEach((a) => {
        const isPast = a.date < today;
        const isToday = a.date === today;
        const tag = isToday ? " 🔔 *TODAY*" : isPast ? " _(past)_" : "";
        msg += `\n🔖 \`${a.id}\`${tag}\n`;
        msg += `   🏢 ${a.businessName}\n`;
        msg += `   ✂️ ${a.serviceName || "—"}\n`;
        msg += `   👤 ${a.staffName}\n`;
        msg += `   📅 ${moment(a.date).format("ddd, DD MMM")} at ${a.slot}\n`;
        msg += `   💰 ₹${a.servicePrice || 0}\n`;
      });
    }

    if (cancelled.length > 0) {
      msg += `\n*❌ Cancelled (${cancelled.length}):*\n`;
      cancelled.forEach((a) => {
        msg += `\n🔖 \`${a.id}\` — ${a.businessName} _(${moment(a.date).format("DD MMM")} ${a.slot})_\n`;
      });
    }

    msg += `\nReply *0* for main menu.`;
    return msg;
  },

  // ── Cancel: ask which ─────────────────────────────────────
  askCancelId: (appts) => {
    const active = appts.filter((a) => a.status === "confirmed");
    if (active.length === 0) {
      return `❌ You have no active appointments to cancel.\n\nReply *0* for main menu.`;
    }
    const list = active
      .map((a, i) => `${i + 1}️⃣  \`${a.id}\` — ${a.businessName}\n     📅 ${moment(a.date).format("DD MMM")} at ${a.slot}\n     ✂️ ${a.serviceName || "—"}`)
      .join("\n\n");
    return `🗑️ *Which appointment to cancel?*\n\n${list}\n\nReply with the number.`;
  },

  cancelConfirm: (a) =>
`✅ *Appointment Cancelled*

🔖 ID: \`${a.id}\`
🏢 ${a.businessName}
✂️ ${a.serviceName || "—"}
📅 ${moment(a.date).format("ddd, DD MMM YYYY")} at ${a.slot}

Reply *0* for main menu.`,

  // ── Reschedule: ask which ─────────────────────────────────
  askRescheduleId: (appts) => {
    const active = appts.filter((a) => a.status === "confirmed");
    if (active.length === 0) {
      return `❌ You have no active appointments to reschedule.\n\nReply *0* for main menu.`;
    }
    const list = active
      .map((a, i) => `${i + 1}️⃣  \`${a.id}\` — ${a.businessName}\n     📅 ${moment(a.date).format("DD MMM")} at ${a.slot}\n     ✂️ ${a.serviceName || "—"}`)
      .join("\n\n");
    return `🔄 *Which appointment to reschedule?*\n\n${list}\n\nReply with the number.`;
  },

  rescheduleConfirm: (a) =>
`✅ *Appointment Rescheduled!*

🔖 ID: \`${a.id}\`
🏢 ${a.businessName}
✂️ ${a.serviceName || "—"}
👤 ${a.staffName}
📅 *New Date:* ${moment(a.date).format("ddd, DD MMM YYYY")} at ${a.slot}

Reply *0* for main menu.`,

  // ── Help / FAQ ─────────────────────────────────────────────
  help: () =>
`ℹ️ *Help & FAQs*

📌 *How to book?*
Reply *1* from the main menu and follow the steps.

📌 *How to cancel?*
Reply *3* from the main menu and select your appointment.

📌 *How to reschedule?*
Reply *4* from the main menu.

📌 *Lost your Booking ID?*
Reply *2* to see all your appointments.

📌 *Need human support?*
Contact us directly at the business.

━━━━━━━━━━━━━━━━━
Reply *0* to go back to the main menu.`,

  // ── Reminder ──────────────────────────────────────────────
  reminder: (a) =>
`🔔 *Appointment Reminder!*

You have an appointment *tomorrow*:

🏢 ${a.businessName}
✂️ ${a.serviceName || "—"}
👤 ${a.staffName}
📅 ${moment(a.date).format("ddd, DD MMM YYYY")} at ${a.slot}
🔖 ID: \`${a.id}\`

Reply *CANCEL* to cancel or *0* to confirm attendance.`,

  // ── Generic ────────────────────────────────────────────────
  invalidInput: () =>
`❓ I didn't understand that. Please reply with a valid number from the options above.\n\nReply *0* to go back to the main menu.`,

  goodbye: () =>
`👋 Thank you! Have a great day.\n\nSend *hi* anytime to start again.`,

  error: () =>
`⚠️ Something went wrong on our end. Please send *hi* to restart.`,
};

module.exports = MSG;