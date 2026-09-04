# Luxora database design

`backend/prisma/schema.prisma` is canonical. PostgreSQL schema changes ship only through `backend/prisma/migrations/`; runtime startup does not perform DDL.

## Model groups

| Group | Models and invariants |
| --- | --- |
| Identity | `User` has unique email, role, active state, and `tokenVersion`; optional one-to-one `Provider`; reset tokens are hashed, expiring, and single-use |
| KYC/storage | `KycDocument` belongs to Provider; `ServicePhoto` belongs to Booking; database rows hold private object keys, not public URLs |
| Catalogue | `Category`; `Service` with Decimal price/provider earning; `SubscriptionPlan`; unique plan/category `SubscriptionEntitlement` |
| Purchase | `Payment` has unique gateway order/idempotency keys and Decimal expected/captured amounts with currency; `UserSubscription` is linked only after verified settlement |
| Fulfilment | `Booking` links customer/service/subscription/optional provider; enum state, hashed/encrypted PIN material, evidence, Decimal price/earning |
| Operations | Notifications, support, complaints, reviews, refunds, bank accounts, monthly payout ledger, and admin audit log |

Money columns use `Decimal`, not Float. Admin revenue uses each completed payment's verified `expectedAmount` in LKR; `capturedAmount` remains in its recorded `capturedCurrency` and must never be summed across currencies.

## Integrity and concurrency

- Booking creation and provider selection run together at Serializable isolation with retry.
- Booking lifecycle/PIN updates use a per-booking PostgreSQL advisory transaction lock.
- Completion credits provider earnings once.
- Payment activation is Serializable and idempotent.
- Failed queued payouts restore provider earnings exactly once.
- Foreign keys use explicit Cascade, Restrict, or SetNull behavior from the Prisma schema.

## Migration workflow

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run db:migrate:dev -- --name describe_change
npm --prefix backend run db:migrate
```

`npm test` proves the complete migration chain against an isolated `luxora_test` schema. `db:push` is not a deployment workflow. Never rewrite applied migrations or run tests against managed/production databases.

## Production topology (Neon PostgreSQL)

Production runs on managed Neon Serverless PostgreSQL 15. The connection configuration utilizes a dual-URL model:

- **Runtime Queries (`DATABASE_URL`)**: Uses Neon's connection pooler endpoint for high concurrency across containerized instances on Northflank.
- **Prisma Migrations (`DIRECT_URL`)**: Uses Neon's direct unpooled connection endpoint for transactional DDL execution during `prisma migrate deploy`.

```env
DATABASE_URL="postgresql://<user>:<pass>@<endpoint>-pooler.neon.tech/luxoradb?sslmode=require"
DIRECT_URL="postgresql://<user>:<pass>@<endpoint>.neon.tech/luxoradb?sslmode=require"
```

