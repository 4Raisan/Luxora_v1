# Provider Fulfillment Flow

Related: [Agent start](00_AGENT_START.md) · [Authentication](01_AUTH_FLOW.md) · [Customer booking](02_CUSTOMER_BOOKING_FLOW.md) · [API contracts](05_API_CONTRACTS.md) · [Database schema](06_DATABASE_SCHEMA.md)

```text
ProviderDashboard
  -> /api/provider/availability, /earnings, /service-towns
  -> /api/bookings/assigned, /:id/status, /:id/photos
  -> provider and bookings route gates
  -> KYC + ownership + allowed-transition + PIN/photo validation
  -> Provider, Booking, ServicePhoto, Notification database updates
  -> refreshed provider dashboard
```

Provider requirements:

- JWT role must be `PROVIDER`.
- Operational routes require approved KYC.
- A provider can only progress bookings assigned to that provider by the server/admin scheduling flow.
- PIN verification and photo validation happen on the server.
- Earnings derive from completed work, not frontend counters.

Primary files:

- `frontend/src/pages/ProviderDashboard.jsx`
- `frontend/src/components/ProviderCalendar.jsx`
- `backend/src/routes/provider.js`, `bookings.js`, `uploads.js`
- `backend/prisma/schema.prisma` (`Provider`, `Booking`, `ServicePhoto`)

