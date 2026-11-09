# Luxora serverless microservices

The repository supports four independently deployed domain services behind a
streaming gateway. Google Cloud Run is the serverless runtime; Cloud Scheduler
executes Cloud Run jobs. The React application keeps the same `/api` contract.
This document describes the implemented deployment target, not an assertion
that the existing production environment has already migrated.

## Service boundaries

| Service | Public API ownership |
| --- | --- |
| accounts | `/api/auth`, `/api/profile` |
| bookings | bookings, customer/provider dashboards, admin operations, KYC and booking uploads |
| payments | categories/services/package catalogue, subscriptions, promotions, checkout, payment webhooks, refund requests, email endpoints |
| engagement | notifications, support/custom requests, reviews, complaints, chatbot, realtime SSE |
| gateway | Routes existing paths to their owner, streams uploads/webhooks unchanged, adds platform identity |
| jobs | Booking timeouts/reassignment, demo renewals, monthly payout queuing |

`backend/src/runtime/service-map.js` is the gateway routing contract.
`backend/src/app.js` selects routers by `LUXORA_SERVICE`. Each domain has its
own process, scaling limit, deployment image reference and Cloud Run identity.
`LUXORA_SERVICE=all` retains local/legacy single-process compatibility.

## Data and consistency decision

This is a **shared-data microservices topology**. It deliberately retains the
PostgreSQL schema and transactions across accounts, bookings, credits, payments,
refunds and provider earnings. The admin operations API remains in bookings and
can administer these records. Separate databases and asynchronous financial
sagas have not been introduced or claimed: they would replace existing atomic
business guarantees and require a separate product/consistency migration.

Account/session validation still re-reads authoritative PostgreSQL state in
every service. KYC gates remain server-side. Payment activation, booking coin
consumption, cancellation, refund completion and earnings settlement retain
their existing transactions and idempotency rules. Demo renewals also serialize
on the subscription before re-reading it, preventing overlapping job executions
from granting two renewals.

## Shared runtime state

- **Redis** provides shared rate-limit counters, per-chat-session locks/state,
  job leases and a cross-instance realtime channel. Serverless startup refuses
  missing shared configuration. Restricted endpoints fail closed on Redis loss.
- **SSE** connections stay in the engagement instance serving the request.
  Broadcasts from other services travel over Redis Pub/Sub and retain user/role
  audience filtering. SSE reconnects trigger authoritative dashboard reloads;
  Pub/Sub is a live hint channel, not a durable financial event ledger.
- **Files** use the existing private S3-compatible store in production. They
  are never tied to a Cloud Run instance filesystem. The local Compose topology
  shares a development upload volume with the bookings service.
- **Request work** tracks existing unawaited email, notification, audit and
  realtime publication promises. Responses finish after their request's work
  settles, so request-based CPU suspension does not cut it off. Job scopes drain
  this work too. Emails have a bounded outbound timeout.
- **Package reads** bypass the instance-local catalogue cache in serverless
  mode, so an admin edit in another process is immediately visible.

## Jobs and schedules

| Job | Schedule, Asia/Colombo | Safety |
| --- | --- | --- |
| booking-timeouts | Every minute | Shared lease; guarded/locked booking transitions |
| demo-renewals | Hourly | Shared lease; per-subscription transaction lock; demo opt-in |
| monthly-payouts | 23:00 on days 28–31 | Worker checks the actual Colombo month end; unique provider/period; bank snapshots |

No business timers start inside distributed HTTP instances. Jobs have a
10-minute Cloud Run task limit and a 15-minute Redis lease. Retries release a
failed worker's lease; existing records prevent repeated money/coin settlement.
Migration is a separate job and never runs on each HTTP cold start.

## Local setup

Use Docker Compose v2, Node 22, and the repository's installed dependencies.
Set `LOCAL_DB_PASSWORD`, `JWT_SECRET`, and `BANK_ENCRYPTION_KEY` in the shell
to private development values. Do not commit them.

```powershell
docker compose -f docker-compose.services.yml up -d postgres redis
docker compose -f docker-compose.services.yml run --rm migrate
docker compose -f docker-compose.services.yml up -d --build accounts bookings payments engagement gateway
npm run frontend
```

The gateway listens on localhost:5000 and the frontend development proxy already
uses that address. The four domain ports are private to the Compose network.
The database is localhost:5435 and Redis localhost:6385. This separate Compose
project does not change the legacy `docker-compose.yml` deployment.

If port 5000 is occupied, set `LOCAL_GATEWAY_PORT=5001` for Compose and start
the frontend with the matching proxy target:

```powershell
$env:VITE_API_URL='/api'
$env:VITE_API_PROXY_TARGET='http://127.0.0.1:5001'
npm run frontend
```

Private local values can also be stored in ignored `.env.local-services` and
loaded with `docker compose --env-file .env.local-services -f docker-compose.services.yml`.
The shared local build tag defaults to `luxora-services:local`; override it with
`LOCAL_SERVICES_IMAGE` when running another checkout alongside this one.

For a fresh local database, set private `CUSTOMER_PASSWORD`, `PROVIDER_PASSWORD`
and `ADMIN_PASSWORD` values and run
`docker compose -f docker-compose.services.yml run --rm seed` after migrations.
This seeds the catalogue and local demo identities. Existing databases retain
their records. Production rollout uses the existing database and real accounts.

Jobs can be exercised explicitly:

```powershell
docker compose -f docker-compose.services.yml run --rm booking-timeouts
docker compose -f docker-compose.services.yml run --rm demo-renewals
docker compose -f docker-compose.services.yml run --rm monthly-payouts
```

The monthly worker is a no-op outside month end. Local Compose does not pretend
to be an external production scheduler; Cloud Scheduler owns that in production.

## Cloud deployment and rollout

1. Build `Dockerfile.services` and publish immutable image references. Initially
   the same digest can serve all roles; each role can later use its own digest.
2. Prepare PostgreSQL pooling/direct URLs, a TLS Redis endpoint reachable from
   Cloud Run, private object storage and the existing payment/email integrations.
   If using private Redis networking, add the environment's VPC egress setup
   before deployment; the supplied module assumes network-reachable endpoints.
3. Store credentials in Secret Manager. Copy
   `infra/cloud-run/terraform.tfvars.example` to an ignored `.tfvars` file and
   supply project, image and secret-reference values. Secret values are never
   passed through Terraform variables.
4. Run `terraform init`, `terraform validate`, and review `terraform plan` in
   `infra/cloud-run`. Apply through the environment's normal deployment process.
5. Execute the `luxora-migrate` job once and verify it succeeds **before sending
   user traffic**. Fresh domain services can report `/healthz` before migrations;
   `/api/health` additionally verifies database connectivity.
6. Verify each private domain and the public gateway. Domain invoker IAM grants
   only the gateway identity; user JWTs remain in `Authorization`, with Cloud Run
   identity in `X-Serverless-Authorization`. Jobs are invoked through IAM, not
   unauthenticated public maintenance endpoints.
   The gateway overwrites `X-Luxora-Client-IP`; private domain services use it
   for rate-limit/audit identity across platform proxy hops. Never expose domain
   services publicly or grant untrusted callers invoker access.
7. Point `VITE_API_URL` at the gateway and rebuild the SPA. Update Google sign-in
   allowed origins and both payment providers' callback URLs to the gateway's
   public HTTPS hostname. Preserve signature verification and expected amounts.
8. Set `schedulers_paused=false` and apply only after the migration and smoke checks pass (the module defaults to paused schedules).
   Disable the old backend's business schedulers before cutover. Existing
   database idempotency remains necessary during overlap/retries.
9. Retain the old image and frontend configuration for rollback. Stop the new
   scheduler jobs before restoring old scheduling. No destructive schema change
   is required by this conversion.

The Terraform module creates domain services, a public gateway, separate runtime
identities, secret-access grants, job invoker grants, jobs and scheduled triggers.
It does not create or modify external payment accounts, DNS, database hosting,
Redis hosting or object-store buckets.

## Scaling and operations

Defaults cap each domain at 3 instances with a pool of 3 database connections
per instance: budget at least 36 domain connections plus jobs, migrations and
operational headroom. Adjust both values together against the actual database
limit. Gateway instances do not open database connections. SSE streams occupy
requests until reconnect/platform timeout; monitor engagement concurrency.

Use gateway request IDs and platform request logs for tracing. Do not include
JWTs, callback signatures, account numbers or secrets in application logs.
Monitor 5xx rates, Redis health, failed job executions, pending bookings/payments
and payout age. A live event or email notification does not replace the stored
booking/payment record as the source of truth.

## Validation

```powershell
npm --prefix backend run test:architecture
npm test
npm run test:frontend
npm run test:ci-plan
npm run build
npm run graph:verify
```

Backend tests require local PostgreSQL and use only `luxora_test`. Set
`TEST_DISTRIBUTED_REDIS_URL` to an isolated local Redis database to include the
real four-service/gateway flow test. CI supplies Redis database 14. It verifies
login, role gates, idempotent checkout, cross-service credits, automatic provider
assignment, cross-process SSE, multipart evidence, PIN start/completion, earnings,
cancellation/coin restoration, refund transitions and session revocation.

Cloud IAM, networking, external gateway settlement and live scheduler delivery
still require the target environment's deployment smoke checks; local tests
cannot establish those external facts.

Platform references: [Cloud Run services](https://docs.cloud.google.com/run/docs/configuring),
[scheduled jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule),
[service secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
