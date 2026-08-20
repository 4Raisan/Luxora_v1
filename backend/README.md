# Luxora backend
Node.js + Express 5, Prisma 6.19, PostgreSQL. The backend owns authentication, authorization, validation, database writes, payment state, entitlement/refund rules, scheduling, notifications, uploads, and integration callbacks.
## Commands
    npm install
    Copy-Item .env.example .env
    npm run prisma:generate
    npm run db:push
    npm run seed
    npm run dev
The API listens on PORT (normally 5000). Verify GET /api/health, then /api/docs or /api/openapi.json. Production runs prisma generate, prisma migrate deploy, and node src/index.js; do not auto-seed production.
## Configuration
Required: DATABASE_URL, JWT_SECRET, PORT, FRONTEND_URL, CORS_ORIGIN. Optional: PayHere, PayPal, Resend, Twilio. Hosted DATABASE_URL should include connection_limit=5&pool_timeout=10. Never log/commit the URL. CORS_ORIGIN rejects origins outside its explicit allow-list.
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
For schema changes: edit Prisma, create/review a named migration, generate, test PostgreSQL, deploy with prisma migrate deploy. Use db:push only for disposable local synchronization; never rewrite applied migrations. For incidents compare deployed commit, effective variables, health, and runtime Prisma errors such as P2037.
