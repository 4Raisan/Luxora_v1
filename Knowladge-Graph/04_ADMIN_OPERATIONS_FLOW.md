# Admin Operations Flow

Related: [[00_AGENT_START]] · [[01_AUTH_FLOW]] · [[02_CUSTOMER_BOOKING_FLOW]] · [[03_PROVIDER_FULFILLMENT_FLOW]] · [[05_API_CONTRACTS]]

```text
AdminDashboard
  -> /api/admin/*
  -> admin.js + auth/role middleware
  -> user/provider/KYC/booking/plan/refund/promotion operations
  -> Prisma database writes + notifications
  -> refreshed admin view
```

Admin changes can have broad impact. For plan, scheduling, KYC, refund, or booking changes, inspect both upstream UI callers and downstream model/service rules before editing.

Primary files:

- `frontend/src/pages/AdminDashboard.jsx`
- `backend/src/routes/admin.js`, `refunds.js`, `promotions.js`
- `backend/src/services/scheduling.js`, `notify.js`, `paymentContracts.js`

