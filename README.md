# 📱 WA Appt OS — WhatsApp Appointment Operating System

> Enterprise-grade WhatsApp Appointment booking & business management platform  
> Built with **React + Tailwind CSS** (Frontend) · **Express + Node.js** (Backend) · **MongoDB** (Database)

---

## 🚀 Features

### Core Modules
| Module | Description |
|---|---|
| 📅 **Appointments** | Full lifecycle management — book, confirm, check-in, complete, cancel, reschedule |
| 💬 **WhatsApp Inbox** | Live chat with Socket.IO, inbound/outbound messages, bot & staff mode |
| 👥 **CRM / Contacts** | Client profiles, visit history, spending analytics, tags |
| 📊 **Analytics** | Revenue charts, KPIs, top services, status distribution (Recharts) |
| 👤 **Staff** | Team management, working hours, specializations, color-coded calendar |
| ✂️ **Services** | Service catalogue with pricing, duration, categories, revenue tracking |
| ⚙️ **Settings** | WhatsApp Cloud API config, bot settings, subscription plans |

### Technical Highlights
- 🔐 **JWT Auth** with bcrypt password hashing, role-based access (owner/admin/staff)
- ⚡ **Real-time** with Socket.IO — live appointment & message notifications
- 🤖 **WhatsApp Cloud API** webhook — inbound messages auto-create contacts & chat history
- 📡 **Mongoose** with compound indexes, virtual fields, pre-save hooks
- 🛡️ **Helmet + CORS + Rate Limiting** — production-ready security
- 🪵 **Winston** structured logging with file rotation
- 🐳 **Docker Compose** for one-command deployment

---

## 🏗️ Project Structure

```
wa-appt-os/
├── backend/
│   ├── models/
│   │   ├── User.js            # Auth — bcrypt + JWT
│   │   ├── Business.js        # Business + WhatsApp config + subscription
│   │   ├── Appointment.js     # Full appointment lifecycle
│   │   └── index.js           # Contact, Staff, Service, ChatMessage, Notification
│   ├── routes/
│   │   ├── auth.js            # register, login, me, update
│   │   ├── appointments.js    # CRUD + today + status updates
│   │   ├── contacts.js        # CRM CRUD + appointment history
│   │   ├── analytics.js       # Dashboard KPIs + revenue charts
│   │   ├── settings.js        # Business + WhatsApp settings
│   │   ├── chat.js            # Conversations + messages + send
│   │   ├── webhook.js         # WhatsApp Cloud API webhook
│   │   ├── staff.js           # Staff CRUD
│   │   ├── services.js        # Services CRUD
│   │   └── notifications.js   # Notifications + mark read
│   ├── middleware/
│   │   ├── auth.js            # JWT protect + authorize
│   │   └── errorHandler.js    # Global error handler
│   ├── utils/logger.js        # Winston logger
│   ├── scripts/seed.js        # Demo data seeder
│   ├── server.js              # Express + Socket.IO entry
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── api/index.js       # Axios client + all API modules
│   │   ├── context/
│   │   │   └── authStore.js   # Zustand auth store
│   │   ├── hooks/
│   │   │   └── useSocket.js   # Socket.IO hook
│   │   ├── components/
│   │   │   ├── layout/AppShell.jsx       # Sidebar + topbar + notifications
│   │   │   ├── auth/LoginPage.jsx
│   │   │   ├── auth/RegisterPage.jsx
│   │   │   ├── dashboard/Dashboard.jsx   # KPIs + trend chart + today
│   │   │   ├── appointments/Appointments.jsx
│   │   │   ├── contacts/Contacts.jsx
│   │   │   ├── chat/Chat.jsx             # WhatsApp inbox
│   │   │   ├── analytics/Analytics.jsx
│   │   │   ├── staff/Staff.jsx
│   │   │   ├── services/Services.jsx
│   │   │   └── settings/Settings.jsx
│   │   ├── App.jsx            # Router + auth guards
│   │   └── main.jsx           # ReactQuery + Toaster
│   ├── tailwind.config.js     # Custom design system
│   ├── vite.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
└── README.md
```

---

## ⚡ Quick Start

### Option 1 — Docker (Recommended)

```bash
# Clone and run
git clone https://github.com/yourorg/wa-appt-os.git
cd wa-appt-os

# Start everything
docker-compose up -d

# Seed demo data
docker exec wa_appt_backend node scripts/seed.js

# Open
open http://localhost:3000
```

Login with: `demo@waappt.com` / `demo1234`

---

### Option 2 — Manual Setup

#### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas)

#### Backend

```bash
cd backend
npm install
cp .env.example .env

# Edit .env:
# MONGO_URI=mongodb://localhost:27017/wa_appt_os
# JWT_SECRET=your_min_32_char_secret_here

npm run dev          # starts on :5000
npm run seed         # seed demo data
```

#### Frontend

```bash
cd frontend
npm install
npm run dev          # starts on :3000
```

---

## 🔗 WhatsApp Cloud API Setup

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a Meta App → Add **WhatsApp** product
3. Create a **WhatsApp Business Account (WABA)**
4. Add a phone number — get your **Phone Number ID**
5. Generate a **permanent system user access token**
6. In Meta Dashboard → Webhooks → paste your webhook URL:
   ```
   https://your-domain.com/api/v1/webhook/whatsapp
   ```
7. Subscribe to `messages` field
8. Enter all credentials in **Settings → WhatsApp API** in the app

---

## 📡 API Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/appointments?status=&from=&to=&page=
GET    /api/v1/appointments/today
POST   /api/v1/appointments
PUT    /api/v1/appointments/:id
DELETE /api/v1/appointments/:id

GET    /api/v1/contacts?search=&page=
POST   /api/v1/contacts
PUT    /api/v1/contacts/:id
DELETE /api/v1/contacts/:id
GET    /api/v1/contacts/:id/appointments

GET    /api/v1/staff
POST   /api/v1/staff
PUT    /api/v1/staff/:id
DELETE /api/v1/staff/:id

GET    /api/v1/services
POST   /api/v1/services
PUT    /api/v1/services/:id
DELETE /api/v1/services/:id

GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/revenue?period=30d

GET    /api/v1/chat/conversations
GET    /api/v1/chat/:contactId/messages
POST   /api/v1/chat/:contactId/send

GET    /api/v1/settings
PUT    /api/v1/settings
PUT    /api/v1/settings/whatsapp

GET    /api/v1/notifications
PUT    /api/v1/notifications/mark-all-read

GET    /api/v1/webhook/whatsapp   # verification
POST   /api/v1/webhook/whatsapp   # inbound messages
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS 3, Framer Motion, Recharts |
| State | Zustand, TanStack Query (React Query) |
| Routing | React Router v6 |
| HTTP Client | Axios with interceptors |
| Real-time | Socket.IO client |
| Backend | Node.js 20, Express 4 |
| Database | MongoDB 7 with Mongoose 8 |
| Auth | JWT + bcryptjs |
| Real-time | Socket.IO server |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Winston |
| Payments | Razorpay (integration ready) |
| Messaging | WhatsApp Cloud API (Meta) |
| Container | Docker + Docker Compose + Nginx |

---

## 📊 Subscription Plans

| Plan | Price | Staff | Appointments |
|---|---|---|---|
| Starter | ₹999/mo | 1 | 200/month |
| Pro | ₹2,999/mo | 5 | Unlimited |
| Enterprise | ₹7,999/mo | Unlimited | Unlimited + White Label |

---

## 🔒 Environment Variables

```env
# Required
MONGO_URI=mongodb://localhost:27017/wa_appt_os
JWT_SECRET=min_32_character_secret_key_here
PORT=5000

# WhatsApp (Meta Business)
WA_PHONE_NUMBER_ID=your_phone_number_id
WA_WABA_ID=your_waba_id
WA_ACCESS_TOKEN=your_access_token
WA_VERIFY_TOKEN=your_custom_verify_token

# Payments
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Frontend
CLIENT_URL=http://localhost:3000
```

---

## 📄 License

MIT — Built for the Indian SMB market 🇮🇳
#   w h a t s a p p - c h a t b o t  
 