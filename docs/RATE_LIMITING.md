# V2 Slice 8 — rate-limit policy

## Inventory and thresholds

All shared limiter windows are 15 minutes. No existing numerical threshold changed.
All paths below are mounted under `/api`; query strings, trailing slashes, request body values and resource IDs do not contribute to keys.

| POST route(s) | Max | Prefix | Identity | Purpose |
| --- | ---: | --- | --- | --- |
| `/auth/register`, `/auth/google` | 60 | auth-general | IP | Registration/hash work and Google verification; intentionally shared |
| `/auth/login` | 10 | auth-login | IP | Password guessing and login work |
| `/auth/password-reset/request`, `/auth/password-reset/confirm` | 5 | password-reset | IP | Reset mail/token attempts; intentionally shared |
| `/auth/verify-email` | 20 | email-verify | IP | Verification token attempts |
| `/auth/resend-verification` | 5 | email-resend | IP | Verification mail abuse |
| `/payments/demo/checkout` | 30 | demo-checkout | Independent IP AND verified user | Transaction/checkout bursts |
| `/payments/refunds` | 30 | refund-request | Independent IP AND verified user | Refund creation abuse |
| `/email`, `/payments/:id/receipt/resend` | 5 | email-send | Independent IP AND verified user | Mail delivery cost; receipt resend newly shares existing mail quota |
| `/chat`, `/chatbot/special-ask` | 60 | chat | Independent IP AND verified user, anonymous IP fallback | Chat database/session work; special-ask newly shares chat quota |

Before Slice 8 all nine limiter instances were IP-only. Password reset, demo checkout and email used the same default `rl` Redis prefix despite separate local Maps. Their distributed counters collided. Each now has a distinct explicit prefix. Registration/Google and reset request/confirm still intentionally share their own limiters.

Two routes now consume existing quotas: receipt resend shares mail quota, special-ask shares chat quota. These were unthrottled paths to similar expensive work; no new numerical limits were invented. No limits were added to ordinary dashboard reads.

### Other controls and limits of coverage

Uploads have no shared request-rate limiter: authenticated provider role/ownership gates, validated signatures, maximum 5 MiB per file, 3 KYC files or 5 service photos per request remain. Sensitive admin mutations, refund cancellation, gateway order creation, support and most dashboard routes also have no shared request limiter. They retain their authorization, validation, transaction, idempotency and business constraints; this slice does not claim universal request throttling. Provider webhooks are not placed behind client quotas, which could block settlement delivery. Existing persisted booking PIN attempt/15-minute lockout controls remain separate and unchanged. Chat session bounds and SSE connection handling are not Redis-distributed by this change.

## Identity rationale

`strategy: 'hybrid'` consumes two independent counters, NOT a composite `IP+user` key. Either exhausted counter rejects the request. A user moving between IPs retains the user quota; an IP rotating authenticated accounts retains the IP quota. User IDs come only from successful authentication middleware, never body/query/header claims. Chat optional authentication now precedes its limiter; anonymous chat uses IP only. Invalid authentication retains the existing auth error contract and does not create a trusted user counter.

Public auth/reset/verification endpoints remain IP-only. An email in a request is not a verified identity; this slice does not create victim-address lockouts from arbitrary submitted emails. Distributed anonymous attacks using many real IPs still require ingress/bot controls. Rotating BOTH authenticated accounts and real source IPs is likewise not solved by these counters. Rate limiting is one layer, not the authentication or ownership authority.

The historical per-IP thresholds remain unchanged for shared networks. A new per-user dimension at the same threshold does not lower the existing network allowance. Shared-network exhaustion is still possible at those established limits; monitor rather than silently raising security thresholds. Anonymous chat is intentionally supported and cannot provide account-level guarantees.

## Redis behavior

Configure `REDIS_URL` identically on every replica, pointing to the same dedicated Redis database. URLs support redis/rediss; credentials are provided only through the environment or secret service. No credential-bearing values are logged.

One Lua EVAL consumes all dimensions and establishes millisecond expiry atomically. Concurrent requests cannot leave an incremented counter without expiry. Counts saturate at max+1. Namespaced keys are `luxora:rl:{limiter-prefix}:dimension:sha256(identity)`; raw user IDs/IP strings are not embedded in keys. The hash tag keeps a limiter's dimensions in one Redis Cluster slot, but this deployment uses an ordinary ioredis Redis connection, not a Cluster topology client.

Redis server TTLs govern shared windows. Moving between replicas or restarting an API replica does not reset shared counters. Redis data loss, eviction, flushing, changing database/prefix, or restarting Redis without persistence CAN reset quotas. Operators must choose persistence/HA and a dedicated noeviction memory policy accordingly. Memory exhaustion then produces a store error and fails closed instead of silently evicting security counters.

The key format changes from the old prefix:IP format. Roll out coordinated replicas; mixed old/new versions do not share the same counters and a fresh namespace initially resets quotas. Drain old replicas or retain ingress protection during rollout; old keys expire naturally after their windows.

## Outage and local policies

- REDIS_URL absent: bounded instance-local Map, suitable for development or one production instance. Replicas without Redis do NOT share limits.
- REDIS_URL present but not ready/invalid/unreachable, timeout, malformed counter response, or command failure: all limited endpoints return 503 with `Retry-After: 5`. No automatic local fallback and no fake global quota headers. This is intentionally fail-closed for login, reset, verification, refunds, email and chat/checkout work. Unlimited routes retain their existing behavior.
- Redis command/connect deadlines are 1 second; offline queuing is disabled, request retries are zero, connection retries back off to two seconds. Recovery resumes shared counters rather than allocating a new local allowance. State-change logs report outage/recovery without URL or credentials.
- Local Map is capped at 10,000 tracked dimensions per limiter. Expired entries are removed periodically (at most 60 seconds) and on capacity pressure. Live counters are never evicted to admit new identities; at capacity new identities get 503. Existing identities keep their quotas. Hybrid traffic can use two entries per request identity combination.

## Proxy deployment

Keys use Express `req.ip` with socket fallback, never read X-Forwarded-For directly. IPv4-mapped IPv6 IPv4 addresses are normalized. `TRUST_PROXY` remains configured by the existing entry point: unset/false means direct peer, true means one hop, numeric hop count or Express-supported address rules require an accurately constrained network topology.

Compose previously published the API port while defaulting to one trusted hop. It now defaults to false, matching `.env.example`, and forwards REDIS_URL. Operators behind a proxy MUST explicitly configure trust and restrict direct API access. The final trusted proxy must replace/append forwarding headers correctly. Numeric trust is unsafe if alternate shorter paths let clients impersonate trusted hops. Tests prove default untrusted XFF cannot rotate keys and verify a controlled trusted-loopback fixture; they do not certify the deployed ingress.

## API contract

Allowed/quota-exceeded responses retain:

- `RateLimit-Limit`: configured per-dimension maximum.
- `RateLimit-Remaining`: minimum remaining quota across applicable dimensions, clamped to zero.
- `RateLimit-Reset`: relative seconds until the governing window resets, minimum 1.
- 429 body: existing `{ "error": message }` shape; `Retry-After` matches reset. If multiple dimensions are blocked, retry waits for the longest blocked TTL.
- 503 store/capacity failure: `{ "error": "Rate limiting temporarily unavailable, try again later" }`, `Retry-After: 5`, no invented RateLimit counters.

Counters count attempts including rejected quota attempts, as before. No frontend retry loops are added. API frontend error handling continues receiving the same error field for 429/503.

## Testing and CI

`backend/tests/rate-limit.test.js` uses real Express HTTP, cryptographically signed fixture identities and isolated Redis selected solely by TEST_REDIS_URL. It creates random key namespaces, cleans only its own keys and never flushes the database. Configured-but-unreachable test Redis fails the tests. Redis cases are skipped when TEST_REDIS_URL is absent, keeping local development DB suites usable.

CI provisions an isolated Redis 7 service and explicitly runs the rate-limit file with TEST_REDIS_URL, before selected backend suites. The service has no production credentials or publicly deployed endpoint. Production REDIS_URL is not needed in CI. The ordinary backend runner also discovers this test file in its full suite.

Coverage includes local/shared counters, 20 concurrent requests with exactly 5 admitted, two Express app instances and Redis clients, prefix isolation, user/IP rotation, anonymous fallback, invalid signed identities, untrusted XFF, query/slash variants, outage/recovery, malformed replies, bounded memory, expiry, disposal and 429/retry headers. These two-instance tests use separate app instances in one test process, not a deployed multi-replica cluster.

## Verification results (2026-09-17)

- Complete backend runner, PostgreSQL and isolated authenticated Redis enabled: **253 passed, 0 failed, 0 skipped** (231 existing + 22 limiter tests).
- Focused limiter file with real Redis: **22 passed, 0 failed, 0 skipped**.
- Frontend helper tests: **8 passed**; frontend production build: passed.
- CI planning/guard tests: **37 passed**.
- Declared oxlint 1.75.0 via npm exec: **0 errors, 28 warnings**; local installed oxlint binary was absent.
- Knowledge and architecture graph validation: passed.
- Existing HTTP login, verification, refund and admin tests remain green. No frontend files/retry loops were changed. Browser interaction and production topology have not been verified.

Redis tests used an isolated authenticated WSL Redis instance with a runtime-generated password; no production Redis credentials. PostgreSQL used the disposable local luxora_test schema. Temporary Redis was shut down after each test run.

## Operator requirements and scope

Before scaling: provision private authenticated Redis (TLS where available), noeviction policy, capacity monitoring, persistence/HA; set REDIS_URL on all replicas; restrict direct ingress; configure TRUST_PROXY and verify client IPs; monitor 429/503 and outage logs. Do not treat API health/database health as proof Redis is ready. An outage intentionally blocks limited actions until recovery.

No production Redis/ingress was changed or validated. No database migration is required. No commits/tags or Slices 9+ are part of this work. Admin pagination, payout statements, webhook viewer, gateway automation, RLS and CRUD extraction remain outside scope.
