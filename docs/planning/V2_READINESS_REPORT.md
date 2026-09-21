# LUXORA V2.0.0 PRODUCTION READINESS REPORT (2026-09-18)

Baseline going in: Slices 1–10 implemented, backend 283/283. This gate performed
the final audit, fixed confirmed issues, and re-verified everything. No commits,
no tag changes; `v1.5.0-stable` still peels to `1a5d0a2`.

## Final verification numbers

| Check | Result |
| --- | --- |
| Complete backend suite (PostgreSQL + real Redis, canonical runner) | **284 passed, 0 failed, 0 skipped** (283 baseline + 1 new production-gate test) |
| Frontend tests | 8 passed, 0 failed |
| Frontend production build | Passed |
| oxlint 1.75.0 | 0 errors, 37 warnings (pre-existing style) |
| Knowledge + architecture graph verification | Passed (230 nodes / 488 edges; 87 nodes / 107 edges) |
| CI planning/guard tests | 37 passed |
| `git diff --check` | Clean |
| Live API + browser pass (Brave, local servers, disposable DB) | Login, customer dashboard, SSE — all clean |

## 1. Overall readiness

**READY for v2.0.0 as the stable baseline, conditional on the explicit operator
actions in §16.** No open P0 remains. The one P0 found by this gate (demo
checkout unconditionally live in production) is fixed and regression-tested.
All remaining items are operator actions, provider validations, or classified
P2/P3 deferrals.

## 2. Confirmed bugs fixed (this gate)

1. **[P0][CODE] Demo payments unconditionally live in production** — docs
   described `PAYMENT_MODE`/`DEMO_PAYMENTS_ENABLED` as gates, but neither was
   read at runtime; any customer could mint real subscriptions/coins free.
   Fixed: `demoPaymentsEnabled()` gate (production defaults OFF; opt-in via
   `DEMO_PAYMENTS_ENABLED=true` or legacy `PAYMENT_MODE=demo`; dev/test
   unchanged) applied to the checkout route, the demo renewal loop, and the
   `/payments/mode` diagnostic. New child-process test proves 404 by default
   and opt-in behavior in production mode. `.env.example`, backend README, and
   docker-compose now document the real switch.
2. **[P1][CODE] Start PIN broadcast over SSE** — `BOOKING_CREATED` (and
   reassignment paths) delivered the customer's start PIN to the assigned
   provider and all admins, defeating the PIN-verified start gate. Removed from
   realtime payloads; the PIN exists only in the owner's HTTP response and the
   customer-shared flow. Realtime test updated to assert the PIN is absent.
3. **[P1][CODE] Full bank account numbers returned by `GET /admin/payouts`** —
   the only unmasked path (everything else masks). Now decrypt-then-mask like
   Slice 10 statements; release-hardening test converted into a masking
   regression test (asserts the full number never appears in the response).
4. **[P2][CODE] Oversized JSON bodies returned 500** — central handler now maps
   `entity.too.large` → 413.
5. **[P2][CODE] `GET /bookings/assigned` leaked PIN bookkeeping fields**
   (`pinLockedUntil`, `startPinUsedAt`, `completionPinUsedAt`) — stripped like
   sibling endpoints.
6. **[P2][CODE] `GET /api/customer/dashboard` missing role gate** — added
   `requireRole('CUSTOMER')` for consistency with `PUT /town`.
7. **[P2][CODE] Booking photo uploads skipped the KYC gate** (only KYC-capable
   providers can hold bookings anyway) — gate added for defense in depth.
8. **[P2][CODE] PayHere/NOWPayments order creation unthrottled** — both order
   routes now share the demo-checkout limiter profile (30/15 min, hybrid
   IP+user keys, prefix `gateway-checkout`).
9. **[P3][DOC] README referenced a nonexistent `start.bat`** — replaced with the
   real `npm run dev:all` path. Added `NODE_ENV`, `DEMO_PAYMENTS_ENABLED`,
   seed-remediation flag, and PayHere HTTPS notes to `.env.example`; compose now
   passes all operational variables; frontend README documents
   `VITE_GOOGLE_CLIENT_ID`.

## 3–4. Security, authentication, RBAC

A full route matrix (18 routers, every method/path) was generated and audited:
authentication, role, KYC, ownership, limiter, and sensitive-data columns per
route. No IDOR gap was found: per-object reads/writes (bookings, PINs, photos,
KYC, notifications, subscriptions, refunds, receipts) are ownership-scoped, and
the deliberate claim-model exceptions (`/bookings/pending`, service-request
claims) are role+KYC gated and by design. The webhook endpoints remain
signature-verified. Fixes 2/3/5/6/7/8 above came from this matrix. Remaining
classified (no action this release): `GET /api/realtime` accepts the JWT via
query string (EventSource limitation) — [P3][DEFERRED]; `GET /payments/my`
returns the customer's own stored `webhookPayload` (used by the frontend as a
transaction reference) — [P3][DEFERRED]; promotions router's mid-file admin
guard is order-fragile — [P3][DEFERRED to CRUD foundation]; `POST /api/email`
is a self-addressed HTML relay (rate-limited) — [P3][OPERATOR decision];
admin routes have no shared request limiter — [P3][OPERATOR] (admin-gated,
low volume). Uploads mount-order dependency (KYC-document path must precede
the KYC-gated provider router) is documented in code; keep the comment when
reordering.

## 5–6. Payments/refunds and KYC

Payments: settlement remains callback-driven with signature, identity, amount
and currency verification; idempotent replay handling is tested. Refunds:
ledger-first manual settlement, `P2034` → 409 conflict mapping, correlation
tests, and the webhook viewer all green (refund suites pass). KYC: Slice 7
supersession (23 tests) green after all later changes; historical documents and
files are retained; no automatic deletion exists. Demo gate fix (§2.1) does not
touch PayHere/NOWPayments paths (suite proves it).

## 7. Redis

Code-level multi-replica sharing, prefix isolation, hybrid keys, fail-closed
503, and recovery are proven by 22 tests against real Redis (run inside the
284). Remaining verification is deployment-side — operator smoke test:
1. Set the same `REDIS_URL` (dedicated DB, password/TLS, `noeviction`) on 2+ replicas.
2. From replica A, exhaust a limiter (e.g. 10 logins) → 429; immediately from
   replica B → 429 without reset. `RateLimit-Reset` counts down across replicas.
3. Stop Redis → limited endpoints return 503 + `Retry-After: 5` on BOTH
   replicas; unlimited routes stay up. Restart Redis → counters resume (no new quota).
4. `redis-cli --scan --pattern 'luxora:rl:*'` shows namespaced counters with TTLs.

## 8–9. Storage/S3 and logging

Storage: production refuses to boot without the S3 trio; uploads are
signature-validated, size-capped (5 MiB), stored under random keys, retrieved
owner/admin-only, failed uploads cleaned best-effort; KYC history retained.
Live bucket behavior is [OPERATOR]: verify PUT/GET round-trip, unauthorized
retrieval (customer/other provider → 403), failed-upload cleanup (no orphan
objects on 415/DB error), and superseded-document retention after re-upload.
Logging: application writes stdout/stderr only — retention/rotation/PII
scrubbing are [OPERATOR/CONFIG] (platform-owned; no app log system added).
All 40 console sites audited: no tokens, signatures, payloads, credentials, or
request bodies are logged; auth failures are not logged. Caveat: the central
`[unhandled]` handler logs full error objects — Prisma messages (e.g. P2000)
can embed user values into logs [P3][OPERATOR scrubbing or DEFERRED]. Express 5
forwards async route errors to this handler; schedulers catch their own errors.

## 10. Validation

`toPositiveInt` hardening remains (arrays/booleans/floats rejected) and the
Slice 9 pagination bounds apply to all admin collections. Webhook payloads are
HMAC-verified before use. Remaining gaps (unknown-field rejection, nested
object schemas) are architectural, not demonstrated vulnerabilities —
classified [P3][DEFERRED / CRUD FOUNDATION]. Malformed JSON → 400, oversized
→ 413 (fixed this gate).

## 11. Brave

Real-browser investigation (Brave via CDP, clean profile, live local stack):
Shields Standard (default), **Aggressive + strict fingerprinting**, and a
blocking-disabled equivalent were each exercised across landing, login,
customer dashboard, API calls, and SSE. Result at every level: zero failed
requests, zero blocked resources, zero console errors; SSE connected (200);
the only third-party requests are Google Fonts and Unsplash imagery (mainstream,
not filter-listed). Verdict: **no reproducible Brave failure in the current
build** — the historical report does not reproduce ([BROWSER/FILTER-LIST] not
confirmed as a current defect). Residual [OPERATOR] check: production cross-origin
pairing (luxora.bond ↔ backend host) in Brave with default Shields. If a filter
list ever flags the shared backend hostname, the durable fix is a first-party
API hostname (e.g. api.luxora.bond) — [CONFIG/OPERATOR], no code change, no
security weakening.

## 12–13. Export/report and resource safety

Export separation holds (statement model → JSON/CSV serializers; OWASP CSV
formula-injection guard; row caps; account masking; no temp files). PDF remains
unjustified. Resource audit: SSE reconnect uses native EventSource (serialized,
UA-paced; auth failures permanently close) — no storm; no automatic fetch
retries; payment-return poll capped (6×/2.5 s) and demo retry (3×, linear);
chat sessions LRU-bounded (5000×40); limiter maps capped at 10k with
never-evict-then-503; schedulers are 60 s/hourly and unref'd; JSON body 256 KB;
multer 5 MiB/file caps. No unbounded in-memory collection found.

## 14–15. Migration procedure and fresh deployment

Pending on a `v1.5.0-stable` production database (verified by diffing the tag):
`20260906090000_add_refund_requests`, `20260917090000_email_verification`,
`20260917100000_kyc_document_supersession`, `20260917110000_admin_pagination_indexes`.
All four are additive (CREATE TABLE / ADD COLUMN / CREATE INDEX only — verified
statement by statement; no drop/rename/type change). Operator procedure:
1. Backup; confirm `NODE_ENV` unset locally / `prisma migrate deploy` runs from CI or ops host with `DATABASE_URL`+`DIRECT_URL`.
2. `npm --prefix backend run db:migrate` (runs `prisma migrate deploy`).
3. Verify: `SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC;` shows the four rows applied; `\d kyc_documents` shows `supersededAt`; `\d users|bookings|complaints` show `createdAt` indexes.
4. Rollback: additive-only → dropping the three new objects restores V1.5 behavior; indexes can be dropped independently. No legacy data is rewritten (legacy NIC rows stay current until explicitly replaced).
5. Deploy order: migration → backend → frontend. No destructive step exists.

Fresh deployment walkthrough verified against docs: install → env (examples now
accurate) → migrate → seed (production refuses demo accounts) → dev servers
(`npm run dev:all`; `start.bat` reference removed) → tests → Redis (documented)
→ S3 (guarded) → email → deploy (Vercel/Northflank/Neon documented) → health →
auth → payments → refunds → KYC → provider limitations (below).

## 16–17. Classifications and stop criteria

Open items: [OPERATOR] PayHere live checkpoint (documented in
SLICE10_OPERATIONAL_TOOLING.md §PayHere); [OPERATOR] S3 live checklist; [OPERATOR]
Redis multi-replica smoke (§7 above); [OPERATOR/CONFIG] log retention + P2000
scrubbing; [OPERATOR] admin-route rate-limiting decision. Deferred:
[P2→P3] validation schema overhaul (CRUD foundation), promotions guard
restructure, `/payments/my` payload shaping, `?token=` SSE (needs authenticated
EventSource design), Brave production pairing check. **Stop criteria met: no
open P0, no unresolved P1 code issue, major flows green, configuration
documented, operator actions explicit, migration procedure documented.**
