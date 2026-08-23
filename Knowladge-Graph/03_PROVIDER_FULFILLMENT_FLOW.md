# Provider Fulfillment Flow

Related: [[00_AGENT_START]] · [[01_AUTH_FLOW]] · [[02_CUSTOMER_BOOKING_FLOW]] · [[05_API_CONTRACTS]] · [[06_DATABASE_SCHEMA]]

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
- A provider can only progress owned bookings, except an eligible claimable pending booking.
- PIN verification and photo validation happen on the server.
- Earnings derive from completed work, not frontend counters.

Primary files:

- `frontend/src/pages/ProviderDashboard.jsx`
- `frontend/src/components/ProviderCalendar.jsx`
- `backend/src/routes/provider.js`, `bookings.js`, `uploads.js`
- `backend/prisma/schema.prisma` (`Provider`, `Booking`, `ServicePhoto`)

