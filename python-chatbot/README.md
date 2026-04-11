# 📱 WhatsApp Appointment Booking Bot

A free WhatsApp chatbot built with `whatsapp-web.js` that lets users book, cancel, and reschedule appointments across multiple businesses (clinics, salons, gyms, etc.)

---

## 🗂️ Project Structure

```
whatsapp-appointment-bot/
├── src/
│   ├── bot.js              ← WhatsApp client (entry point)
│   ├── flowHandler.js      ← Conversation steps & logic
│   ├── sessionManager.js   ← Per-user session tracking
│   ├── appointmentStore.js ← Book / cancel / reschedule
│   └── messages.js         ← All WhatsApp message templates
├── data/
│   └── businesses.js       ← Your businesses config
├── package.json
└── README.md
```

---

## ⚙️ Setup & Run

### 1. Install Node.js
Download from https://nodejs.org (v16 or higher)

### 2. Install dependencies
```bash
cd whatsapp-appointment-bot
npm install
```

### 3. Start the bot
```bash
npm start
```

### 4. Scan QR Code
- A QR code appears in your terminal
- Open WhatsApp on your phone → Linked Devices → Link a Device
- Scan the QR code
- ✅ Bot is now live!

> After first scan, the session is saved — no need to scan again on restart.

---

## 💬 How it Works (Full Conversation Flow)

```
User sends "hi"
        ↓
[MAIN MENU]
  1️⃣ Book Appointment
  2️⃣ View My Appointments
  3️⃣ Cancel Appointment
  4️⃣ Reschedule Appointment

── BOOKING FLOW ──────────────────────────────
  → Choose Business (Clinic / Salon / Gym)
  → Choose Staff / Doctor / Stylist
  → Choose Date (next 7 available working days)
  → Choose Time Slot (booked slots marked ❌)
  → Enter Your Name
  → ✅ Confirmed! (Booking ID shown)

── CANCEL FLOW ───────────────────────────────
  → Lists your active appointments
  → Choose which to cancel
  → ✅ Cancelled!

── RESCHEDULE FLOW ───────────────────────────
  → Lists your active appointments
  → Choose which to reschedule
  → Pick new date → Pick new slot
  → ✅ Rescheduled!

At any point: reply "0" to go back to main menu
```

---

## 🏢 Adding Your Own Businesses

Edit `data/businesses.js`:

```js
{
  id: "dental",                      // unique ID
  name: "🦷 Bright Smile Dental",
  category: "Dentist",
  staff: [
    { id: "dr_ali", name: "Dr. Ali", role: "Orthodontist" },
  ],
  workingDays: ["Monday","Tuesday","Wednesday","Thursday","Friday"],
  slots: ["09:00 AM","10:00 AM","11:00 AM","02:00 PM","03:00 PM"],
  slotDuration: 30,
}
```

---

## 🔒 Multi-User Support

- Every WhatsApp number gets its **own independent session**
- Sessions auto-expire after **10 minutes of inactivity**
- Double-booking prevention: same staff + date + slot can't be booked twice
- Send `0` at any step to reset to the main menu

---

## 🗄️ Using a Real Database (Production)

The `appointmentStore.js` uses in-memory storage by default.
For production, replace the store functions with a real DB:

| Database   | Package          |
|------------|------------------|
| SQLite     | `better-sqlite3` |
| MongoDB    | `mongoose`       |
| PostgreSQL | `pg`             |
| MySQL      | `mysql2`         |

---

## ⚠️ Important Notes

- This uses `whatsapp-web.js` which simulates WhatsApp Web — it's **free** but requires keeping the Node process running
- For production/high volume, consider **WhatsApp Business API** (paid, from Meta)
- Do **not** use for spam — follow WhatsApp's Terms of Service

---

## 📞 Troubleshooting

| Problem | Fix |
|---|---|
| QR not showing | Run `npm install` again |
| Auth keeps failing | Delete `.wwebjs_auth/` folder |
| Messages not received | Make sure phone stays connected |
| Puppeteer errors on Linux | Install: `apt-get install -y chromium-browser` |
