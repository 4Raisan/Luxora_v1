<p align="center">
  <img src="frontend/public/luxora-logo.png" alt="Luxora" width="160">
</p>

<h1 align="center">Luxora</h1>

<p align="center">
  A full-stack home concierge platform for customers, service providers, and administrators.
</p>

<p align="center">
  <a href="https://github.com/4Raisan/Luxora_v1/actions/workflows/ci.yml"><img src="https://github.com/4Raisan/Luxora_v1/actions/workflows/ci.yml/badge.svg?branch=main" alt="Luxora CI"></a>
  <a href="https://github.com/4Raisan/Luxora_v1/actions/workflows/knowledge-graph-pages.yml"><img src="https://github.com/4Raisan/Luxora_v1/actions/workflows/knowledge-graph-pages.yml/badge.svg?branch=main" alt="Knowledge Graph"></a>
</p>

<p align="center">
  <a href="https://luxora.bond">Website</a> ·
  <a href="https://4raisan.github.io/Luxora_v1/">Knowledge Graph</a> ·
  <a href="https://4raisan.github.io/Luxora_v1/architecture/">Architecture</a> ·
  <a href="docs/api/API-DOCUMENTATION.md">API documentation</a>
</p>

## Overview

Luxora is a Sri Lankan home-concierge MVP for **Auto Care, Garden Care, and Pet Care**. It coordinates customer bookings, provider fulfilment, payments, promotions, notifications, reviews, complaints, and administration. The Express backend is the authority for authentication, role and KYC checks, prices, credits, booking state, provider earnings, and payment state. There are no customer cash refunds in V1; eligible cancellations restore service coins only.

| Role | Main capabilities |
| --- | --- |
| Customer | Manage a profile, buy a subscription, create bookings, pay, review services, and open complaints |
| Provider | Complete KYC, manage availability and bank details, fulfil assigned work, and track earnings |
| Admin | Manage users, services, plans, promotions, bookings, KYC, complaints, payouts, and platform reporting |

There is no separate Super Admin role; Admin is the platform-administration role.

## MVP demo flow

The clearest end-to-end demo is: customer signs up or signs in, purchases a package in demo-payment mode, creates a booking, and follows its status. An approved provider then records before evidence, starts and completes the work with the required PINs and after evidence. Admin can oversee KYC, bookings, plans, payouts, promotions, and reports.

The application demonstrates the agreed MVP scope. External production services such as live payment-gateway settlement, verified email-domain delivery, durable S3 storage, Google OAuth, and managed runtime logging still need authorised live-environment validation; see the [roadmap](docs/planning/roadmap.md).

## Architecture

```text
React 19 + Vite frontend (Vercel Global Edge)
        │  HTTPS / JSON / SSE
        ▼
Express 5 API Gateway (Northflank Container) ── Prisma ORM ── Neon PostgreSQL
    │
    ├── Server-Sent Events (/api/realtime) ── Realtime Booking & Alert Sync
    ├── PayHere / NOWPayments ─────────────── Tri-Gateway Payment Settlement
    ├── S3-compatible object storage ──────── KYC Proof & Booking Evidence
    └── Resend REST API ───────────────────── Transactional Notifications
```

## Local development

Use Node.js 22 LTS and a PostgreSQL database. Copy the example environment files before starting:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run prisma:generate
npm --prefix backend run db:migrate
npm --prefix backend run seed
npm run dev:all
```

Set `DATABASE_URL` in `backend/.env` to your PostgreSQL database before running migrations. On Windows, `start.bat` provides the guided local startup path.

Local services:

- Frontend: `http://localhost:3000`
- API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`
- API reference: `http://localhost:5000/api/docs`
- Knowledge Graph: `http://localhost:3333/` (`npm run graph:serve`)
- Architecture Explorer: `http://localhost:3333/architecture/` (`npm run architecture:dev`)

Docker Compose requires its PostgreSQL and application secrets to be configured. Production additionally requires a dedicated bank-encryption key and S3-compatible storage credentials; see the [backend guide](backend/README.md).

## Quality checks

```powershell
npm test
npm run test:ci-plan
npm run lint
npm run build
npm run graph:verify
npm run architecture:verify
```

The standard tests, lint, and build protect application behaviour. GitHub uses deterministic, fail-closed [selective CI rules](docs/CI.md) so ordinary commits run only their relevant checks while unknown and high-risk changes receive broader coverage. `graph:verify` regenerates and validates both the codebase knowledge graph and the live architecture graph; review and commit any generated graph changes with the related code change.

## Deployment

- Frontend: Vercel Global Edge (`https://luxora.bond`)
- Backend: Northflank Container Cluster (`https://site--luxora-backend--6kb9tg67ytl4.code.run`)
- Database: Neon Serverless PostgreSQL 15 (pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations)
- Knowledge Graph: GitHub Pages (`https://4raisan.github.io/Luxora_v1/`)
- Architecture Explorer: GitHub Pages (`https://4raisan.github.io/Luxora_v1/architecture/`)

Keep production URLs and credentials in the deployment platform. Never commit `.env` files, payment secrets, JWT secrets, bank-encryption keys, database credentials, or cloud-storage credentials.

## Project map

```text
frontend/             React application
backend/              Express API, Prisma schema, services, and tests
docs/                 API and supporting documentation
Knowladge-Graph/      Codebase graph, architecture references, and agent playbooks
.github/workflows/    CI, deployment checks, and Knowledge Graph publication
```

- [Backend guide](backend/README.md)
- [Frontend guide](frontend/README.md)
- [Knowledge Graph guide](Knowladge-Graph/README.md)
- [API documentation](docs/api/API-DOCUMENTATION.md)
- [CI and test-selection guide](docs/CI.md)

## Project documents

| Resource | Purpose |
| --- | --- |
| [Requirements and acceptance rules](docs/planning/requirements.md) | Current functional and non-functional behaviour |
| [Roadmap](docs/planning/roadmap.md) | Current baseline, future work, and external validation still required |
| [Live System Architecture Explorer](https://4raisan.github.io/Luxora_v1/architecture/) | Interactive live multi-view architecture graph with component drilldowns |
| [Technical Architecture Document](docs/architecture/TECHNICAL_ARCHITECTURE_AND_SYSTEM_DOCUMENTATION.md) | Full technical systems engineering documentation |
| [System architecture diagram](docs/architecture/system-architecture.png) | System and deployment overview |
| [Database ERD](docs/DATABASE-ERD.md) | Entity relationships derived from the Prisma model |
| [API documentation](docs/api/API-DOCUMENTATION.md) | Active API routes and contracts |
| [Knowledge Graph](Knowladge-Graph/README.md) | Codebase navigation, architecture references, and agent workflow |

## Knowledge Graph and coding-agent workflow

The repository includes a machine-readable codebase graph and an interactive explorer. Coding agents begin with [`AGENTS.md`](AGENTS.md), inspect the graph and its upstream/downstream relationships, then follow the architecture, debugging, product-rule, and flow references before changing connected code.

The full workflow and every agent-facing source are documented in the [Knowledge Graph README](Knowladge-Graph/README.md). Changes to routes, services, Prisma models, or frontend API calls must finish with `npm run graph:verify` so those links remain trustworthy.
