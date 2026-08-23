# API Contract Map

Related: [[00_AGENT_START]] · [[01_AUTH_FLOW]] · [[02_CUSTOMER_BOOKING_FLOW]] · [[03_PROVIDER_FULFILLMENT_FLOW]] · [[04_ADMIN_OPERATIONS_FLOW]] · [[06_DATABASE_SCHEMA]]

## Request transport

`frontend/src/services/api.js` is the shared transport. It normalizes `VITE_API_URL`, serializes JSON or `FormData`, sends a bearer token when provided, and converts non-2xx responses into errors.

## Mounted route groups

| Mount | Source file | Main consumers |
|---|---|---|
| `/api/auth` | `backend/src/routes/auth.js` | Login, signup, registration |
| `/api/bookings` | `backend/src/routes/bookings.js` | Customer, provider, admin |
| `/api/customer` | `backend/src/routes/customer.js` | Customer dashboard |
| `/api/provider` | `backend/src/routes/provider.js` | Provider dashboard |
| `/api/admin` | `backend/src/routes/admin.js` | Admin dashboard |
| `/api/profile` | `backend/src/routes/profile.js` | Customer/provider profile |
| `/api` uploads/integrations/refunds/docs | `uploads.js`, `integrations.js`, `refunds.js`, `docs.js` | Role dashboards and checkout |

For exact method, status code, validation, and response shape, read the active route implementation first; the route file is the contract authority.

