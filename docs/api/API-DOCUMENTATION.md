# Luxora API reference

Local base: `http://localhost:5000/api`. Protected calls use `Authorization: Bearer <JWT>`. Route files in `backend/src/routes/` are authoritative; `/api/openapi.json` and `/api/docs` are curated public documentation.

## Public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database-backed health |
| POST | `/auth/register`, `/auth/login`, `/auth/google` | Authentication |
| POST | `/auth/password-reset/request`, `/auth/password-reset/confirm` | Persisted single-use reset flow; confirmation revokes old JWTs |
| GET | `/categories`, `/services`, `/subscriptions`, `/promotions` | Public catalogue |
| POST | `/payments/payhere/webhook` | PayHere checksum callback |
| POST | `/payments/nowpayments/ipn`, `/payments/nowpayments/webhook` | NOWPayments HMAC callback |

## Authenticated customer/common

| Method | Path | Purpose |
| --- | --- | --- |
| GET/PUT | `/profile` | Own profile |
| GET | `/customer/dashboard`, `/bookings/my`, `/payments/my`, `/subscriptions/entitlements` | Own server state |
| POST | `/bookings`, `/reviews`, `/complaints`, `/support`, `/refunds` | Customer mutations |
| GET | `/bookings/:id/pins` | Active Service PINs for the booking customer only |
| PUT | `/bookings/:id/cancel`, `/bookings/:id/reschedule` | Eligible own booking changes |
| POST | `/payments/demo/order`, `/payments/demo/:id/complete` | Customer-only demo pipeline |
| POST | `/payments/payhere/order`, `/payments/nowpayments/order` | Customer-only hosted checkout |
| POST | `/payments/:id/receipt/resend` | Owner/admin resend for completed payment |
| GET/PUT/DELETE | `/notifications...` | Recipient-scoped notifications |

## Provider

All operational provider routes require provider role plus approved KYC. `/provider/kyc-documents` requires provider role but intentionally allows pending KYC.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/provider/kyc-documents` | Private KYC upload |
| GET/PUT | `/provider/availability`, `/provider/service-towns` | Availability and service towns |
| GET | `/provider/earnings`, `/bookings/assigned` | Own work and payout data |
| POST | `/provider/bank-accounts` | Create/select masked bank account |
| PUT | `/bookings/:id/status`, `/bookings/:id/schedule` | Assigned booking lifecycle |
| POST | `/bookings/:id/photos` | Required before/after evidence |

## Admin

There is no Super Admin. Every `/admin/*` route requires an Admin JWT. Admin covers users, providers/KYC, bookings, plans, complaints, reports, refunds, scheduling, payouts, and audit logs. Promotion and support mutation routes also require Admin.

## Private downloads

`GET /uploads/photos/:id` permits the booking customer, assigned provider, or admin. `GET /uploads/kyc/:id` permits the provider owner or admin. Files are not exposed through static paths.

## Errors

`401` means missing credentials; `403` means invalid/revoked token, wrong role, KYC gate, or ownership denial; `404` means absent/hidden resource; `409` means state/concurrency conflict; `413` means upload too large; `5xx` indicates dependency/server failure. Frontends must not replace failures with invented success state.
