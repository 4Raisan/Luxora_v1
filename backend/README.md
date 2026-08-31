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
| Core | `DATABASE_URL`, `JWT_SECRET`, `BANK_ENCRYPTION_KEY`, `TRUST_PROXY`, `PORT`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `CORS_ORIGIN`, `REDIS_URL` |
| Mode | `PAYMENT_MODE=demo` or `payhere` |
| PayHere | `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, base/return/cancel/notify URLs |
| NOWPayments | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_BASE_URL` |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Google | `GOOGLE_CLIENT_ID` |
| Storage | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PREFIX` |
| Payouts | `PAYOUT_SCHEDULER_ENABLED` |

PayHere callback URLs must be public HTTPS URLs. NOWPayments IPNs require a valid HMAC-SHA512 signature, exact invoice price/currency, matching order/payment identity, and an authoritative live status of `finished`. Phone numbers are profile contact data; SMS, WhatsApp, and phone OTP verification are not implemented.

### Banking Key Setup & Key Rotation
- `BANK_ENCRYPTION_KEY` is a required 32-byte secret (or high-entropy passphrase) in production.
- Bank account numbers are encrypted at rest with AES-256-GCM (`enc:v1:<iv>:<tag>:<ciphertext>`).
- To rotate the banking encryption key:
  1. Set `OLD_BANK_KEY` and `NEW_BANK_KEY` in your maintenance script environment.
  2. Use `reencryptAccountNumber(record.accountNumber, OLD_BANK_KEY, NEW_BANK_KEY)` across all `provider_bank_accounts` rows within a database transaction.
  3. Deploy the application with `BANK_ENCRYPTION_KEY=NEW_BANK_KEY`.
- Legacy unencrypted records can be migrated with `node prisma/migrate-bank-accounts.js`, which verifies decryption matches original plaintext before updating.

### Rate Limiting & Proxy Configuration
- `REDIS_URL`: If configured, rate limiting runs as a distributed token bucket across multiple backend replicas. When omitted in production, it operates in single-instance bounded in-memory mode.
- `TRUST_PROXY`: In production, reverse proxy trust is disabled by default. Set `TRUST_PROXY=1` (or specify an exact hop count / subnet like `loopback, 10.0.0.0/8`) matching your ingress infrastructure.

### Production CORS
- `CORS_ORIGIN` / `FRONTEND_URL`: In production, only explicitly listed HTTPS origins are accepted. Wildcards (`*`) with credentials are strictly forbidden. Localhost origins are active only in development and test environments.

### PayHere Sandbox Testing Cards (Non-production testing reference only)
- **Visa**: `4916217501611292`
- **MasterCard**: `5307732125531191`
- **AMEX**: `346781005510225`
- **Expiry**: Any future date (e.g. `12/28`)
- **CVV**: Any 3 digits (e.g. `123`)
*Note: These are official PayHere sandbox testing instruments and must never be treated as production credentials.*

## Uploads and secrets

KYC and service-evidence uploads are private, authenticated, magic-byte validated, limited to 5 MB per file, and served with `nosniff` plus sandboxing headers. S3-compatible storage is required for durable hosted uploads; local `private-uploads/` is a development fallback.

Never expose database, JWT, payment, Resend, Google, or storage credentials to the frontend. Production refuses to start without `JWT_SECRET`, `BANK_ENCRYPTION_KEY`, and S3 credentials.

## Source map

| Path | Purpose |
| --- | --- |
| `src/index.js` | App setup, route mounts, health, centralized errors |
| `src/middleware/` | JWT/database role authority, validation, rate limits |
| `src/routes/` | HTTP contracts and orchestration |
| `src/services/` | Scheduling, entitlements, integrations, storage, payouts |
| `prisma/schema.prisma` | Database source of truth |
| `prisma/migrations/` | Deployable schema history |
