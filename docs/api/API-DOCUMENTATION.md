# Luxora API reference
Local base URL: http://localhost:5000/api. Protected requests use Authorization: Bearer JWT. JSON uses application/json; uploads use multipart FormData. Generated contract: /api/openapi.json; Swagger UI: /api/docs.
## Public
| Method | Path | Purpose |
|---|---|---|
| GET | /health | Database-backed health |
| POST | /auth/register | Customer/provider registration |
| POST | /auth/login | JWT login |
| POST | /auth/password-reset/request | Reset request |
| POST | /auth/password-reset/confirm | Confirm reset |
| GET | /categories, /services, /subscriptions | Catalogue |
| GET | /promotions | Active promotions |
| POST | /payments/payhere/webhook | Signature-validated callback |
## Customer/common
| Method | Path | Purpose |
|---|---|---|
| GET | /auth/me, /profile, /customer/dashboard | Current user/profile/dashboard |
| PUT | /profile, /customer/town | Profile/town mutations |
| POST | /bookings, /reviews, /complaints, /support | Create domain records |
| GET | /bookings/my, /complaints/my, /support/my, /notifications | Own data |
| PUT | /bookings/:id/cancel, /bookings/:id/reschedule | Own booking changes |
| GET | /payments/mode, /payments/my, /subscriptions/entitlements | Payment/balance reads |
| POST | /payments/demo/order, /payments/demo/:id/complete | Demo purchase pipeline |
| POST | /payments/payhere/order | PayHere checkout |
| GET/POST | /refunds/my, /refunds | Refund list/request |
| PUT | /subscriptions/:id/auto-renew, /subscriptions/:id/cancel | Subscription changes |
## Provider
| Method | Path | Purpose |
|---|---|---|
| GET/PUT | /provider/availability | Availability |
| PUT | /provider/service-towns | Service towns |
| GET | /provider/earnings, /bookings/assigned | Work/earnings |
| PUT | /bookings/:id/status, /bookings/:id/schedule | Lifecycle/schedule |
| POST | /provider/kyc-documents, /bookings/:id/photos | Multipart uploads |
| GET | /uploads/photos/:id | Authorized photo |
## Admin/Super Admin
All admin routes require Admin JWT; plan and scheduling mutations require Super Admin.
| Method | Path | Purpose |
|---|---|---|
| GET | /admin/stats, /admin/reports | KPI/report data |
| GET/PUT | /admin/users[/:id], /admin/providers[/:id/kyc] | Users and KYC |
| GET/PUT | /admin/bookings[/:id], /admin/complaints[/:id] | Management queues |
| GET | /admin/subscriptions, /admin/refunds, /support, /promotions/all | Lists |
| POST/PUT/DELETE | /admin/subscriptions[/:id] | Create, update, or remove an unused package |
| PUT | /admin/refunds/:id, /support/:id, /promotions[/:id] | Mutations |
| GET/PUT | /admin/settings/scheduling | Super Admin scheduling |
| POST | /admin/settings/scheduling/restore-defaults | Super Admin reset |
## Errors
401 missing/invalid token; 403 wrong role/owner; 404 missing route/resource; 409 state/idempotency conflict; 5xx server/integration failure. Never turn errors into fake empty data. Update OpenAPI, authorization tests, and this file with every new endpoint.
