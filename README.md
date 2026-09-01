<p align="center">
  <img src="frontend/public/luxora-logo.png" alt="Luxora" width="160">
</p>

<h1 align="center">Luxora</h1>

<p align="center">
  A full-stack home concierge platform for customers, service providers, and administrators.
</p>

<p align="center">
  <a href="https://github.com/4Raisan/Luxora_v1/actions/workflows/ci.yml"><img src="https://github.com/4Raisan/Luxora_v1/actions/workflows/ci.yml/badge.svg?branch=main" alt="Luxora CI"></a>
  <a href="https://github.com/4Raisan/Luxora_v1/actions/workflows/knowledge-graph-pages.yml"><img src="https://github.com/4Raisan/Luxora_v1/actions/workflows/knowledge-graph-pages.yml/badge.svg?branch=main" alt="Knowledge Graph Pages"></a>
</p>

<p align="center">
  <a href="https://luxora.bond">Website</a> ·
  <a href="https://4raisan.github.io/Luxora_v1/">Knowledge Graph</a> ·
  <a href="docs/api/API-DOCUMENTATION.md">API documentation</a>
</p>

## Overview

Luxora coordinates customer bookings, provider fulfilment, payments, promotions, notifications, reviews, complaints, refunds, and administration. The Express backend is the authority for authentication, role and KYC checks, prices, credits, booking state, provider earnings, and payment state.

| Role | Main capabilities |
| --- | --- |
| Customer | Manage a profile, buy a subscription, create bookings, pay, review services, and open complaints |
| Provider | Complete KYC, manage availability and bank details, fulfil assigned work, and track earnings |
| Admin | Manage users, services, plans, promotions, bookings, KYC, complaints, refunds, and platform reporting |

There is no separate Super Admin role; Admin is the platform-administration role.

## Architecture

```text
React + Vite frontend
        │  HTTPS / JSON
        ▼
Express API ── Prisma ORM ── PostgreSQL
    │
    ├── PayHere / NOWPayments
    ├── S3-compatible object storage
    └── Email and notification integrations
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

Docker Compose requires its PostgreSQL and application secrets to be configured. Production additionally requires a dedicated bank-encryption key and S3-compatible storage credentials; see the [backend guide](backend/README.md).

## Quality checks

```powershell
npm test
npm run test:ci-plan
npm run lint
npm run build
npm run graph:verify
```

The standard tests, lint, and build protect application behaviour. GitHub uses deterministic, fail-closed [selective CI rules](docs/CI.md) so ordinary commits run only their relevant checks while unknown and high-risk changes receive broader coverage. `graph:verify` regenerates and validates the codebase knowledge graph; review and commit any generated graph changes with the related code change.

## Deployment

- Frontend: Vercel
- Backend and PostgreSQL: Northflank or Docker-compatible infrastructure
- Knowledge Graph explorer: GitHub Pages

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

## Knowledge Graph and coding-agent workflow

The repository includes a machine-readable codebase graph and an interactive explorer. Coding agents begin with [`AGENTS.md`](AGENTS.md), inspect the graph and its upstream/downstream relationships, then follow the architecture, debugging, product-rule, and flow references before changing connected code.

The full workflow and every agent-facing source are documented in the [Knowledge Graph README](Knowladge-Graph/README.md). Changes to routes, services, Prisma models, or frontend API calls must finish with `npm run graph:verify` so those links remain trustworthy.
