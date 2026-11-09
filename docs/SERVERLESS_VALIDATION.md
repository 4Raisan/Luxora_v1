# Serverless migration validation

Validated locally on 2026-10-16 using Node 22, isolated PostgreSQL 16 and Redis 7
containers, and the built Linux service image.

## Results

| Check | Result |
| --- | --- |
| Full backend suite, including real Redis and distributed flow tests | 299 passed; 0 failed; 0 skipped |
| Frontend tests | 8 passed |
| CI classification/guard tests | 37 passed |
| Production frontend build | Passed |
| Changed runtime/test files lint | Passed without warnings |
| Repository-wide lint | No errors; warnings in existing unrelated files |
| Knowledge graph generation and validation | Passed |
| Architecture graph generation and validation | Passed |
| Linux service image build | Passed; backend dependency audit reports 0 vulnerabilities |
| Four Linux domain containers and gateway | Health, database and authorization checks passed |
| Container runtime identity | All five containers run as non-root `node` |
| Linux booking-timeout, renewal and monthly-payout job commands | Completed successfully |
| Linux migration job command | Completed; no pending migrations |
| Compose topology | Validated |
| Terraform initialization, formatting and provider-schema validation | Passed |

The real distributed test starts separate accounts, bookings, payments and
engagement processes plus a gateway and a second engagement replica. It checks
login, role gates, idempotent purchasing, credits, automatic assignment, realtime
delivery between processes, multipart photo evidence, customer PIN start and
completion, provider earnings, cancellation/coin restoration, refund lifecycle,
bank snapshot stability, chat continuation on another replica, and revocation
across services.

Additional regression tests exercise failed-job retry/leases, stale chat-writer
fencing, client-IP forwarding, raw webhook body preservation, customer JWT and
platform identity separation, HTTP side-effect draining, and refund precision.

## Environment boundary

These results prove the implementation and local deployment path. No cloud
resources, public domains or payment-provider accounts were changed. Terraform
was validated without applying it. Cloud IAM, network access, live callbacks,
external bank transfers and actual scheduler delivery must be smoke-tested in
the selected deployment environment during the documented rollout.

The topology intentionally shares PostgreSQL transactions between domain
services; this conversion does not claim database-per-service isolation.
