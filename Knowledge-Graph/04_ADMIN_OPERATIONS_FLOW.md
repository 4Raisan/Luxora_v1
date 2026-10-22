# Admin Operations Flow

Related: [Agent start](00_AGENT_START.md) · [Authentication](01_AUTH_FLOW.md) · [Customer booking](02_CUSTOMER_BOOKING_FLOW.md) · [Provider fulfilment](03_PROVIDER_FULFILLMENT_FLOW.md) · [API contracts](05_API_CONTRACTS.md)

```text
AdminDashboard
  -> /api/admin/*
  -> admin.js + auth/role middleware
  -> user/provider/KYC/booking/plan/promotion operations
  -> Prisma database writes + notifications
  -> refreshed admin view
```

Admin changes can have broad impact. For plan, scheduling, KYC, promotion, or booking changes, inspect both upstream UI callers and downstream model/service rules before editing.

Primary files:

- `frontend/src/pages/AdminDashboard.jsx`
- `backend/src/routes/admin.js`, `promotions.js`
- `backend/src/services/scheduling.js`, `notify.js`, `paymentContracts.js`
