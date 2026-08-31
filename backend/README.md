# Luxora API

The Express/Prisma API owns authorization, payments, entitlements, booking state, provider operations, private uploads, notifications, and external integrations.

## Commands

```powershell
npm run prisma:generate
npm run db:migrate
npm run db:migrate:dev -- --name describe_change
npm run seed
npm run dev
npm run test
```

`npm run test` uses the isolated local `luxora_test` schema. `npm start` generates Prisma Client, applies committed migrations, and starts the server. Do not seed production or use `db:push` as a deployment mechanism.

## Environment

| Area | Variables |
| --- | --- |
| Core | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `CORS_ORIGIN` |
| Mode | `PAYMENT_MODE=demo` or `payhere` |
| PayHere | `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, base/return/cancel/notify URLs |
| NOWPayments | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_BASE_URL` |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Google | `GOOGLE_CLIENT_ID` |
| Storage | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PREFIX` |
| Payouts | `PAYOUT_SCHEDULER_ENABLED` |

PayHere callback URLs must be public HTTPS URLs. NOWPayments IPNs require a valid HMAC-SHA512 signature, exact invoice price/currency, matching order/payment identity, and an authoritative live status of `finished`. Phone numbers are profile contact data; SMS, WhatsApp, and phone OTP verification are not implemented.

### PayHere Sandbox Testing Cards (Non-production testing reference only)
- **Visa**: `4916217501611292`
- **MasterCard**: `5307732125531191`
- **AMEX**: `346781005510225`
- **Expiry**: Any future date (e.g. `12/28`)
- **CVV**: Any 3 digits (e.g. `123`)
*Note: These are official PayHere sandbox testing instruments and must never be treated as production credentials.*

## Uploads and secrets

KYC and service-evidence uploads are private, authenticated, magic-byte validated, limited to 5 MB per file, and served with `nosniff` plus sandboxing headers. S3-compatible storage is required for durable hosted uploads; local `private-uploads/` is a development fallback.

Never expose database, JWT, payment, Resend, Google, or storage credentials to the frontend. Production refuses to start without `JWT_SECRET`.

## Source map

| Path | Purpose |
| --- | --- |
| `src/index.js` | App setup, route mounts, health, centralized errors |
| `src/middleware/` | JWT/database role authority, validation, rate limits |
| `src/routes/` | HTTP contracts and orchestration |
| `src/services/` | Scheduling, entitlements, integrations, storage, payouts |
| `prisma/schema.prisma` | Database source of truth |
| `prisma/migrations/` | Deployable schema history |
