# Luxora roadmap
## Current baseline
React/Vite customer/provider/admin portals; Express/Prisma/PostgreSQL auth and roles; catalogue/packages/entitlements; bookings/KYC/availability/PIN/photos; support/notifications; demo/PayHere boundary; refunds; migrations; responsive shared shell.
## Priority 1: reliability
- Automated API smoke tests for health, auth, ownership, role guards, packages, booking lifecycle, and refunds.
- Request IDs, safe structured logs, latency/pool metrics, migration/backup procedures.
- Durable password-reset tokens in PostgreSQL/Redis before multi-instance deployment.
- Abuse monitoring for login, reset, OTP, uploads, and callbacks.
## Priority 2: hardening
- PayHere reconciliation/idempotency tests for delayed/duplicate callbacks.
- Audit records for admin KYC, booking, package, scheduling, and refund decisions.
- Town matching/date boundary tests and accessibility/responsive visual regression.
## Priority 3: scale
- Background jobs for email/SMS/notifications/retryable gateway work.
- Pagination/filtering for high-volume admin/history queries.
- Durable object storage and expiring signed URLs for uploads.
- Aggregate/read models for analytics instead of request-time query fan-out.
Every item must record affected contracts, schema/migration and rollback plan, authorization impact, tests, and deployment environment.
