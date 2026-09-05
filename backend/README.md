# Luxora API

The Luxora backend is an Express and Prisma API backed by PostgreSQL. It owns authentication, authorization, bookings, subscriptions, payments, provider fulfilment, earnings, complaints, payout review, notifications, and administrative operations. There are no customer cash refunds in V1; eligible cancellations restore service coins only.

## Common commands

```powershell
npm ci
npm run prisma:generate
npm run db:migrate
npm run seed
npm run dev
npm test
```

Run these commands from `backend/`, or prefix them with `npm --prefix backend` from the repository root.

For faster targeted verification, use `test:smoke`, `test:payments`, `test:bookings`, or `test:security`. The [CI guide](../docs/CI.md) explains how commits are mapped to these suites.

Production starts with `npm start`. The startup sequence applies committed Prisma migrations, checks the bank-encryption configuration, and then starts the API. Do not use `prisma db push` or run the seed command against production.

Health endpoint: `GET /api/health`

## Environment configuration

Copy `.env.example` to `.env` for local development. Keep real values in the hosting platform, never in Git.

| Area | Variables |
| --- | --- |
| Core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL` |
| Browser and proxy | `CORS_ORIGIN`, `TRUST_PROXY` |
| Payment mode | `PAYMENT_MODE` |
| Bank data | `BANK_ENCRYPTION_KEY` |
| Object storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SESSION_TOKEN`, `S3_PREFIX` |
| Redis (optional) | `REDIS_URL` (optional; for future multi-instance distributed rate limiting) |
| PayHere | `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_BASE_URL`, `PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL` |
| NOWPayments | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_BASE_URL` |
| Email and sign-in | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GOOGLE_CLIENT_ID` |
| Payout worker | `PAYOUT_SCHEDULER_ENABLED` |
| Local/test seed fixtures | `CUSTOMER_PASSWORD`, `PROVIDER_PASSWORD`, `ADMIN_PASSWORD` |

Production requirements:

- Use a long, unique `JWT_SECRET`.
- Use a separate `BANK_ENCRYPTION_KEY`; never reuse the JWT secret.
- Configure S3-compatible storage. Local disk uploads are development-only.
- Use explicit public origins in `CORS_ORIGIN` or `FRONTEND_URL`, and configure `TRUST_PROXY` for the real ingress topology.
- `npm run seed` never creates demo accounts when `NODE_ENV=production`; production accounts must be created through the application or approved operations workflow.
- The current single-instance production setup uses bounded in-memory rate limiting and SSE state with zero external broker dependencies. `REDIS_URL` is optional and only required if scaling to multi-instance distributed rate limiting in the future.

## Database and bank-account migration

Prisma migration files are the source of truth for production schema changes. Before applying a bank-account data migration, take a database backup and run the dry-run preflight:

```powershell
npm run db:migrate
npm run preflight:bank-accounts
npm run migrate:bank-accounts
npm run preflight:bank-accounts
```

The schema migration normalizes duplicate selected accounts before creating the related unique index. The follow-up data migration is idempotent: it encrypts legacy plaintext account numbers, populates their mask and lookup hash, checks decryptability, and leaves one selected account per provider. Review its summary and stop deployment if it reports errors.

Encrypted values use the versioned format `enc:v1:<base64(iv + ciphertext + authTag)>`. The application derives the 32-byte AES key by hashing `BANK_ENCRYPTION_KEY`, so production should use a long, random, dedicated secret.

Key rotation requires a controlled maintenance operation: decrypt each value with the old key, encrypt it with the new key, verify every migrated row, and switch the deployment secret only after the transaction succeeds. Keep a recoverable backup until the rotated data has been verified.

## Payments

PayHere, NOWPayments, and Demo run as independent payment paths. Set `DEMO_PAYMENTS_ENABLED=true` for the local deterministic checkout; legacy `PAYMENT_MODE=demo` remains a supported fallback. Enabling Demo does not disable configured PayHere or NOWPayments. Payment state and entitlements change only after the backend validates the callback signature, payment identity, expected amount and currency, and provider status.

For PayHere sandbox checkout, use PayHere’s documented test cards only. Never use a real card in a sandbox environment.

Subscription records preserve their contractual LKR price snapshot separately from the amount and currency captured by a payment gateway. Renewals and entitlement decisions must use the stored subscription terms rather than a plan’s current editable price.

## Uploads and security

Production uploads use private S3-compatible objects and short-lived signed read URLs. File validation checks authenticated ownership, MIME type, extension, size, and file signature. Sensitive provider documents and bank details must never be returned through public static paths.

The API also enforces JWT authentication, role and KYC gates, request validation, explicit CORS origins, and rate limits. The current single-instance deployment uses self-contained, in-memory rate limiting and SSE connection tracking. When scaling to multiple API instances in the future, configure `REDIS_URL` so the limiter can coordinate across instances via a shared Redis store, and verify that the application is reachable only through the trusted proxy path.

## Source map

```text
src/index.js          Application setup, middleware, and route mounts
src/routes/           HTTP validation and orchestration
src/middleware/       Authentication, authorization, validation, and limiting
src/services/         Business rules and third-party integrations
prisma/schema.prisma  Database models, relations, and enums
prisma/migrations/    Production schema history
tests/                Backend automated tests
```

For cross-layer dependencies and blast-radius checks, follow the repository [agent entry point](../AGENTS.md) and [Knowledge Graph guide](../Knowladge-Graph/README.md).
