# Luxora — Luxury Home Concierge Platform

A subscription-based, full-stack web platform that brings **Auto Care**, **Garden Care**, and **Pet Care** under one premium concierge experience. Customers subscribe, book, and track services; KYC-verified providers fulfill them with secure PIN verification; admins oversee the whole network.

> Academic mini-project — CCS2313 Project Management, SLTC. Built with React 19 + Vite (frontend), Express 5 (backend), Prisma ORM, and PostgreSQL (hosted on Aiven).

---

## 🧱 Project Structure

```
Luxora/
├── frontend/        # React 19 + Vite
│   ├── src/         # components, pages, services (api.js hits :5000)
│   └── public/
├── backend/         # Node.js + Express 5
│   ├── src/
│   │   ├── routes/      # one router per domain (auth, bookings, admin...)
│   │   ├── controllers/  # (route handlers live in routes/)
│   │   ├── services/     # cross-cutting helpers (notify)
│   │   ├── middleware/   # auth (JWT)
│   │   ├── models/       # (managed by Prisma)
│   │   └── config/       # prisma client, env
│   ├── prisma/          # schema.prisma + seed.js
│   └── package.json
├── docker-compose.yml
└── Dockerfile
```

## 🚀 Setup

```bash
# Backend
cp backend/.env.example backend/.env   # fill DATABASE_URL + JWT_SECRET
cd backend
npm install
npx prisma generate
npx prisma db push      # creates tables in PostgreSQL / Aiven
npm run seed            # categories, services, plans, demo accounts
npm run dev             # API on http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev             # Vite on http://localhost:5173
```

Demo login: `customer@luxora.lk` / `customer123` (one account per role — see [Demo Accounts](#-demo-accounts)).

## ✨ Features

### Customer
- Register / login (JWT auth)
- Browse services & subscription plans, subscribe
- Book a service → auto-matched to an available KYC-verified provider
- Secure **4-digit PIN verification** for provider start/completion
- Customer dashboard: active memberships, upcoming & past bookings, reviews
- Rate & review completed services (1–5 stars)
- Cancel pending bookings
- Real-time **notifications** (assignment, start, completion)

### Provider
- Register + KYC submission (admin approval gated)
- Availability toggle (available / busy / offline)
- Assigned bookings queue + accept via PIN
- Earnings & job history
- Notifications on new assignments

### Admin
- Dashboard stats (customers, providers, bookings, revenue — LKR)
- Provider KYC approval / rejection
- Booking oversight (all bookings w/ customer + provider)
- Complaint management (open → in_review → resolved)
- Promotion management (create / activate / deactivate)

### Design
- Luxury dark + gold aesthetic (Playfair Display + Inter)
- **Framer Motion** scroll-reveal, staggered entrances, page transitions
- Hero pointer-glow, count-up stats, animated cards
- Fully responsive

---

## 🧱 Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Framer Motion 11 |
| Backend | Node.js, Express 5, JWT, bcryptjs |
| Database | PostgreSQL via Prisma (Aiven) |
| Styling | CSS Modules / global CSS variables |

---

## 🚀 Run Locally

### Prerequisites
- Node.js 18+ (tested on v22)
- npm

### 1. Install dependencies
```bash
cd Luxora
npm install
```

### 2. Start the backend (port 5000)
```bash
npm run server
```
The database (`luxora.db`) is created and **auto-seeded** with categories, services, and subscription plans on first run.

### 3. Start the frontend (port 5173)
```bash
npm run dev
```
Open http://localhost:5173

### Or run both at once
```bash
npm run dev:all
```

---

## 🔑 Demo Accounts

`npm run seed` creates the demo accounts below. Their passwords come from `backend/.env` (`CUSTOMER_PASSWORD`, `PROVIDER_PASSWORD`, `ADMIN_PASSWORD` — placeholders in `.env.example`), and all of them authenticate through the normal bcrypt flow:

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@luxora.lk` | from `CUSTOMER_PASSWORD` (default local: `customer123`) |
| Provider | `provider@luxora.lk` | from `PROVIDER_PASSWORD` (default local: `provider123`) — KYC approved, Auto Care |
| Admin | `admin@luxora.lk` | from `ADMIN_PASSWORD` (default local: `admin123`) |

New users can still self-register as **customer** or **provider** via the UI (providers need admin KYC approval). Admin accounts can only be created by seeding — self-registering as admin is blocked.

### Typical flow
1. Log in as the demo **customer** → subscribe to a plan → book a service.
2. Booking is auto-matched to the demo **provider** (KYC approved, Auto Care).
3. Provider enters the customer's **PIN** to start/complete the booking.
4. Customer leaves a review; earnings are credited to the provider (85% payout).

---

## 📡 REST API Reference

Base URL: `http://localhost:5000/api`

### Auth
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | – | Register (customer/provider — admin is seed-only) |
| POST | `/auth/login` | – | Login → returns JWT |
| GET | `/auth/me` | ✔ | Current user profile |

### Catalogue
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/categories` | – | Service categories |
| GET | `/services` | – | All services |
| GET | `/subscriptions` | – | Subscription plans |
| POST | `/subscriptions/subscribe` | ✔ | Subscribe to a plan |

### Bookings
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/bookings` | ✔ | Create booking (auto-assigns provider) |
| GET | `/bookings/my` | ✔ | Customer's bookings |
| GET | `/bookings/assigned` | Provider | Provider's assigned/pending bookings |
| PUT | `/bookings/:id/status` | Provider | Start/complete (PIN required) |
| PUT | `/bookings/:id/cancel` | ✔ | Cancel own pending booking |

### Reviews & Complaints
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/reviews` | ✔ | Review a completed booking |
| POST | `/complaints` | ✔ | File a complaint |

### Customer
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/customer/dashboard` | ✔ | Profile, subs, bookings, reviews |

### Provider
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| PUT | `/provider/availability` | Provider | Set availability status |
| GET | `/provider/earnings` | Provider | Earnings + job history |

### Promotions
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/promotions` | – | Active promotions |
| POST | `/admin/promotions` | Admin | Create promotion |
| PUT | `/admin/promotions/:id` | Admin | Toggle active |

### Admin
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/admin/stats` | Admin | Platform stats |
| GET | `/admin/providers` | Admin | All providers |
| PUT | `/admin/providers/:id/kyc` | Admin | Approve/reject KYC |
| GET | `/admin/bookings` | Admin | All bookings |
| GET | `/admin/complaints` | Admin | All complaints |
| PUT | `/admin/complaints/:id` | Admin | Update complaint status |

### Notifications
| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/notifications` | ✔ | User's notifications |
| PUT | `/notifications/:id/read` | ✔ | Mark as read |

---

## 📁 Project Structure

```
Luxora/
├── server/
│   ├── index.js          # Express API (auth, bookings, admin, promos, notifs)
│   ├── db.js             # SQLite schema + seed data
│   ├── auth.js           # JWT + role middleware
│   └── luxora.db         # runtime DB (gitignored, auto-created)
├── src/
│   ├── components/        # Navbar, Hero, Stats, Services, About, Membership, Reveal
│   ├── pages/            # Login, Signup, ProviderRegister, ProviderDashboard,
│   │                     #   CustomerDashboard, BookService, Reviews, AdminDashboard
│   ├── services/api.js   # Fetch helper
│   ├── App.jsx           # Routing
│   └── main.jsx
├── index.html
└── vite.config.js
```

---

## 📌 Notes
- Currency is **LKR** (Sri Lankan Rupee).
- Provider payout is **85%** of booking total on completion.
- Out of scope (per spec): marketplace provider-choice, emergency requests, intl ops, vet treatment, crypto/cash.
