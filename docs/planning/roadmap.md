# Luxora roadmap

## Current baseline

Implemented: role-scoped portals; Prisma/PostgreSQL migrations; demo, PayHere, and NOWPayments settlement; gateway webhook `REFUNDED`-status handling; Resend receipt retry state; entitlements; server auto-assignment; serialized PIN/photo lifecycle; private local/S3-compatible upload storage; provider earnings/bank accounts/monthly payout ledger; admin audit log; isolated migration-built API tests; CI, lint, build, and generated knowledge graph.

## Priority 1

- Add deployment-owned durable S3 credentials and verify real upload/download persistence across redeploys.
- Add a durable queue/outbox for email, notifications, payment reconciliation, and scheduler jobs.
- Add request IDs, structured redacted logs, metrics, and production log access procedures.
- Add automated browser accessibility/responsive tests for customer, provider, and admin authenticated flows.

## Priority 2

- There is no customer refund-initiation flow in V1 by design (package purchases are final; eligible cancellations restore service coins). If a future NOWPayments refund capability is required, it needs a new admin-initiated gateway workflow; no admin approval records such intent today.
- Add retry/requeue UI and history for failed provider bank transfers.
- Add pagination and indexed filters for high-volume admin/history endpoints.
- Add verified-email state and confirmation flow if product requirements require more than password ownership/reset email.

## External validation still required

Run genuine PayHere sandbox, NOWPayments sandbox, Resend verified-domain, S3-compatible storage, Google OAuth, managed PostgreSQL, and hosted runtime-log tests with authorized test accounts. Mocked and local tests do not replace these checks.
