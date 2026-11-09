# Localhost validation — 2026-10-17

Frontend: http://localhost:3000. Gateway: http://localhost:5001.
PostgreSQL and Redis use the isolated local Compose volumes and ports 5435/6385.
Port 5000 belongs to another application, so the gateway and frontend proxy use
configurable ports. No production database or real payment was used.

## Passed

- Fresh database: all 30 migrations and the demo catalogue/account seed.
- Four domain containers and gateway, backed by local PostgreSQL and Redis.
- Full backend suite: 299 passed, zero failed/skipped, including distributed
  checkout, session revocation, SSE, photo/PIN completion, earnings and refunds.
- Frontend tests: 8 passed. CI planning/guard tests: 37 passed.
- Production frontend build and graph regeneration/validation.
- Lint completed with zero errors; existing unused-variable and React hook
  dependency warnings remain and are not claimed as resolved.
- Browser: catalogue category filters, login, demo one-time package purchase,
  persisted credit balance, automatic provider assignment, booking cancellation
  and restored credit, followed by another assigned booking.
- Provider login/dashboard: assigned booking and customer details, required
  evidence and PIN controls visible. Completion was covered by backend tests.
- Admin login/dashboard: matching bookings, subscription and payment totals;
  refund filters and empty state.
- Mobile homepage and admin refund screen at 390px: responsive navigation,
  contained horizontal table scrolling, no document overflow.
- No captured warning/error console messages on the provider/admin screens.

## Local access and remaining external checks

Seeded accounts: `customer@luxora.lk`, `provider@luxora.lk`, `admin@luxora.lk`.
Their private local passwords are in ignored `.env.local-services`.
Browser demo data remains available for inspection (one cancelled and one
assigned booking). Automated tests use the separate `luxora_test` schema.

Live payment settlement, email delivery, Google login, Cloud Run IAM/networking
and scheduler delivery require the configured external environment. They are
not established by the local test results.
