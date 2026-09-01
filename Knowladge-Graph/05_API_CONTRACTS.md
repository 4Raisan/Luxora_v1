# API Contract Map

Related: [Agent start](00_AGENT_START.md) · [Authentication](01_AUTH_FLOW.md) · [Customer booking](02_CUSTOMER_BOOKING_FLOW.md) · [Provider fulfilment](03_PROVIDER_FULFILLMENT_FLOW.md) · [Admin operations](04_ADMIN_OPERATIONS_FLOW.md) · [Database schema](06_DATABASE_SCHEMA.md)

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
| `/api` uploads/integrations/docs | `uploads.js`, `integrations.js`, `docs.js` | Role dashboards and checkout |

For exact method, status code, validation, and response shape, read the active route implementation first; the route file is the contract authority.

