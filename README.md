# Luxora

Luxora is a React/Vite, Express, Prisma, and PostgreSQL home-concierge platform for customers, KYC-approved providers, and admins.

## Architecture

```text
React SPA -> frontend/src/services/api.js -> Express /api -> middleware/routes/services -> Prisma -> PostgreSQL
                                                            -> Resend / PayHere / NOWPayments
                                                            -> private S3-compatible storage
```

The backend is authoritative for roles, ownership, entitlements, booking state, Service PINs, payment settlement, refunds, earnings, and payouts. There is no Super Admin role.

## Local setup

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
docker compose up -d postgres
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run prisma:generate
npm --prefix backend run db:migrate
npm --prefix backend run seed
npm run dev:all
```

Set a non-placeholder `JWT_SECRET` in the host environment before starting the full Docker Compose stack. `db:push` is reserved for disposable local experiments; normal development and deployment use committed migrations.

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| API health | `http://localhost:5000/api/health` |
| Swagger UI | `http://localhost:5000/api/docs` |

## Quality gates

```powershell
npm test
npm run lint
npm run build
npm run graph
```

`npm test` resets only the dedicated `luxora_test` PostgreSQL schema, applies the complete migration chain, seeds it, disables outbound Resend delivery, and runs the API/unit suites serially. It refuses non-local database hosts.

## Live Knowledge Graph

The source-derived Knowledge Graph maps Luxora frontend pages/components, API routes, middleware, services, Prisma models/enums, and their evidenced relationships. Its live explorer is available at [https://4raisan.github.io/Luxora_v1/](https://4raisan.github.io/Luxora_v1/).

Every push to `main` and a manual **Knowledge Graph Pages** workflow dispatch regenerate, validate, and deploy only `Knowladge-Graph/` as a GitHub Pages artifact. It does not deploy the Luxora application. The graph generator is deterministic and the workflow reruns it to verify identical JSON and explorer output.

To regenerate and validate locally:

```powershell
npm run graph:verify
```

The validator checks JSON integrity, stable unique node/edge IDs, source paths, referenced nodes, deterministic metadata, Pages-safe explorer loading, removed OTP/messaging nodes, and accidental secret-like values. Generated graph data contains repository-relative evidence paths only; it never reads or publishes environment values, credentials, customer records, or private-storage URLs.

## Roles and core flows

| Role | Main capabilities |
| --- | --- |
| Customer | Packages, entitlements, bookings, Service PIN retrieval, reviews, complaints, support, refunds |
| Provider | KYC upload, assigned work, before/after evidence, PIN-gated fulfilment, earnings, bank accounts |
| Admin | Users, KYC, plans, bookings, scheduling, support, refunds, promotions, reports, payout ledger, audit log |

Payments use demo mode for local/test work and PayHere or NOWPayments for hosted checkout. Only verified backend callbacks can activate subscriptions. NOWPayments grants benefits only for `finished` after a matching authoritative status query. Receipt delivery failure does not roll back a completed payment and can be retried.

Uploads are authenticated and ownership-checked, validated by magic bytes, and stored privately. Configure the `S3_*` variables on ephemeral or multi-instance hosts; local disk is a development fallback only.

## Project map

| Path | Purpose |
| --- | --- |
| `frontend/` | React UI and server-state handling |
| `backend/src/` | API, authorization, domain rules, and integrations |
| `backend/prisma/` | Canonical schema, migrations, seed data |
| `docs/` | API, database, integration, requirements, and roadmap documentation |
| `Knowladge-Graph/` | Generated dependency graph and agent navigation guides |

Read `Knowladge-Graph/CONFIRMED_PRODUCT_RULES.md` before changing behavior. Regenerate the graph after route, schema, service, or frontend API-call changes.
