# Luxora backend
Node.js + Express 5, Prisma 6.19, PostgreSQL. The backend owns authentication, authorization, validation, database writes, payment state, entitlement/refund rules, scheduling, notifications, uploads, and integration callbacks.
## Commands
Local development needs Docker Desktop running (the only local database provider):
    docker compose up -d postgres   (from the repo root)
    npm install
    Copy-Item .env.example .env
    npm run prisma:generate
    npm run db:migrate
    npm run seed
    npm run dev
The API listens on PORT (normally 5000). Verify GET /api/health, then /api/docs or /api/openapi.json. Production runs prisma generate, prisma migrate deploy, and node src/index.js; do not auto-seed production.
## Configuration
Required: DATABASE_URL, JWT_SECRET, PORT, FRONTEND_URL, CORS_ORIGIN. Optional: PayHere, PayPal, Resend (email), EasySendSMS (OTP), Google Sign-In (GOOGLE_CLIENT_ID). Hosted DATABASE_URL should include connection_limit=5&pool_timeout=10. Never log/commit the URL. CORS_ORIGIN rejects origins outside its explicit allow-list. Email is Resend-only: RESEND_API_KEY plus RESEND_FROM_EMAIL; onboarding@resend.dev delivers only to the Resend account owner, so production needs a verified sender domain. GOOGLE_CLIENT_ID must equal frontend VITE_GOOGLE_CLIENT_ID; unset it returns 503 on /auth/google.
## Source layout
- src/index.js: middleware, CORS, body limits, mounts, health, errors, startup.
- src/config: environment parsing and singleton Prisma client.
- src/middleware: JWT, role/Super Admin, validation.
- src/routes: auth, bookings, customer, provider, admin, services, refunds, integrations, support, uploads.
- src/services: entitlements, integrations, payment contracts, scheduling, notifications.
- prisma/schema.prisma: canonical schema; prisma/migrations: history; prisma/seed.js: local/demo setup.
## Security
Passwords are bcrypt hashes and JWTs use JWT_SECRET. Customer reads/writes are user-scoped; provider actions verify assignment; Admin and Super Admin differ. Refunds are unique per subscription and require unused entitlements. Demo success uses the normal pipeline; PayHere is not refunded without gateway confirmation. Validate amounts, states, PIN attempts/locks, and idempotency. Never return hashes, PIN secrets, private paths, or credentials.
## Database/deploy workflow
For schema changes: edit Prisma, create/review a named migration (`npm run db:migrate:dev`), generate, test against the local Docker PostgreSQL, deploy with `npm run db:migrate` (prisma migrate deploy). The migration history is the single source of truth — never rewrite applied migrations and never use `prisma db push` against a database you want to keep. For incidents compare deployed commit, effective variables, health, and runtime Prisma errors such as P2037.
