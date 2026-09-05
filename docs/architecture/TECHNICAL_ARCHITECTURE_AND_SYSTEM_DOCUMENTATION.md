# LUXORA (v1.0.0-PROD)
## TECHNICAL ARCHITECTURE & SYSTEM SPECIFICATION
### Comprehensive Technical Reference, Systems Engineering Audit, and Architectural Documentation

---

**System Authority**: Engineering Team & System Architects  
**Repository Source**: `Luxora_v1` (`4Raisan/Luxora_v1`)  
**Publication Target**: University Technical Review, Software Architecture Viva, Engineering Handover & Production Operations  
**Date of Technical Audit**: September 2026  
**System Operational State**: Production-Hardened MVP (Sri Lanka Market Baseline)  
**Primary URLs**:
- **Production Web Application**: `https://luxora.bond` (Vercel Global Edge)
- **Production API Gateway**: `https://site--luxora-backend--6kb9tg67ytl4.code.run` (Northflank Container Cluster)
- **Knowledge Graph Explorer**: `https://4raisan.github.io/Luxora_v1/` (GitHub Pages Codebase Navigator)
- **Live Architecture Explorer**: `https://4raisan.github.io/Luxora_v1/architecture/` (GitHub Pages 12-View Interactive System Topology)

---

## TABLE OF CONTENTS

1. [Executive & Technology Summary](#executive--technology-summary)
2. [Section 1: Deep Repository Audit & Source-of-Truth Foundations](#section-1-deep-repository-audit--source-of-truth-foundations)
3. [Section 2: Actual Production Topology & Dual-Pipeline Architecture](#section-2-actual-production-topology--dual-pipeline-architecture)
4. [Section 3: Comprehensive Technology Stack Specification](#section-3-comprehensive-technology-stack-specification)
5. [Section 4: Architectural Trade-Off Analysis ("Why This Technology Instead of Others")](#section-4-architectural-trade-off-analysis-why-this-technology-instead-of-others)
6. [Section 5: Frontend Single-Page Application (SPA) Architecture](#section-5-frontend-single-page-application-spa-architecture)
7. [Section 6: Backend API Gateway & Service Architecture](#section-6-backend-api-gateway--service-architecture)
8. [Section 7: Database Architecture & Prisma Entity-Relationship Model](#section-7-database-architecture--prisma-entity-relationship-model)
9. [Section 8: Authentication, Authorization & Security Engineering](#section-8-authentication-authorization--security-engineering)
10. [Section 9: Tri-Gateway Payment Processing Engine](#section-9-tri-gateway-payment-processing-engine)
11. [Section 10: External Communications & Email Infrastructure (Resend)](#section-10-external-communications--email-infrastructure-resend)
12. [Section 11: Durable Object Storage Architecture (S3)](#section-11-durable-object-storage-architecture-s3)
13. [Section 12: Machine-Readable Codebase Knowledge Graph System](#section-12-machine-readable-codebase-knowledge-graph-system)
14. [Section 13: CI/CD Pipeline & Commit-Based Selective Evaluation](#section-13-cicd-pipeline--commit-based-selective-evaluation)
15. [Section 14: Test Database Isolation & Seeding Mechanics](#section-14-test-database-isolation--seeding-mechanics)
16. [Section 15: Protected Files Guard Enforcement Engine](#section-15-protected-files-guard-enforcement-engine)
17. [Section 16: Independent Production Deployment Pipelines](#section-16-independent-production-deployment-pipelines)
18. [Section 17: Observability, Failure Modes & Emergency Rollback Procedures](#section-17-observability-failure-modes--emergency-rollback-procedures)
19. [Section 18: End-to-End User Journeys (Technical Sequence Flows)](#section-18-end-to-end-user-journeys-technical-sequence-flows)
20. [Section 19: Architectural Decision Records (ADRs)](#section-19-architectural-decision-records-adrs)
21. [Section 20: Verified Architecture Summary & Ground-Truth Invariants](#section-20-verified-architecture-summary--ground-truth-invariants)

---



## EXECUTIVE & TECHNOLOGY SUMMARY

### Mission & Problem Domain
Luxora is an automated, on-demand home concierge and property maintenance platform specifically tailored to the urban and suburban markets of Sri Lanka. The platform formalizes, automates, and secures the delivery of three core domestic maintenance disciplines:
1. **Auto Care**: Doorstep detailing, high-pressure foam washing, interior sanitation, and paint correction.
2. **Garden Care**: Precision lawn mowing, hedge shaping, deep soil hydration, pest management, and organic fertilization.
3. **Pet Care**: Dedicated canine/feline spa bathing, grooming, walking exercise, and freshwater aquarium filtration maintenance.

Prior to Luxora, domestic service coordination in the target market suffered from significant systemic friction: fragmented informal providers, lack of identity verification, unpredictable pricing, manual cash settlements, absence of operational tracking, and high dispute rates. Luxora resolves these challenges through a **server-authoritative, tokenized subscription model** paired with an **automated scheduling and verification engine**.

### Technology Blueprint
The architecture represents a modern, cloud-native decoupled topology engineered for resilience, data consistency, and strict authorization:
- **Client Tier**: React 19 Single Page Application (SPA) driven by Vite 8, featuring localized town-district selection, token wallet visualizations, dual-PIN code revelation cards, and an interactive AI concierge widget.
- **Application Tier**: Node.js 22 LTS running Express 5.2, serving as a unified RESTful API Gateway. The backend owns all business logic: token balances, provider dispatch algorithms, KYC verification gates, bcrypt dual-PIN verification, automated timeout background workers, and encrypted payout ledgers.
- **Data Tier**: Managed PostgreSQL 15 accessed via Prisma ORM 6.19. All financial balances and provider earnings are stored using fixed 2-decimal-place Decimals to eliminate binary floating-point rounding errors. Database operations utilize row-level updates and PostgreSQL transaction advisory locks (`SELECT pg_advisory_xact_lock`) to guarantee serial consistency during concurrent bookings.
- **Security & Storage**: Provider bank accounts encrypted at rest using `AES-256-GCM` with SHA-256 lookup hashes. Uploaded documents (KYC identity proof and service before/after photographic evidence) undergo magic-byte signature sniffing before streaming to S3-compatible cloud storage.
- **Payment & Communication**: Tri-gateway payment architecture supporting PayHere (Sri Lanka LKR merchant gateway with MD5 hash verification), NOWPayments (cryptocurrency with HMAC-SHA512 IPN signatures), and a local demo mode for staging. Transactional notifications and lifecycle alerts are dispatched via Resend REST API and in-app notification queues.
- **DevOps & Verification**: Multi-stage Dockerized containerization, independent deployment pipelines across Vercel (frontend), Northflank (backend), and GitHub Pages (Knowledge Graph), secured by an 8-job GitHub Actions CI suite utilizing commit-based selective evaluation and an automated Protected Files Guard.

---



## SECTION 1: DEEP REPOSITORY AUDIT & SOURCE-OF-TRUTH FOUNDATIONS

### Audit Methodology
Every assertion, schema model, API route, and security control documented herein was derived through systematic static analysis, file inspection, and test execution against the `Luxora_v1` codebase.

```text
Repository Audit Surface:
├── frontend/src/                  # React 19 SPA (Pages, Components, Services, Chatbot)
├── backend/src/                   # Express 5 API (Routes, Middleware, Domain Services)
├── backend/prisma/                # Schema definitions, 22 versioned migrations, seed scripts
├── Knowladge-Graph/               # generate-graph.js, validate-graph.js, knowledge-graph.json
├── scripts/ci/                    # plan-checks.mjs, guard-protected-files.mjs, test runners
├── .github/workflows/             # ci.yml (8 CI jobs), knowledge-graph-pages.yml
├── Dockerfile & docker-compose    # Production alpine container, health probes
├── rollback scripts               # REVERSE_1_COMMIT.bat, REVERSE_2_COMMITS.bat
└── configuration                  # package.json, vercel.json, .env.example templates
```

### Verified Codebase Invariants
Through exhaustive file analysis, the following baseline facts are confirmed:
1. **Unified Administration**: There is **no Super Admin** role. Standard `ADMIN` users hold platform-wide administrative authority.
2. **Refund Policy**: There are **strictly no refunds in V1**. All subscription package purchases are final. Customer bookings cancelled within valid timeframes restore subscription entitlement units (service coins), never cash refunds.
3. **Server-Authoritative Balances**: Client applications have zero authority over coins, pricing, or status transitions. All entitlement consumption, deductions, and restorations are validated within Prisma database transactions.
4. **Provider Operational KYC Gate**: All operational routes in `backend/src/routes/provider.js` and `backend/src/routes/bookings.js` enforce `kycStatus === 'APPROVED'`. Providers with pending or rejected status are barred from receiving auto-assignments, entering start/completion PINs, or viewing job addresses.
5. **Dual-PIN Physical Evidence Verification**: Service execution requires mutual physical confirmation. The provider cannot start service without the customer providing the 6-digit cryptographically secure Start PIN (verified via bcrypt against `startPinHash`) along with an uploaded `BEFORE` photo. The provider cannot complete service without the 6-digit cryptographically secure Completion PIN (verified against `completionPinHash`) along with an uploaded `AFTER` photo.
6. **Automatic Dispatch & Timeout Cancellation**: The backend scheduler runs continuous checks. Bookings unassigned after 30 minutes, or unstarted after 2 hours, or uncompleted after 2 hours past scheduled end, are automatically cancelled and their token units restored via PostgreSQL advisory locks.
7. **Monthly Provider Payout Ledger**: Provider earnings accumulate per completed booking based on a fixed configured rate per service. An idempotent scheduler queues monthly payouts on the 31st for admin review and bank settlement.
8. **Provider Booking Cancellation & Atomic Redispatch**: A provider can cancel only their own assigned future booking with at least 4 hours notice before scheduled start. Cancellation is strictly blocked within 4 hours, or once `IN_PROGRESS`/`COMPLETED`. No admin cancellation request or cancellation-reason form is used. When allowed, the backend transaction automatically reassigns the booking to an eligible replacement provider, or transitions to `CANCELLED` and restores the customer's subscription entitlement coin.

---



## SECTION 2: ACTUAL PRODUCTION TOPOLOGY & DUAL-PIPELINE ARCHITECTURE

The Luxora production environment is organized into two distinct, decoupled lifecycles: the **Runtime Application Pipeline** and the **Codebase Intelligence & Delivery Pipeline**.

```text
====================================================================================================
                        LUXORA RUNTIME APPLICATION TOPOLOGY
====================================================================================================

      [ Web Browser / Mobile Client ]
                    │
                    │ HTTPS / TLS 1.3
                    ▼
       ┌────────────────────────┐
       │   Vercel Global Edge   │ ── CDN Caching, Asset Compression, Single-Page Rewrite
       │  (luxora.bond:443)     │
       └────────────────────────┘
                    │
                    │ REST / JSON (API Requests with Bearer JWT)
                    ▼
       ┌────────────────────────┐
       │  Northflank Container  │ ── Node.js 22 LTS / Express 5 API Gateway
       │  (code.run cluster)    │    (Security Headers, CORS, Rate Limiters, JWT & Role Gates)
       └────────────────────────┘
            │            │             │              │               │
            │            │             │              │               │
            ▼            ▼             ▼              ▼               ▼
     ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐ ┌─────────────┐
     │ Managed   │ │ Cloud     │ │ PayHere   │ │ NOWPayments │ │ Resend      │
     │ PostgreSQL│ │ S3 Bucket │ │ Sandbox / │ │ IPN / Crypto│ │ REST API    │
     │ 15 DB     │ │ (Private) │ │ Live API  │ │ Gateway     │ │ (Email)     │
     └───────────┘ └───────────┘ └───────────┘ └─────────────┘ └─────────────┘

====================================================================================================
                 LUXORA CODEBASE INTELLIGENCE & CI/CD PIPELINE
====================================================================================================

           [ Git Push to origin/main ]
                       │
       ┌───────────────┴───────────────┐
       │                               │
       ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ GitHub Actions: Luxora CI   │ │ GitHub Actions: KG Deploy   │
│ (.github/workflows/ci.yml)  │ │ (knowledge-graph-pages.yml) │
└─────────────────────────────┘ └─────────────────────────────┘
  ├── Protected Files Guard       ├── Extract Machine Graph
  ├── 01 Plan & Secret Scan       ├── Validate Drift
  ├── 02 Quality & Frontend       ├── Check Determinism
  ├── 02b Knowledge Graph Verify  └── Deploy GitHub Pages
  ├── 03 Backend Tests (Postgres)     (4raisan.github.io/Luxora_v1/)
  ├── 04 Dependency Audit
  ├── 05 Docker Smoke Container
  └── 06 Required Gate
```

### Decoupled Deployment Model
- **Frontend Hosting (Vercel)**: Connects directly to GitHub via webhook. Upon push, Vercel builds the SPA using `npm run build` and serves static assets globally. It handles path routing via `vercel.json` rewrites.
- **Backend Hosting (Northflank)**: Pulls the repository, executes the multi-stage `Dockerfile`, validates database health via `/api/health`, and runs `prisma migrate deploy` on startup before booting `src/index.js`.
- **Knowledge Graph (GitHub Pages)**: Runs independently via `.github/workflows/knowledge-graph-pages.yml`, generating `knowledge-graph.json` and deploying the interactive network visualizer.

---



## SECTION 3: COMPREHENSIVE TECHNOLOGY STACK SPECIFICATION

| Component Layer | Technology / Library | Version | Usage in Luxora | Production Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `19.2.8` | Core UI component tree, hooks, reactive rendering | Next-generation React core with improved concurrent rendering and performance. |
| **Frontend Tooling** | Vite | `8.2.0` | Dev server, ES module bundling, Rollup production build | Sub-second HMR during development; highly optimized Rollup production asset chunking. |
| **Client Routing** | React Router DOM | `7.18.2` | Client-side routing, protected route wrappers, auth guards | Declarative route protection (`RequireAuth`), seamless SPA navigation without server round-trips. |
| **Animation Engines** | Framer Motion & GSAP | `13.1.0` / `3.15.0` | Micro-interactions, booking card transitions, cursor glow | Hardware-accelerated transitions providing a luxury aesthetic appropriate for concierge branding. |
| **Document Export** | jsPDF | `4.2.1` | Client-side invoice and transaction receipt generation | Generates downloadable, printable PDF transaction invoices directly in browser memory without server load. |
| **Backend Runtime** | Node.js (LTS) | `22.x` | Server runtime environment, native crypto, child processes | High-performance asynchronous event loop; native ESM support (`import/export`); LTS stability. |
| **Web Application Server** | Express | `5.2.1` | REST API routing, middleware execution, error handling | Industry-standard Node.js framework; Express 5 provides native Promise-based route handlers and hardened routing. |
| **Database Engine** | PostgreSQL | `15` | Relational data persistence, ACID transactions, row locks | Strict relational integrity, support for atomic advisory transaction locks (`pg_advisory_xact_lock`), robust decimal indexing. |
| **Object-Relational Mapping** | Prisma ORM | `6.19.3` | Type-safe database queries, schema modeling, migrations | Type-safe query generation, migration engine (`prisma migrate`), elimination of SQL injection vectors. |
| **Authentication & Tokens** | JSON Web Tokens (`jsonwebtoken`) | `9.0.3` | Stateless Bearer token issuance and signature verification | Fast, stateless authorization across API routers; verified against database `tokenVersion` for instant revocation. |
| **Password Hashing** | BcryptJS | `3.0.3` | Adaptive cryptographic hashing of passwords and PIN codes | Adaptive key derivation (salt rounds) resistant to rainbow table and brute-force GPU attacks. |
| **Data Encryption** | Node.js Native Crypto | `Built-in` | `AES-256-GCM` encryption of bank accounts; SHA-256 hashing | Government-grade authenticated encryption protecting sensitive banking details at rest. |
| **Multipart Uploads** | Multer | `2.3.0` | Memory-buffered file upload processing and size limiting | Memory buffer ingestion allows magic-byte signature inspection before any file hits persistent storage. |
| **Object Storage SDK** | AWS SDK for S3 (`@aws-sdk/client-s3`) | `3.1121.0` | Multi-cloud durable object storage (AWS S3, Cloudflare R2) | Decouples binary assets from container filesystems; prevents file loss during container redeployment. |
| **Payment Gateway 1** | PayHere API | `REST / Sandbox` | Sri Lankan domestic payments (Credit/Debit Card, Mobile) | Regulated Sri Lankan payment gateway supporting LKR transactions and server-to-server IPN webhooks. |
| **Payment Gateway 2** | NOWPayments API | `v1 REST` | Global cryptocurrency payments (BTC, ETH, USDT, etc.) | Non-custodial cryptocurrency payment gateway with HMAC-SHA512 webhook signature verification. |
| **Transactional Email** | Resend API | `REST` | Transactional emails (welcome, booking, timeouts, resets) | High-deliverability modern email API with instantaneous dispatch and clean REST payload structure. |
| **Static Code Analysis** | Oxlint | `1.75.0` | High-performance Rust-based static linting | 50x faster than traditional ESLint; runs in milliseconds inside the CI quality gate. |
| **Graph Visualization** | Vis-Network | `9.1.9` | Interactive physics-based Knowledge Graph browser | Renders hierarchical, physics-simulated dependency networks directly inside the client browser. |
| **Containerization** | Docker & Docker Compose | `Multi-stage` | Production alpine runtime, isolated local Postgres test DB | Ensures parity across development, CI smoke tests, and production container clouds. |

---



## SECTION 4: ARCHITECTURAL TRADE-OFF ANALYSIS ("WHY THIS TECHNOLOGY INSTEAD OF OTHERS")

### 1. Database: PostgreSQL 15 vs. MongoDB vs. MySQL

| Evaluation Criteria | PostgreSQL 15 (Selected) | MongoDB (Alternative) | MySQL 8 (Alternative) |
| :--- | :--- | :--- | :--- |
| **Data Integrity & Consistency** | **ACID-compliant with serializable transaction isolation and advisory locks.** | Eventual consistency; multi-document transactions carry high latency. | ACID-compliant with standard InnoDB engine. |
| **Financial Decimal Handling** | **Native `Decimal(12,2)` with exact 2-decimal precision arithmetic.** | BSON Double uses IEEE-754 binary floating point; requires custom Decimal128. | Supported via `DECIMAL(12,2)`. |
| **Relational Complexity** | **Enforces strict foreign key constraints across 22 interconnected models.** | Document embedding causes severe data duplication or unbounded array growth. | Mature relational model and foreign keys. |
| **Concurrency & Row Locking** | **Native PostgreSQL advisory locks (`pg_advisory_xact_lock(id)`).** | Relies on optimistic concurrency control or manual collection-level locking. | `SELECT ... FOR UPDATE` row locking; lack of generic transaction-scoped advisory locks. |
| **Adoption Rationale for Luxora** | Luxora's core domain is financial and transactional (service coin entitlements, provider payouts, and double-PIN confirmations). A schemaless document store like MongoDB would introduce severe risks of phantom coin creation or inconsistent balances. PostgreSQL guarantees that booking creation, entitlement deduction, and provider earnings assignment occur atomically or fail completely. |

---

### 2. Frontend Platform: React 19 + Vite vs. Next.js vs. Vue/Svelte

| Evaluation Criteria | React 19 + Vite (Selected) | Next.js (Alternative) | Vue 3 / Svelte (Alternative) |
| :--- | :--- | :--- | :--- |
| **Architecture Model** | **Pure Client-Side SPA with global CDN distribution.** | Hybrid SSR/SSG requiring Node.js server runtime or Edge functions. | SPA or hybrid framework. |
| **Hosting & Operating Cost** | **Zero server cost on Vercel Edge; pure static asset distribution.** | Requires continuous server compute or Vercel serverless function invocations. | Pure static asset distribution. |
| **API Decoupling** | **Strict boundary: Frontend communicates solely via JSON API over HTTPS.** | Blurs client/server boundaries via Server Actions and Server Components. | Clean API separation. |
| **Build & Dev Performance** | **Vite sub-second hot module replacement; instant Rollup chunking.** | Next.js Turbopack / Webpack carries higher compilation overhead. | Fast Vite integration. |
| **Adoption Rationale for Luxora** | Luxora is an authenticated portal application (Customer, Provider, Admin Dashboards) behind JWT gates. Server-side rendering (SSR) provides zero SEO benefit for authenticated dashboards while increasing infrastructure complexity and attack surface. Decoupling the frontend into a pure Vite SPA served by Vercel allows independent scaling, zero compute hosting cost, and a clean REST contract. |

---

### 3. Backend Platform: Express 5 + Prisma vs. NestJS + TypeORM vs. Python (FastAPI)

| Evaluation Criteria | Express 5 + Prisma (Selected) | NestJS + TypeORM (Alternative) | FastAPI + SQLAlchemy (Alternative) |
| :--- | :--- | :--- | :--- |
| **Architecture Simplicity** | **Minimalist, transparent middleware pipeline with explicit route mounting.** | Heavy OOP abstraction with TypeScript decorators, dependency injection containers. | Asynchronous Python framework with Pydantic validation. |
| **Type Safety & Migration Engine** | **Prisma schema generates fully typed client and deterministic SQL migrations.** | TypeORM decorators frequently suffer from metadata drift and migration bugs. | Alembic migrations require manual review and Python type synchronization. |
| **Language Unification** | **Full JavaScript / Node.js unification across Frontend and Backend.** | TypeScript unification. | Split stack (JS frontend, Python backend) requiring duplicated models. |
| **Asynchronous Performance** | **Express 5 handles asynchronous routing natively with native Node.js async/await.** | Node.js async runtime with framework overhead. | High-concurrency ASGI event loop. |
| **Adoption Rationale for Luxora** | Express 5 combined with Prisma ORM 6 provides the ideal balance between minimal architectural overhead and maximum database safety. The Prisma schema acts as the single source of truth for the entire database structure, automatically generating types and tracking migrations without requiring complex decorator hierarchies. |

---

### 4. Hosting Strategy: Decoupled (Vercel + Northflank) vs. Monolithic Single VPS

| Evaluation Criteria | Decoupled: Vercel + Northflank (Selected) | Monolithic VPS (e.g. Single DigitalOcean Droplet) |
| :--- | :--- | :--- |
| **Blast Radius & Resilience** | **Frontend remains operational even if backend API undergoes a rolling update.** | A server crash, memory leak, or container restart brings down both UI and API simultaneously. |
| **Global Edge Performance** | **Frontend assets distributed globally across Vercel CDN nodes.** | Single-region server latency for all static assets. |
| **Deployment Independence** | **Frontend PR previews and production deployments trigger without backend reboots.** | Monolithic redeployments interrupt active user connections and long-polling requests. |
| **Maintenance Burden** | **Zero OS-level patching, automatic SSL certificate management.** | Requires manual Linux sysadmin maintenance, Nginx reverse proxy tuning, and Let's Encrypt cron renewal. |
| **Adoption Rationale for Luxora** | Luxora isolates presentation delivery from business logic execution. Vercel delivers instant global performance for the React SPA, while Northflank provides managed container execution, automated zero-downtime rollouts, and persistent environment secrets for the Express API. |

---

### 5. Domestic Payments: PayHere + NOWPayments vs. Stripe

| Evaluation Criteria | PayHere + NOWPayments (Selected) | Stripe (Alternative) |
| :--- | :--- | :--- |
| **Regulatory & Local Banking Compliance** | **Officially licensed Central Bank of Sri Lanka (CBSL) payment aggregator.** | **Stripe does NOT support domestic Sri Lankan merchant accounts.** |
| **Local Currency & Payment Methods** | **Direct LKR settlement; supports local debit cards and mobile wallets.** | Incompatible with direct LKR bank settlements for local companies. |
| **Alternative Global Currency** | **NOWPayments enables international crypto settlement without forex constraints.** | International cards incur massive foreign currency exchange fees. |
| **Adoption Rationale for Luxora** | Stripe is legally and technically incapable of settling funds into domestic Sri Lankan bank accounts in LKR. PayHere is the definitive enterprise standard for Sri Lanka e-commerce, offering native LKR settlement, direct card processing, and cryptographic IPN verification. NOWPayments provides an auxiliary avenue for international clients. |

---



## SECTION 5: FRONTEND SINGLE-PAGE APPLICATION (SPA) ARCHITECTURE

### Directory Structure & Organization
The frontend is structured into modular component hierarchies, isolated page views, service abstractions, and localized data definitions:

```text
frontend/src/
├── App.jsx                     # Core router declaration, lazy imports, ErrorBoundary & auth gates
├── main.jsx                    # React 19 root mounting, StrictMode initialization
├── index.css & App.css         # Design tokens, CSS custom properties, global resets
├── services/
│   └── api.js                  # Centralized HTTP client, JWT header injection, 30s timeout, 401 handling
├── pages/
│   ├── CustomerDashboard.jsx   # Customer portal (Overview, Booking Wizard, Active Bookings, Invoices)
│   ├── ProviderDashboard.jsx   # Provider portal (Schedule calendar, Availability toggle, PIN entry, Earnings)
│   ├── AdminDashboard.jsx      # Admin operations (Users, Approvals, Subscriptions, Bookings, Payouts)
│   ├── Login.jsx & Signup.jsx  # Customer authentication and onboarding
│   ├── ProviderRegister.jsx    # Provider registration with multi-category & town selection
│   ├── BookService.jsx         # Direct service booking entry point
│   ├── Reviews.jsx             # Customer post-completion rating interface
│   └── ResetPassword.jsx       # Token-based password recovery
├── components/
│   ├── RequireAuth.jsx         # Route-level JWT & Role guard component
│   ├── ErrorBoundary.jsx       # Graceful React error capture with fallback UI
│   ├── Calendar.jsx            # Interactive monthly booking schedule grid
│   ├── ActiveBookingCards.jsx  # Live booking progress cards with PIN reveal dialogs
│   ├── SessionConfirmationAnimation.jsx # SVG completion celebration modal
│   ├── Navbar.jsx & Footer.jsx # Site navigation and legal/trust links
│   └── ui.jsx                  # Reusable luxury UI primitives (ActionButton, Modal, StatBadge)
├── chatbot/                    # Embedded AI Concierge assistant widget
│   ├── components/             # Chat UI, wizard steps, sizing calculator
│   └── services/               # Client-side intent triggers & message dispatch
└── data/
    └── sriLankaLocations.js    # Comprehensive Sri Lankan provinces and town data
```

### Component Architecture & Routing
Client-side routing is managed by `react-router-dom` v7. Routes are lazily evaluated via `React.lazy()` and wrapped inside `<Suspense fallback={<PageLoader />}>` to keep initial bundle sizes minimal.

```mermaid
flowchart TD
  ENTRY[Browser Entry: /] --> APP[App.jsx Router]
  APP --> PUBLIC[Public Landing & Auth Pages]
  APP --> GATED[Protected Portal Routes]

  PUBLIC --> HOME["/ (Landing Page)"]
  PUBLIC --> LOGIN["/login (Customer / Provider / Admin)"]
  PUBLIC --> SIGNUP["/signup (Customer Registration)"]
  PUBLIC --> PROV_REG["/provider-register (Provider Onboarding)"]
  PUBLIC --> RESET["/reset-password (Password Recovery)"]

  GATED --> REQ_AUTH["RequireAuth Component<br>(Verifies Token & Role)"]
  REQ_AUTH -->|Role: CUSTOMER| CUST_DASH["/customer-dashboard"]
  REQ_AUTH -->|Role: PROVIDER| PROV_DASH["/provider-dashboard"]
  REQ_AUTH -->|Role: ADMIN| ADMIN_DASH["/admin-dashboard"]
  REQ_AUTH -->|Unauthorized| LOGIN_REDIR["Redirect -> /login"]
```

### Centralized API Client (`frontend/src/services/api.js`)
All communication with the backend passes through a single unified wrapper function: `apiRequest(endpoint, method, data, token, options)`.
1. **Dynamic Base URL Resolution**: Resolves API URL via `resolveApiBase()`: reads `import.meta.env.VITE_API_URL` if present; defaults to same-origin `/api` in production, or `http://localhost:5000/api` during local Vite development.
2. **Automatic Authorization Injection**: Injects `Authorization: Bearer <token>` automatically when an authentication token is present in `sessionStorage`.
3. **Request Abort Timeout Controller**: Uses standard browser `AbortController` with a default 30,000 ms (30 second) network timeout to prevent hanging connections.
4. **Session Eviction on Invalidation**: Intercepts HTTP 401 Unauthorized or 403 Session Revoked responses, automatically purges `sessionStorage.token` and `sessionStorage.user`, and redirects the client window to `/login`.

### Dashboard Architecture
- **Customer Dashboard (4 Core Tabs)**:
  1. *Overview*: Real-time token wallet balance (Auto, Garden, Pet Care coins), active package expiration countdown, quick action cards.
  2. *Booking Wizard*: Interactive multi-step service selector (Auto Care, Garden Care, Pet Care with dog/cat mode toggle), town and district selector, date picker, quarter-hour time slot validation, booking review summary.
  3. *Active Bookings*: Real-time job cards showing assigned provider name and contact phone number, Start PIN and Completion PIN reveal buttons, status timeline, and cancel/reschedule actions.
  4. *Transaction History*: Comprehensive billing history, payment status badges, downloadable PDF invoices generated on-the-fly via `jsPDF`, and complaint submission dialogs.
- **Provider Dashboard**:
  - Availability toggle (`ONLINE` vs `OFFLINE`) enforcing the strict 6-hour job safety window.
  - Interactive calendar displaying assigned daily appointments.
  - Customer contact phone numbers explicitly exposed on assigned job cards for service coordination.
  - Autonomous assigned booking cancellation up to 4 hours before job start with automated replacement dispatch (no cancellation-reason forms required).
  - Double-PIN verification modals with `BEFORE` and `AFTER` photo upload inputs.
  - Earnings tracker displaying historical job payouts and linked bank account details.
- **Admin Dashboard (13 Operational Modules)**:
  - Global overview metrics, user activation toggles, provider KYC approval/rejection review with document preview, 30-day package creation, monthly session payout ledger execution, booking oversight, complaints resolution desk, support ticket replies, promotions manager, and platform operation settings.

---



## SECTION 6: BACKEND API GATEWAY & SERVICE ARCHITECTURE

### Directory Structure & Server Architecture
The Express API is structured around explicit modular routers, shared domain services, defensive security middleware, and a unified error boundary:

```text
backend/src/
├── index.js                    # Server bootstrap, security headers, reverse proxy trust, schedulers
├── config/
│   ├── env.js                  # Environment variable validation, default ports, JWT secrets
│   └── prisma.js               # Global singleton PrismaClient instance
├── middleware/
│   ├── auth.js                 # authenticateToken (JWT + tokenVersion verification), requireRole gate
│   ├── rateLimit.js            # In-memory IP rate limiter protecting auth, payment & email endpoints
│   └── validators.js           # Sanitizers, positive integer parsing, date/time regex validators
├── routes/
│   ├── auth.js                 # /api/auth (Customer/Provider registration, login, Google sign-in, resets)
│   ├── bookings.js             # /api/bookings (Booking lifecycle, PIN verification, auto-timeouts)
│   ├── provider.js             # /api/provider (Availability, town management, earnings, banking)
│   ├── admin.js                # /api/admin (System administration, KYC reviews, payouts, settings)
│   ├── customer.js             # /api/customer (Customer dashboard aggregations, wallet balances)
│   ├── services.js             # /api (Categories, services, subscription plans, demo renewals)
│   ├── integrations.js         # /api (PayHere webhooks, NOWPayments IPN, demo checkouts, Resend email)
│   ├── uploads.js              # /api (Multipart KYC documents & service evidence photos)
│   ├── profile.js              # /api/profile (User contact and address updating)
│   ├── support.js              # /api/support (Customer support ticket submission & responses)
│   ├── complaints.js           # /api/complaints (Booking complaint handling)
│   ├── reviews.js              # /api/reviews (Service ratings and feedback)
│   ├── notifications.js        # /api/notifications (In-app notification read states)
│   ├── chat.js                 # /api/chat & /api/chatbot (Live database concierge endpoints)
│   └── docs.js                 # /api/docs (Automated OpenAPI / Swagger API reference documentation)
├── services/
│   ├── scheduling.js           # Auto-assignment matching algorithm, town matching, cooldown checks
│   ├── bookingTimeouts.js      # Deadline calculators, timeout background worker, advisory lock execution
│   ├── bankingCrypto.js        # AES-256-GCM bank account encryption, SHA-256 hashing, masking
│   ├── payouts.js              # Monthly provider payout ledger generator and idempotency keys
│   ├── storage.js              # Durable S3-compatible cloud storage client with local fallback
│   ├── entitlements.js         # Server-authoritative token wallet snapshots and deductions
│   ├── currency.js             # Live LKR to USD currency exchange converter with caching
│   ├── integrations.js         # PayHere signature hashing, Resend API client, phone normalizer
│   ├── paymentContracts.js     # NOWPayments HMAC-SHA512 verification, IPN classification
│   ├── notify.js               # In-app notification creation & admin audit log recorder
│   └── sriLankaLocations.js    # Official database of 25 Sri Lankan districts and recognized towns
└── chatbot/                    # Modular rule-based AI concierge engine
```

### Express Middleware Pipeline
Every incoming HTTP request traverses a hardened middleware pipeline before reaching domain business logic:

```mermaid
flowchart TD
  REQ[Incoming HTTP Request] --> SEC_HDR[HTTP Security Headers Middleware]
  SEC_HDR --> TRUST_PROXY[Reverse Proxy Trust Configuration]
  TRUST_PROXY --> CORS_MW[Strict CORS Whitelist Evaluator]
  CORS_MW --> BODY_PARSER[JSON & URL-Encoded Parsers with Strict Body Limits]
  BODY_PARSER --> ROUTE_MATCH{Route Match}

  ROUTE_MATCH -->|Public Routes: /api/auth, /api/health| PUB_HANDLER[Route Handler]
  ROUTE_MATCH -->|Webhook Routes: /api/payments/*| WH_HANDLER[Cryptographic Signature Validator]
  ROUTE_MATCH -->|Protected Routes| AUTH_MW[authenticateToken Middleware]

  AUTH_MW --> JWT_VERIFY[jwt.verify Token Signature]
  JWT_VERIFY --> DB_SYNC[Database Query: User Active & TokenVersion Check]
  DB_SYNC --> ROLE_GATE[requireRole Gate: CUSTOMER / PROVIDER / ADMIN]
  ROLE_GATE --> KYC_GATE{Provider Role?}

  KYC_GATE -->|Yes: Gated| CHECK_KYC[Provider KYC Status === APPROVED?]
  KYC_GATE -->|No / Passed| DOMAIN_HANDLER[Domain Service & Route Controller]
  CHECK_KYC -->|Approved| DOMAIN_HANDLER
  CHECK_KYC -->|Pending/Rejected| REJECT_KYC[403 Forbidden: KYC Approval Required]

  DOMAIN_HANDLER --> CENTRAL_ERR[Centralized Prisma Error Handler]
```

### Security Headers & Proxy Configuration
Configured in `backend/src/index.js`:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing attacks.
- `X-Frame-Options: SAMEORIGIN`: Defends against clickjacking.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`: Enforces HTTPS in production.
- `Content-Security-Policy`: Restricts scripts, styling, frames, and connections to whitelisted endpoints (Google OAuth, PayHere Sandbox/Live, Google Fonts).
- `trust proxy`: Controlled via `process.env.TRUST_PROXY`. Defaults to `false` in development; explicitly set to `1` or `true` behind cloud load balancers (Northflank/Docker) to prevent IP spoofing in rate limiters.

### Centralized Error Boundary
Prisma database exceptions are caught and transformed into clean HTTP responses, preventing internal SQL leakage:
- `P2002` (Unique constraint violation) $ightarrow$ `HTTP 409 Conflict: Record already exists`
- `P2025` (Record not found in transaction) $ightarrow$ `HTTP 404 Not Found`
- `P2003` (Foreign key constraint violation) $ightarrow$ `HTTP 400 Bad Request: Related record does not exist`
- `MulterError: LIMIT_FILE_SIZE` $ightarrow$ `HTTP 413 Payload Too Large (5 MB ceiling)`

---



## SECTION 7: DATABASE ARCHITECTURE & PRISMA ENTITY-RELATIONSHIP MODEL

### Database Specifications
- **Engine**: PostgreSQL 15 (managed container in local dev, Neon Serverless PostgreSQL in production).
- **ORM / Schema Manager**: Prisma ORM v6.19.3.
- **Connection Model**: Dual-URL connection topology: pooled connection via `DATABASE_URL` (with connection pooling) for high-throughput runtime queries, and direct unpooled connection via `DIRECT_URL` for transactional Prisma migrations (`prisma migrate deploy`).
- **Precision Standard**: Financial amounts (`price`, `providerEarning`, `priceMonthly`, `expectedAmount`, `capturedAmount`, `amount`) are strictly defined as `Decimal(12, 2)` to eliminate floating-point inaccuracies.

### Entity-Relationship Architecture

```text
+--------------------------------------------------------------------------------------------------+
|                                    LUXORA DATABASE SCHEMA (PRISMA)                              |
+--------------------------------------------------------------------------------------------------+

  ┌────────────────────────┐         1:1         ┌────────────────────────┐
  │         User           │ ─────────────────── │        Provider        │
  │────────────────────────│                     │────────────────────────│
  │ id (PK)                │                     │ id (PK)                │
  │ email (UQ)             │                     │ userId (FK, UQ)        │
  │ passwordHash           │                     │ kycStatus (ENUM)       │
  │ role (ENUM)            │                     │ category (CSV)         │
  │ tokenVersion (INT)     │                     │ serviceTowns (CSV)     │
  │ town, street, district │                     │ availabilityStatus     │
  └────────────────────────┘                     │ earnings (DECIMAL)     │
              │ 1                                └────────────────────────┘
              │                                      │ 1               │ 1
              │ 1:N                                  │ 1:N             │ 1:N
              ▼                                      ▼                 ▼
  ┌────────────────────────┐             ┌────────────────┐ ┌────────────────────┐
  │    UserSubscription    │             │  KycDocument   │ │ProviderBankAccount │
  │────────────────────────│             │────────────────│ │────────────────────│
  │ id (PK)                │             │ id (PK)        │ │ id (PK)            │
  │ userId (FK)            │             │ providerId(FK) │ │ providerId (FK)    │
  │ planId (FK)            │             │ documentType   │ │ bankName           │
  │ status (active/expired)│             │ filePath (S3)  │ │ accountNumber(ENC) │
  │ startDate, endDate     │             └────────────────┘ │ accountHash(SHA256)│
  └────────────────────────┘                                │ selected (BOOL)    │
              │ 1                                           └────────────────────┘
              │ 1:N                                                    │ 1
              ▼                                                        │ 1:N
  ┌────────────────────────┐                                           ▼
  │UserSubEntitlement(Coin)│                                ┌────────────────────┐
  │────────────────────────│                                │   ProviderPayout   │
  │ id (PK)                │                                │────────────────────│
  │ subscriptionId (FK)    │                                │ id (PK)            │
  │ categoryId (FK)        │                                │ providerId (FK)    │
  │ units (Balance INT)    │                                │ bankAccountId (FK) │
  └────────────────────────┘                                │ period (YYYY-MM)   │
                                                            │ amount (DECIMAL)   │
  ┌────────────────────────┐                                │ status (ENUM)      │
  │        Booking         │                                └────────────────────┘
  │────────────────────────│
  │ id (PK)                │ ── userId (FK -> User)
  │ serviceId (FK)         │ ── providerId (FK -> Provider, Optional)
  │ status (ENUM)          │ ── subscriptionId (FK -> UserSubscription, Optional)
  │ bookingDate, time      │
  │ petType (dog/cat/null) │
  │ startPinHash (BCRYPT)  │ ── customerStartPinCipher (AES-GCM)
  │ complPinHash (BCRYPT)  │ ── customerCompletionPinCipher (AES-GCM)
  │ pinAttempts (INT)      │ ── pinLockedUntil (DATETIME)
  │ providerEarning(DECIMAL)
  └────────────────────────┘
       │ 1              │ 1
       │ 1:N            │ 1:1
       ▼                ▼
┌──────────────┐ ┌──────────────┐
│ ServicePhoto │ │    Review    │
│ (BEFORE/AFT) │ │ (Rating 1-5) │
└──────────────┘ └──────────────┘
```

### Complete Models Reference
1. **`User`**: Root identity account. Contains `email`, `passwordHash`, profile contact fields, `role` (`CUSTOMER`, `PROVIDER`, `ADMIN`), `active` boolean, and `tokenVersion` counter for instant token revocation.
2. **`PasswordResetToken`**: Cryptographic SHA-256 tokens for password recovery, bound to `expiresAt` and `usedAt`.
3. **`Provider`**: Operational provider record linked 1:1 with `User`. Stores `kycStatus` (`PENDING`, `APPROVED`, `REJECTED`), `kycRejectionReason`, multi-category capability strings (`category`), geographic coverage (`serviceTowns`), `availabilityStatus` (`available`/`offline`), and total accrued `earnings`.
4. **`KycDocument`**: Records submitted provider identification (NIC, Passport, Driving License) storing S3 object paths, original filenames, MIME types, and byte sizes.
5. **`Category`**: Root service domains (`Auto Care`, `Garden Care`, `Pet Care`).
6. **`Service`**: Specific service offerings (`Wash + Vacuum`, `Lawn Mowing`, `Pet Bathing & Grooming`) with consumer price, `durationMins`, and fixed `providerEarning`.
7. **`SubscriptionPlan` & `SubscriptionEntitlement`**: Catalog subscription packages (e.g. `Basic Package`, `Luxora Tri-Combo Luxury Suite`). Fixed at 30-day duration, defining allocation units (coins) per category.
8. **`UserSubscription` & `UserSubscriptionEntitlement`**: Immutable customer subscription instances. Entitlements store the remaining live token balance per category for that 30-day billing cycle.
9. **`Booking`**: Central fulfillment entity. Persists customer location, scheduled date/time, selected `petType`, `status` (`PENDING`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), dual bcrypt PIN hashes, AES-256-GCM customer PIN display ciphers, brute-force attempt counters (`pinAttempts`, `pinLockedUntil`), photo paths, and captured `providerEarning`.
10. **`ServicePhoto`**: Photographic audit trail linked to bookings with `kind` (`BEFORE` or `AFTER`).
11. **`Payment`**: Financial ledger tracking gateway attempts, `gatewayOrderId`, `expectedAmount`, `capturedAmount`, `status` (`PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`), `idempotencyKey`, and webhook audit payloads.
12. **`ProviderBankAccount` & `ProviderPayout`**: Financial disbursement models. Stores AES-256-GCM encrypted bank account numbers and monthly scheduled payouts with idempotency keys.
13. **`Review`, `Complaint`, `SupportTicket`, `Notification`, `AdminAuditLog`**: Operational governance and communication records.

---



## SECTION 8: AUTHENTICATION, AUTHORIZATION & SECURITY ENGINEERING

### Password Hashing & Key Derivation
- Passwords are encrypted using **BcryptJS** (`bcrypt.hash`) with a cost factor of **10 salt rounds**.
- Start and Completion PIN codes are also hashed with **BcryptJS** before storage in `startPinHash` and `completionPinHash`.

### Stateful JWT Token Invalidation (`tokenVersion`)
Standard JSON Web Tokens are stateless, meaning a compromised token remains valid until expiration. Luxora mitigates this risk by embedding a `tokenVersion` integer inside the signed JWT payload.

```mermaid
sequenceDiagram
  autonumber
  actor Client as React Client
  participant API as Express API (/middleware/auth.js)
  participant DB as PostgreSQL (User Table)

  Client->>API: HTTP GET /api/customer/dashboard (Bearer JWT)
  API->>API: jwt.verify(token, JWT_SECRET)
  API->>DB: SELECT id, active, tokenVersion, role FROM users WHERE id = user.id
  
  alt User Deactivated (active === false)
    API-->>Client: HTTP 403: Account is inactive or deactivated
  else tokenVersion Mismatch (token.tokenVersion !== db.tokenVersion)
    API-->>Client: HTTP 403: Session has been revoked. Please sign in again.
  else Valid & Active
    API->>API: req.user = { ...user, ...current }
    API->>API: Proceed to Route Controller
  end
```

When a user resets their password or is deactivated by an administrator, the backend increments `tokenVersion`:
```javascript
await prisma.user.update({
  where: { id: user.id },
  data: { tokenVersion: { increment: 1 } }
});
```
This instantly revokes all existing sessions across every device simultaneously without requiring an external Redis token blacklist.

### Sensitive Data Encryption at Rest (`AES-256-GCM`)
Provider bank account numbers represent high-risk Personally Identifiable Information (PII). Luxora encrypts bank account numbers using authenticated **AES-256-GCM** in `backend/src/services/bankingCrypto.js`:
- **Key Derivation**: 32-byte key derived from `BANK_ENCRYPTION_KEY` using SHA-256.
- **Cipher Format**: `enc:v1:<base64(12-byte IV + Ciphertext + 16-byte Auth Tag)>`.
- **Integrity Authentication**: The GCM authentication tag guarantees that ciphertext cannot be altered or tampered with in the database.
- **Lookup & Masking**: For administrative queries, the database stores a non-reversible SHA-256 hash (`accountHash`) for uniqueness checks, and a display mask (`accountMask`, e.g., `****1234`).

### Brute-Force PIN Lockout Protection
To prevent brute-force guessing of the 6-digit service verification PINs:
- The system enforces a **5-attempt ceiling** (`pinAttempts`).
- After 5 consecutive failed attempts, the booking is locked for **15 minutes** (`pinLockedUntil = now + 15 min`).
- Subsequent attempts return `HTTP 429 Too Many Requests` indicating the remaining lockout minutes.

---



## SECTION 9: TRI-GATEWAY PAYMENT PROCESSING ENGINE

Luxora implements a modular payment gateway abstraction supporting three independent payment paths:

```text
                               ┌─────────────────────────┐
                               │  Client Initiates Plan  │
                               │  Purchase: /checkout    │
                               └─────────────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               │                            │                            │
        (Mode: demo)                 (Mode: payhere)             (Mode: nowpayments)
               ▼                            ▼                            ▼
   ┌───────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
   │ Instant Demo Checkout │   │ PayHere Form Fields    │   │ NOWPayments Invoice    │
   │ Direct internal state │   │ MD5 Signature Token    │   │ Hosted Checkout URL    │
   │ transition to active  │   │ Hosted Gateway Modal   │   │ Crypto Payment Window  │
   └───────────────────────┘   └────────────────────────┘   └────────────────────────┘
               │                            │                            │
               │                            │ Server-to-Server IPN       │ Server-to-Server IPN
               │                            │ (POST /payments/payhere/   │ (POST /payments/
               │                            │  webhook)                  │  nowpayments/ipn)
               │                            ▼                            ▼
               │               ┌────────────────────────┐   ┌────────────────────────┐
               │               │ Verify MD5 Signature:  │   │ Verify HMAC-SHA512:    │
               │               │ timingSafeEqual check  │   │ timingSafeEqual check  │
               │               └────────────────────────┘   └────────────────────────┘
               │                            │                            │
               └────────────────────────────┼────────────────────────────┘
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │ activateSubscription()           │
                           │ Atomic Prisma Transaction:       │
                           │ 1. Verify payment status PENDING │
                           │ 2. Payment status -> COMPLETED   │
                           │ 3. Create UserSubscription       │
                           │ 4. Clone PlanEntitlements into   │
                           │    UserSubscriptionEntitlements  │
                           └──────────────────────────────────┘
```

### 1. PayHere Gateway (Domestic LKR Cards & Wallets)
- **Signature Hashing**: MD5 hashed token combining `merchant_id`, `order_id`, exact 2-decimal amount, currency (`LKR`), and MD5 of `PAYHERE_MERCHANT_SECRET`.
- **IPN Webhook Verification**: Evaluates `status_code` (`2 = Success`, `0 = Pending`, `-1/-2 = Failed`, `-3 = Charged back`). Signature comparisons use `crypto.timingSafeEqual` to eliminate timing attacks.
- **Contractual Validation**: Verifies that the IPN captured amount and currency strictly match the persisted `expectedAmount` and `expectedCurrency`.

### 2. NOWPayments Gateway (Cryptocurrency IPN)
- **Currency Conversion**: Automatic conversion of LKR package prices to USD using live cached exchange rates (`backend/src/services/currency.js`).
- **Signature Hashing**: Receives `x-nowpayments-sig` header. Recursively sorts payload keys alphabetically and computes `HMAC-SHA512` with `NOWPAYMENTS_IPN_SECRET`.
- **Status Mapping**: Transitions only on `payment_status === 'finished'`.

### 3. Demo Gateway (Local Staging & Testing)
- Available strictly when `PAYMENT_MODE=demo` is set in backend environment.
- Allows developer and evaluator testing of full subscription workflows without real credit cards or test funds.

### Strict Non-Refundable Rule
In adherence to the confirmed product rules, **all package purchases in V1 are strictly final**. There are no cash refunds. Cancelled eligible bookings restore service coins back into the customer's active token wallet.

---



## SECTION 10: EXTERNAL COMMUNICATIONS & EMAIL INFRASTRUCTURE (RESEND)

### Resend REST API Integration
Transactional email delivery is handled through the **Resend** email platform via direct HTTPS REST requests (`https://api.resend.com/emails`) in `backend/src/services/integrations.js`.

### Operational Email Triggers
1. **Account Registration / Welcome**: Sent upon successful customer or provider signup.
2. **Booking Assignment**: Notifies customer when a technician is auto-assigned to their booking.
3. **Timeout Auto-Cancellations**: Sent when an unassigned booking times out (30 min), or a provider fails to arrive (2 hours), notifying the user that their service coin has been returned.
4. **Password Reset Tokens**: Dispatches single-use password recovery links.
5. **Provider KYC Decisions**: Notifies providers of identity approval or detailed rejection reasons.

### HTML Defense-in-Depth Sanitization
All variable user data embedded in outbound email templates (names, addresses, service titles) is strictly escaped via `escapeHtml()`:
```javascript
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```
This prevents HTML injection attacks in email clients. If `RESEND_API_KEY` is not configured, the service logs a clean diagnostic warning and falls back gracefully without crashing backend processes.

---



## SECTION 11: DURABLE OBJECT STORAGE ARCHITECTURE (S3)

### Storage Strategy & Ephemeral Prevention
Modern container hosting platforms (such as Northflank or Docker containers) operate on ephemeral root filesystems. Storing uploaded files on the local container disk leads to catastrophic file loss upon container restarts, health probe redeployments, or horizontal scaling events.

To eliminate this vulnerability, Luxora integrates the official **AWS SDK for S3 (`@aws-sdk/client-s3`)** in `backend/src/services/storage.js`.

### Magic-Byte Sniffing & File Ingestion Architecture
To prevent malicious file upload exploits (e.g. uploading a PHP/executable script disguised with a `.jpg` extension), file processing follows a strict defense pipeline:

```mermaid
flowchart TD
  REQ[Client Uploads Multipart Form] --> MULTER[Multer Ingestion to MemoryBuffer: max 5 MB]
  MULTER --> SNIFF[Magic Byte Sniffer: detectFileSignature]
  
  SNIFF --> CHECK_SIG{Signature Matches Allowed Types?}
  CHECK_SIG -->|No Match / Spoofed Extension| REJECT[HTTP 415: Genuine JPEG, PNG, or PDF Required]
  
  CHECK_SIG -->|Valid Magic Bytes| MIME_CHECK{Sniffed MIME Matches Declared MIME?}
  MIME_CHECK -->|Mismatch| REJECT
  
  MIME_CHECK -->|Match| GEN_UUID[Generate Random Key: crypto.randomUUID + Safe Ext]
  GEN_UUID --> S3_PUT[Stream Buffer to S3 Cloud Storage via PutObjectCommand]
  S3_PUT --> DB_REC[Persist Object Key in Database: KycDocument / ServicePhoto]
```

### Production Assertion: `assertStorageConfigured()`
On server startup in `backend/src/index.js`, the backend executes `assertStorageConfigured()`. If running in `NODE_ENV === 'production'` and the S3 bucket configuration is missing, the application halts immediately with a clear diagnostic message, preventing the system from booting into a state where user documents could be written to ephemeral disks.

### Private Access Control & Streamed Delivery
Files are never served via public, unauthenticated bucket URLs. When an authorized user requests a document (`/api/provider/kyc-documents/:id` or `/api/bookings/:id/photos/:photoId`):
1. The route middleware verifies user identity and role (or ownership).
2. The backend fetches the raw byte buffer from S3 via `GetObjectCommand`.
3. The response is streamed with security headers:
   - `X-Content-Type-Options: nosniff`
   - `Content-Security-Policy: default-src 'none'; sandbox`
   - `Content-Disposition: inline; filename="..."` (sanitized basename).

---



## SECTION 12: MACHINE-READABLE CODEBASE KNOWLEDGE GRAPH SYSTEM

### Purpose & Architecture
Luxora implements a dedicated, machine-readable Codebase Knowledge Graph generator in `Knowladge-Graph/generate-graph.js` and validator in `Knowladge-Graph/validate-graph.js`.
It serves as the living source of truth for all human developers and autonomous AI engineering agents (enforced via `AGENTS.md`).

```text
                                  ┌────────────────────────┐
                                  │ Prisma Database Schema │
                                  │ (backend/prisma/...)   │
                                  └────────────────────────┘
                                               │
┌────────────────────────┐        ┌────────────┴───────────┐        ┌────────────────────────┐
│ Backend Middleware     │ ─────► │   Static Analysis AST  │ ◄───── │ Frontend React Pages   │
│ & Route Controllers    │        │  & Extraction Engine   │        │ & API Service Wrappers │
└────────────────────────┘        │  (generate-graph.js)   │        └────────────────────────┘
                                  └────────────────────────┘
                                               │
                     ┌─────────────────────────┴─────────────────────────┐
                     │                                                   │
                     ▼                                                   ▼
       ┌───────────────────────────┐                       ┌───────────────────────────┐
       │   knowledge-graph.json    │                       │        index.html         │
       │   Machine-Readable Graph  │                       │   Interactive Vis-Network │
       │   (192 Nodes, 408 Edges)  │                       │   Visual Browser          │
       └───────────────────────────┘                       └───────────────────────────┘
```

### Node Typology & Structural Relationships
The graph models 6 discrete architectural node types:
1. `database_model`: PostgreSQL Prisma entities (`User`, `Booking`, `Provider`, etc.).
2. `database_enum`: Prisma enums (`Role`, `KycStatus`, `BookingStatus`, etc.).
3. `middleware`: Backend validation and authorization gates (`authenticateToken`, `requireRole`).
4. `backend_route`: Mounted Express endpoints (`POST /api/bookings`, `GET /api/admin/payouts`).
5. `backend_service`: Core business logic modules (`scheduling.js`, `bankingCrypto.js`).
6. `frontend_page` & `frontend_component`: React UI views and interactive widgets.

### Deterministic Drift Prevention
In `02b - Knowledge Graph verify and build`, CI verifies that graph generation is deterministic and drift-free by copying the current graph, re-running `npm run graph`, and asserting byte-for-byte identity via `cmp --silent`. Non-deterministic metadata (such as variable run timestamps) is strictly excluded to prevent false-positive git diffs.

---



## SECTION 13: CI/CD PIPELINE & COMMIT-BASED SELECTIVE EVALUATION

### Visible GitHub Checks Suite
To maintain transparent engineering gates on GitHub pull requests and commits without overwhelming developers with unnecessary build delays, Luxora executes an 8-job pipeline in `.github/workflows/ci.yml`:

```mermaid
flowchart TD
  PUSH([Git Push / PR]) --> GUARD[Protected Files Guard]
  PUSH --> CLASSIFY[01 - Plan and secret scan]

  GUARD & CLASSIFY --> QUALITY[02 - Code quality and frontend]
  GUARD & CLASSIFY --> KG[02b - Knowledge Graph verify and build]
  GUARD & CLASSIFY --> BACKEND[03 - Backend tests: Postgres]
  GUARD & CLASSIFY --> AUDIT[04 - Dependency audit]
  GUARD & CLASSIFY --> DOCKER[05 - Docker smoke container]

  GUARD & CLASSIFY & QUALITY & KG & BACKEND & AUDIT & DOCKER --> GATE["06 - Required gate<br>(Strict Contract Verification)"]
```

### Selective CI Decision Engine (`scripts/ci/plan-checks.mjs`)
The classifier inspects git commit diffs (`git diff-tree` or PR head/base) and determines precisely which test suites and build steps are strictly necessary:

| Scenario | Changed Files Example | 01 Plan | Guard | 02 Quality | 02b KG | 03 Backend | 04 Audit | 05 Docker | 06 Gate |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Frontend-only** | `frontend/src/pages/Login.jsx` | Run | Run | Run (Lint + FE Build) | Run | Skip | Skip | Skip | Passes |
| **Backend-only (standard)**| `backend/src/routes/reviews.js` | Run | Run | Run (Lint only) | Run | Run (`smoke`) | Skip | Skip | Passes |
| **Backend-only (booking)** | `backend/src/routes/bookings.js`| Run | Run | Run (Lint only) | Run | Run (`bookings`) | Skip | Skip | Passes |
| **Backend-only (security)**| `backend/src/routes/auth.js` | Run | Run | Run (Lint only) | Run | Run (`security,smoke`) | Skip | Run | Passes |
| **Root Dependency** | `package-lock.json` | Run | Run | Run (Full) | Run | Run (`full`) | Run | Run | Passes |
| **Frontend Dependency** | `frontend/package.json` | Run | Run | Run (Lint + FE Build) | Run | Skip | Run | Skip | Passes |
| **Backend Dependency** | `backend/package.json` | Run | Run | Run (Lint only) | Run | Run (`full`) | Run | Run | Passes |
| **Docker-only** | `Dockerfile` | Run | Run | Skip | Skip | Skip | Skip | Run | Passes |
| **Knowledge Graph-only** | `Knowladge-Graph/index.html` | Run | Run | Run (Lint only) | Run | Skip | Skip | Skip | Passes |
| **Documentation-only** | `README.md`, `docs/api.md` | Run | Run | Skip | Skip | Skip | Skip | Skip | Passes |
| **Workflow / CI config** | `.github/workflows/ci.yml` | Run | Run | Run (Full) | Run | Run (`full`) | Run | Run | Passes |
| **Mixed Backend + DB** | `bookings.js`, `schema.prisma` | Run | Run | Run (Lint only) | Run | Run (`full`) | Skip | Run | Passes |

### Hardened `06 - Required gate` Execution Semantics
The gate uses `if: always()` to ensure execution even if upstream jobs are skipped or failed:
- **Contract Enforcement**: For every job, if `EXPECT_<JOB> == 'true'`, the result **must** be `'success'`. If a job was scheduled by classification but ended in `'skipped'` or `'failure'`, the gate exits with code 1.
- **Fail-Safe Integrity**: `GUARD_RESULT` and `CLASSIFY_RESULT` must strictly equal `'success'`.

---



## SECTION 14: TEST DATABASE ISOLATION & SEEDING MECHANICS

### Test Isolation Guardrails (`backend/tests/run-tests.js`)
To guarantee that automated test suites can never corrupt or truncate production or staging databases:
1. **Hostname Restriction**: `run-tests.js` parses `DATABASE_URL` and explicitly verifies:
   ```javascript
   if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname)) {
     console.error('Refusing to run destructive test setup against a non-local PostgreSQL host.');
     process.exit(1);
   }
   ```
2. **Schema-Level Namespace Isolation**: The test runner forces the connection search parameter to `schema=luxora_test`. Database tests execute entirely inside the isolated `luxora_test` schema.
3. **Automated Re-Migration & Baseline Seeding**: Before tests execute, the runner drops and recreates `luxora_test`, runs `prisma migrate deploy`, and executes `prisma/seed.js` to seed standard categories, baseline services, and default packages.

### Production Seeding Safety
- The production Docker container entrypoint (`backend/package.json`) executes:
  ```bash
  npx prisma generate && npx prisma migrate deploy && node src/index.js
  ```
- Seed scripts (`prisma/seed.js` or `demo-bookings.js`) are **never executed automatically in production**. Production databases retain only authentic user and operational records.

---



## SECTION 15: PROTECTED FILES GUARD ENFORCEMENT ENGINE

### Guard Rules & Protected Paths (`scripts/ci/guard-protected-files.mjs`)
To defend the repository infrastructure against unauthorized tampering, the `Protected Files Guard` inspects every incoming push:

```text
Protected Infrastructure Paths:
- .github/workflows/**           # GitHub Actions workflow pipelines
- Dockerfile & docker-compose    # Container builds and service topologies
- vercel.json                    # Edge routing and build configurations
- scripts/ci/**                  # CI gate logic and test harnesses
- .env.example templates         # Infrastructure environment definitions
```

### Actor Authorization Verification
- The guard inspects the GitHub event actor (`github.actor`).
- If protected files are touched by any user other than the authorized maintainer (`@4Raisan`), the guard logs an explicit error annotation and terminates with `process.exit(1)`.
- Standard application files (`frontend/**`, `backend/**`, `docs/**`) are open to authorized contributors.

### Detection Semantics & Limitations
The guard operates as a **CI post-push verification gate**, not a native pre-receive git hook (which GitHub SaaS does not support on public repositories without Enterprise branch rulesets). While the commit enters Git history upon push, the CI pipeline fails immediately, blocking automated merges, marking pull requests unmergeable, and preventing deployments.

---



## SECTION 16: INDEPENDENT PRODUCTION DEPLOYMENT PIPELINES

Luxora strictly avoids monolithic deployment coupling. Three independent deployment pipelines operate autonomously:

```mermaid
flowchart TD
  PUSH([Push to origin/main]) --> FORK{Independent Triggers}

  FORK -->|Webhook: Vercel| VERCEL_BUILD[Vercel Global Edge]
  VERCEL_BUILD --> VERCEL_OUT["Build React 19 SPA (npm run build)<br>Deploy to luxora.bond (CDN Global Edge)"]

  FORK -->|Webhook: Northflank| NF_BUILD[Northflank Cloud Cluster]
  NF_BUILD --> NF_OUT["Build Multi-stage Docker Container<br>Run prisma migrate deploy<br>Start Express 5 API Gateway"]

  FORK -->|Workflow: KG Deploy| GH_PAGES[GitHub Actions Pages Pipeline]
  GH_PAGES --> GHP_OUT["Run generate-graph.js<br>Validate Determinism<br>Deploy to 4raisan.github.io/Luxora_v1/"]
```

### 1. Vercel Frontend Deployment
- **Trigger**: Git push to `main` branch.
- **Build Command**: `npm run build` (Rollup bundling inside `frontend/`).
- **Output Directory**: `frontend/dist`.
- **Routing**: `vercel.json` rewrites all requests to `/index.html` for client-side routing.

### 2. Northflank Backend Deployment
- **Trigger**: Git push to `main` branch.
- **Build Engine**: Multi-stage `Dockerfile` (`node:22-alpine`).
- **Health Check**: Probes `/api/health` every 15 seconds.
- **Port**: Listens on dynamic `$PORT` (default 5000).

### 3. Knowledge Graph Deployment
- **Trigger**: Independent workflow `.github/workflows/knowledge-graph-pages.yml`.
- **Publication Target**: GitHub Pages branch environment.

---



## SECTION 17: OBSERVABILITY, FAILURE MODES & EMERGENCY ROLLBACK PROCEDURES

### Failure Mode Matrix

| Failure Mode | Detection Mechanism | System Behavior | Recovery Action |
| :--- | :--- | :--- | :--- |
| **CI Gate Failure** | `06 - Required gate` failure | Pull request blocked from merging; deployments halted. | Inspect failed check logs; fix code; re-push commit. |
| **Unauthorized File Edit**| Protected Files Guard fails | `guard` exits with code 1; downstream jobs skipped. | Authorized maintainer `@4Raisan` must review or revert change. |
| **Database Migration Error**| `prisma migrate deploy` error | Northflank container fails health probe; old version remains active. | Fix schema migration SQL; test locally on `luxora_test`; redeploy. |
| **Payment Webhook Error** | IPN signature validation fails | Webhook rejected with HTTP 400; payment remains `PENDING`. | Verify gateway secrets; customer initiates retry. |
| **Email Service Outage** | Resend API non-200 response | Caught in `sendEmail()`; logs diagnostic warning; user flow proceeds. | Background log monitoring; Resend status check. |

### Emergency Rollback Scripts
For critical production incidents, the repository provides two local rollback batch utilities:
1. **`REVERSE_1_COMMIT.bat`**: Executes `git reset --hard HEAD~1` and `git push origin main --force-with-lease`.
2. **`REVERSE_2_COMMITS.bat`**: Executes `git reset --hard HEAD~2` and `git push origin main --force-with-lease`.

> [!CAUTION]
> **Production Blast Radius of Rollback Scripts**:
> Hard resets permanently destroy unreferenced local commits. Force-pushing to `main` rewrites upstream git history, instantly triggering new production builds across Vercel, Northflank, and GitHub Pages. Use only during severe operational outages.

---



## SECTION 18: END-TO-END USER JOURNEYS (TECHNICAL SEQUENCE FLOWS)

### Journey 1: Customer Subscription Purchase & Wallet Crediting
```mermaid
sequenceDiagram
  autonumber
  actor Customer as Customer Browser
  participant Frontend as React SPA (Plans.jsx)
  participant API as Express API (/routes/services.js)
  participant Gateway as PayHere / NOWPayments
  participant DB as PostgreSQL (Prisma)

  Customer->>Frontend: Select 30-Day Plan (e.g. Tri-Combo Package)
  Frontend->>API: POST /api/subscriptions/purchase { planId, gateway }
  API->>DB: Query SubscriptionPlan & Entitlement Templates
  API->>DB: INSERT INTO payments (status: PENDING, expectedAmount)
  API-->>Frontend: Return Gateway Signature & Checkout Fields
  Frontend->>Gateway: Submit Payment Modal / Redirect
  Gateway-->>Customer: Complete Card / Wallet Authorization
  Gateway->>API: Server-to-Server IPN Webhook (POST /api/payments/payhere/webhook)
  API->>API: timingSafeEqual MD5 Signature Verification
  API->>DB: BEGIN TRANSACTION
  API->>DB: UPDATE payments SET status = 'COMPLETED'
  API->>DB: INSERT INTO user_subscriptions (status: 'active', startDate, endDate)
  API->>DB: INSERT INTO user_subscription_entitlements (units: 4 Auto, 4 Garden, 4 Pet)
  API->>DB: COMMIT TRANSACTION
  API-->>Gateway: HTTP 200 OK
  Customer->>Frontend: Refresh Dashboard
  Frontend->>API: GET /api/customer/dashboard
  API-->>Frontend: Return Active Token Wallet: Auto=4, Garden=4, Pet=4
```

### Journey 2: Service Booking & Automated Provider Dispatch
```mermaid
sequenceDiagram
  autonumber
  actor Customer as Customer
  participant API as Express API (/routes/bookings.js)
  participant Sched as Scheduling Engine (/services/scheduling.js)
  participant DB as PostgreSQL

  Customer->>API: POST /api/bookings { serviceId, date, time, town }
  API->>DB: Verify Active Category Entitlement (units > 0)
  API->>Sched: Find Eligible Provider(category, town, KYC=APPROVED, available=true)
  
  alt Eligible Provider Found
    Sched-->>API: Provider ID
    API->>DB: BEGIN TRANSACTION
    API->>DB: Deduct 1 Unit from user_subscription_entitlements
    API->>API: Generate 6-digit Start PIN & Completion PIN
    API->>API: Hash PINs with Bcrypt; Encrypt for Display with AES-256-GCM
    API->>DB: INSERT INTO bookings (status: ASSIGNED, providerId, pinHashes)
    API->>DB: COMMIT TRANSACTION
  else No Eligible Provider Available
    API->>DB: INSERT INTO bookings (status: PENDING, providerId: null)
  end
  API-->>Customer: Return Booking Details & Customer PINs
```

### Journey 3: Mutual Dual-PIN Service Execution & Evidence Capture
```mermaid
sequenceDiagram
  autonumber
  actor Provider as Provider
  actor Customer as Customer
  participant API as Express API (/routes/bookings.js)
  participant S3 as S3 Object Storage
  participant DB as PostgreSQL

  Provider->>Customer: Arrives at job location
  Customer->>Provider: Provides 6-Digit Start PIN
  Provider->>API: POST /api/bookings/:id/start { pin: '123456', photo: <file> }
  API->>API: Sniff Magic Bytes -> Store BEFORE photo in S3
  API->>API: bcrypt.compare(pin, booking.startPinHash)
  API->>DB: UPDATE bookings SET status = 'IN_PROGRESS', startedAt = NOW()
  API-->>Provider: Service Started Successfully
  
  Provider->>Provider: Completes physical service
  Customer->>Provider: Provides 6-Digit Completion PIN
  Provider->>API: POST /api/bookings/:id/complete { pin: '654321', photo: <file> }
  API->>API: Sniff Magic Bytes -> Store AFTER photo in S3
  API->>API: bcrypt.compare(pin, booking.completionPinHash)
  API->>DB: BEGIN TRANSACTION
  API->>DB: UPDATE bookings SET status = 'COMPLETED', completedAt = NOW()
  API->>DB: UPDATE providers SET earnings = earnings + booking.providerEarning
  API->>DB: COMMIT TRANSACTION
  API-->>Provider: Service Completed & Earnings Accrued
```

---



## SECTION 19: ARCHITECTURAL DECISION RECORDS (ADRS)

### ADR-001: PostgreSQL with Prisma ORM for Data Persistence
- **Status**: Accepted & Implemented.
- **Context**: Financial transactions, token coin balances, and provider payouts require strict serializability.
- **Decision**: Adopt PostgreSQL 15 managed instances accessed via Prisma ORM 6.19.
- **Consequence**: Full ACID guarantees and zero binary floating-point rounding errors; schema migrations are fully versioned in git.

### ADR-002: Dual-PIN Mutual Confirmation Protocol
- **Status**: Accepted & Implemented.
- **Context**: Preventing fraudulent provider claims of completed service and customer claims of non-delivery.
- **Decision**: Require Start PIN + BEFORE photo to commence work, and Completion PIN + AFTER photo to conclude work. PINs are generated server-side and hashed via bcrypt.
- **Consequence**: Physical proof of presence is mandatory. Eliminates non-delivery disputes.

### ADR-003: Fixed 30-Day Subscriptions with Zero Cash Refunds in V1
- **Status**: Accepted & Implemented.
- **Context**: Business model simplicity and merchant regulatory overhead in Sri Lanka.
- **Decision**: All package purchases are 30-day fixed duration and strictly non-refundable. Cancellations restore service coins, never cash.
- **Consequence**: Simplifies billing logic; eliminates chargeback fraud risks on completed services.

### ADR-004: Token-Version Stateful JWT Session Invalidation
- **Status**: Accepted & Implemented.
- **Context**: Stateless JWTs cannot be revoked if a user account is compromised or deactivated.
- **Decision**: Embed `tokenVersion` in the JWT; check `tokenVersion` against the PostgreSQL `User` record on every authenticated request.
- **Consequence**: Instant, global session revocation without maintaining a Redis token blacklist.

### ADR-005: Decoupled Multi-Cloud Hosting (Vercel + Northflank + GitHub Pages)
- **Status**: Accepted & Implemented.
- **Context**: Preventing monolithic server crashes from taking down all application tiers.
- **Decision**: Host frontend on Vercel Global Edge, backend on Northflank Docker cluster, and Knowledge Graph on GitHub Pages.
- **Consequence**: Complete fault isolation; zero frontend hosting costs; rolling backend updates without user disruption.

### ADR-006: 8-Job Commit-Based Selective CI Architecture
- **Status**: Accepted & Implemented.
- **Context**: Full CI runs on every commit cause developer fatigue and wasted runner quotas.
- **Decision**: Implement `plan-checks.mjs` to dynamically execute only relevant test suites while preserving an immutable 8-check visible gate on GitHub.
- **Consequence**: Build times reduced by up to 70% on documentation and frontend-only commits while maintaining 100% regression coverage.

---



## SECTION 20: VERIFIED ARCHITECTURE SUMMARY & GROUND-TRUTH INVARIANTS

### Codebase vs. Documentation Reconciliation
During the comprehensive repository audit, certain legacy notes in historical planning documents were audited against actual production implementation:

| Domain | Historical / Outdated Note | Verified Production Implementation (Source of Truth) | Status |
| :--- | :--- | :--- | :--- |
| **Admin Roles** | Mentioned "Super Admin" | Single `ADMIN` role with comprehensive platform authority. | **Verified Code Truth** |
| **Refunds** | Mentioned cash refunds | Strictly **no refunds in V1**; cancellations restore service coins only. | **Verified Code Truth** |
| **Payment Providers** | Generic payment gateways | Strictly **PayHere (LKR)**, **NOWPayments (Crypto)**, and **Demo mode**. | **Verified Code Truth** |
| **File Storage** | Local filesystem uploads | **AWS S3 Cloud Storage SDK** with production fail-closed assertion. | **Verified Code Truth** |
| **CI Checks** | Generic single CI run | **8 discrete GitHub checks** with commit-based selective evaluation. | **Verified Code Truth** |

### Final Engineering Sign-Off
The Luxora codebase represents an enterprise-grade, security-hardened, and meticulously verified full-stack architecture. All functional subsystems—from cryptographic bank encryption to mutual PIN confirmation and selective CI pipelines—are fully implemented, operational, and tested.

---
*Documentation Compiled & Verified from Codebase: September 2026*
