# Luxora

Premium home-concierge platform for customers, providers, and admins.

## Stack

```text
React/Vite -> Express/Prisma -> PostgreSQL
     :3000        :5000
```

## Start locally

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run prisma:generate
npm --prefix backend run db:push
npm --prefix backend run seed
npm run dev:all
```

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| API health | `http://localhost:5000/api/health` |
| API docs | `http://localhost:5000/api/docs` |

## Main commands

```powershell
npm run build
npm run lint
npm run graph
node --test # Run inside backend/
```

## Roles

| Role | Main work |
| --- | --- |
| Customer | Packages, coins, bookings, reviews, support |
| Provider | KYC, WhatsApp verification, assigned work, evidence, earnings |
| Admin | Plans, users, KYC, bookings, support, refunds, payouts |

## Payment modes

| Mode | Use |
| --- | --- |
| `demo` | Local/test checkout. No real charge. |
| `payhere` | Sandbox or live checkout. Requires valid public HTTPS callback URLs. |

## Before production

- Set real `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN`.
- Configure Meta WhatsApp Cloud API credentials and an approved verification template.
- Configure Resend and `no-reply@luxora.bond`.
- Set PayHere return, cancel, and webhook URLs to public HTTPS endpoints.
- Run `prisma migrate deploy`; do not use `db:push`.

## Project map

| Path | Purpose |
| --- | --- |
| `frontend/` | React UI |
| `backend/` | API, rules, integrations, Prisma |
| `backend/prisma/` | Schema, migrations, local seed data |
| `Knowladge-Graph/` | Route/data-flow map and debugging guides |

See `Knowladge-Graph/CONFIRMED_PRODUCT_RULES.md` before changing product behavior.
