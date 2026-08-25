# Luxora API

Express + Prisma + PostgreSQL. The API owns authorization, payments, coins, booking state, provider operations, and integrations.

## Run locally

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run db:push
npm run seed
npm run dev
```

| Check | URL |
| --- | --- |
| Health | `http://localhost:5000/api/health` |
| Docs | `http://localhost:5000/api/docs` |
| OpenAPI | `http://localhost:5000/api/openapi.json` |

## Commands

```powershell
npm run prisma:generate
npm run db:push             # Local disposable database only
npm run seed                # Local demo accounts/data
npm start                   # Production: generate + migrate deploy + server
node --test                 # Run from backend/
```

## Required environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | API port, normally `5000` |
| `FRONTEND_URL` | Public frontend origin |
| `CORS_ORIGIN` | Comma-separated allowed origins |

## Optional integrations

| Feature | Variables |
| --- | --- |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Meta WhatsApp | Phone Number ID, access token, template, template language |
| PayHere | Merchant ID, secret, base URL, return URL, cancel URL, notify URL |
| Google sign-in | `GOOGLE_CLIENT_ID` |

## PayHere readiness

`PAYMENT_MODE=demo` is safe for local work.

For `PAYMENT_MODE=payhere`, all callback URLs must be public HTTPS URLs:

```text
PAYHERE_RETURN_URL=https://app.example.com/customer-dashboard?payment=payhere
PAYHERE_CANCEL_URL=https://app.example.com/customer-dashboard?payment=cancelled
PAYHERE_NOTIFY_URL=https://api.example.com/api/payments/payhere/webhook
```

The API refuses PayHere checkout when these values are missing or placeholders.

## Source map

| Path | Purpose |
| --- | --- |
| `src/index.js` | App setup, mounts, health, errors |
| `src/routes/` | HTTP validation and orchestration |
| `src/services/` | Payments, coins, scheduling, notifications |
| `src/middleware/` | JWT, roles, KYC, phone verification, validation |
| `prisma/schema.prisma` | Database source of truth |

## Production rules

- Run `prisma migrate deploy`.
- Do not seed production.
- Do not commit `.env` files or log credentials/PINs.
- Use an explicit CORS allow-list.
- Use `db:push` only for disposable local databases.
