# Customer Booking Flow

Related: [[00_AGENT_START]] · [[01_AUTH_FLOW]] · [[03_PROVIDER_FULFILLMENT_FLOW]] · [[05_API_CONTRACTS]] · [[06_DATABASE_SCHEMA]]

```text
CustomerDashboard / BookService
  -> apiRequest('/services' | '/subscriptions' | '/bookings')
  -> services.js / bookings.js
  -> entitlement checks + scheduling + notifications
  -> Prisma transaction
  -> PostgreSQL: Booking, UserSubscription, Payment, Notification
  -> API response
  -> dashboard reloads real state
```

Rules to preserve:

- A booking consumes an eligible entitlement.
- Cancellation before work starts restores the entitlement when allowed.
- Booking status changes are server-owned.
- Payment completion/subscription activation are idempotent server flows.

Primary files:

- `frontend/src/pages/CustomerDashboard.jsx`, `BookService.jsx`
- `backend/src/routes/bookings.js`, `customer.js`, `services.js`
- `backend/src/services/entitlements.js`, `scheduling.js`, `notify.js`

