# Luxora
Luxora is a PostgreSQL-backed React/Vite + Express/Prisma platform for premium home-concierge services. Customers purchase packages, receive category entitlements, book services, and track fulfilment. KYC-approved providers fulfil assigned work with PIN/photo controls. Admins manage users, catalogue, bookings, support, refunds, promotions, reports, and scheduling.
## Architecture
Browser -> Vite React frontend (:3000 locally) -> Express API (:5000 locally) -> Prisma -> PostgreSQL. Production normally uses Vercel for the frontend and a managed Node host such as Northflank for the API. The frontend never connects directly to PostgreSQL.
## Repository
- frontend: React pages, shared PortalShell, CSS, API helper.
- backend: Express routes, middleware, services, integrations, Prisma.
- backend/prisma/schema.prisma: database source of truth.
- backend/prisma/migrations: deployable migration history.
- docs: API, database, integrations, requirements, and roadmap.
## Setup
Prerequisites: Node 18+, npm, PostgreSQL, Git.
    Copy-Item backend/.env.example backend/.env
    Copy-Item frontend/.env.example frontend/.env.local
    npm install
    npm --prefix backend install
    npm --prefix frontend install
    npm --prefix backend run prisma:generate
    npm --prefix backend run db:push
    npm --prefix backend run seed
Set DATABASE_URL, JWT_SECRET, PORT, FRONTEND_URL, CORS_ORIGIN, PAYMENT_MODE in backend/.env and VITE_API_URL=http://localhost:5000/api in frontend/.env.local. Start with npm run backend and npm run frontend, or npm run dev:all.
Health: GET /api/health. Docs: /api/docs and /api/openapi.json.
## Roles
Customer: profile/town/phone, packages, entitlements, bookings, notifications, support, complaints, reviews, eligible refunds.
Provider: KYC, towns/availability, assigned jobs, PIN/photo lifecycle, earnings.
Admin: users, providers/KYC, bookings, plans, complaints, support, promotions, reports, refunds, scheduling.
Super Admin: Admin with isSuperAdmin=true; only this role may change scheduling or create/update plans.
## Configuration rules
Real .env files stay out of Git. Database and integration secrets are backend-only. CORS_ORIGIN is an explicit comma-separated allow-list. PAYMENT_MODE=demo is local/test checkout; PAYMENT_MODE=payhere enables PayHere. Hosted PostgreSQL URLs should use connection_limit=5 and pool_timeout=10.
## Quality gates
Run npm run build and npm run lint. Inspect affected roles at desktop/mobile widths, verify Network/Console, test authorization boundaries, and preserve real API data. Read the linked docs in frontend/, backend/, and docs/ before changing contracts.
