# Luxora Reusable CRUD Foundation Plan

Goal: let a future developer clone Luxora and build a new application
(Product / Category / Booking / Course / Post / Invoice / Review / Inventory)
by following proven, production-tested patterns — without understanding the
Luxora business logic, and without turning Luxora into an abstract framework.

Principle: extract **conventions and templates**, not a runtime framework.
Nothing here changes the running application. This is an intentional
architectural layer documented for V2.x/V3, executed incrementally only when a
V2 change touches the same code anyway.

---

## 1. What Luxora has proven reusable (evidence-based)

Each item below is running in production today and covered by tests or
browser-verified flows. These are extraction candidates in priority order.

| Capability | Source (pattern to extract) | Reuse value | Extraction risk |
| --- | --- | --- | --- |
| Rate limiting | `middleware/rateLimit.js` — keyPrefix design, bounded in-memory LRU + optional Redis, per-route config | High | None (already dependency-free, Redis optional) |
| Validation toolkit | `middleware/validators.js` — toPositiveInt / toEnum / toBoolean / isEmail / isPassword (breach-list) / isNonEmptyString + status enums | High | None (pure functions, unit-tested) |
| Auth + sessions | `middleware/auth.js` + `services/sessionAuth.js` — JWT with `tokenVersion` revocation, `requireRole`, `optionalAuthentication`, dependency-injected verifier (already unit-tested in isolation) | High | None |
| Notifications + SSE | `services/notify.js` + `services/realtime.js` — per-user notify, role broadcast, named events, revocation-aware clients | High | None |
| File storage | `services/storage.js` — S3-or-disk, `safeKey`, production fail-fast, magic-byte validation at upload | High | None |
| Error mapping | `index.js` central handler — Prisma P2002/P2025/P2003 → clean 400/404/409, Multer limits, JSON parse errors, `[unhandled]` logging | High | None |
| Audit logging | `logAdminAction` — admin mutations recorded with actor/target/details/IP, non-fatal | High | None |
| Idempotency conventions | Advisory `pg_advisory_xact_lock` + in-transaction fresh re-read + PENDING-only grants + unique idempotency keys | High (as documented pattern + template code) | Convention, not code |
| State-machine status handling | Complaint/booking/payment status enums + transition guards + transition-gated notifications | Medium-high (as template) | Convention |
| Test harness | isolated-schema guard (`assert-test-database`), spawned-server fixtures, pure contract tests, helper factories | High | None |
| Seed + environment | seed production guard, `.env.example` completeness, compose required-var syntax, production fail-fast (`JWT_SECRET`, storage) | High | None |
| Docker/CI | Dockerfile (frontend build + API + TZ pin), compose healthchecks/required vars, GitHub Actions (secret scan, protected files, suites, required gate) | High | None |

## 2. What is Luxora-specific (do NOT generalize)

- `services/scheduling.js` — Asia/Colombo wall-clock model, 4h lead time,
  auto-assignment window/cooldown (business core).
- Payment contracts for PayHere/NOWPayments specifics (webhook field names,
  status codes) — the *shape* (classify + verify + idempotent activate) is the
  reusable part; the provider mapping is per-integration.
- Booking PIN flow, entitlements math, KYC policies, promotion pricing,
  chatbot domain logic, Sri Lanka town/province data.

## 3. Target layering (adapted to how Luxora actually works)

Luxora routes mix controller + service today (acceptable at this scale). The
template formalizes the layering without forcing a rewrite of Luxora:

```
prisma/schema.prisma        model + relations + enums + indexes
middleware/validators.js    request validation (pure functions)
services/<domain>.js        business logic + transactions + state machine
routes/<domain>.js          thin controller: validate -> authorize -> service -> response
middleware/auth.js          authentication + role authorization
services/notify.js          status-change notifications (transition-gated)
tests/<domain>.test.js      contract tests (pure) + live-server integration tests
```

Rules the template enforces (all proven in V1.5):

1. Every state change: advisory lock on the row id → fresh re-read → transition
   guard → write → (notify/broadcast) — all in one transaction.
2. Every public mutation: validation function + role check + rate limiter.
3. Every list endpoint: ownership/role scoping in the `where` clause.
4. Every notification: fired once per actual transition.
5. Every payment/provider action: idempotency key + PENDING-only grants.
6. Every migration: additive; rollback = drop new objects.
7. Tests: pure contract tests for logic, spawned-server tests for flows.

## 4. Proposed developer workflow (future template usage)

1. Clone the template; rename the app; fill `.env` from the completed example.
2. Model the first domain object in Prisma (copy the Booking/Complaint model
   shape: status enum + timestamps + ownership relation + index).
3. Add validator functions; add the service with the state machine; add routes
   with role scoping; register the router in `index.js`.
4. Copy the test-file skeleton (contract + live-server) and write success,
   failure, authorization, and duplicate cases.
5. `npm test`, `npm run graph:verify`, CI passes → done.

## 5. What should NOT be extracted now

- A plugin/Hook system, ORM abstraction over Prisma, generic admin UI generator,
  multi-tenancy, or a monorepo split. Luxora is one deployable product; the
  foundation is documentation + conventions + a copyable template, extracted
  opportunistically whenever V2 work touches the matching file (e.g. Slice B2
  pagination would produce the reusable pagination helper).

## 6. Execution plan

1. V2 slices proceed as planned (`V2_PLAN.md` §4); extraction notes accumulate
   in `docs/patterns/` as each pattern is touched.
2. After V2.0: create `templates/crud-starter` from the then-current tree,
   strip Luxora business modules, keep the foundation modules above, and add a
   README walking through the §4 workflow with one example domain.
3. Keep `main` as the real product; the template branches from it — never the
   reverse.
