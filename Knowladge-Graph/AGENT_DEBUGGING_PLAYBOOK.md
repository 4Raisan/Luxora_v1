# Agent Debugging & Implementation Playbook

This playbook provides actionable procedures for AI Coding Agents and developers to implement features, fix bugs, and debug errors in the Luxora repository with zero regressions.

---

## 1. The Blast Radius Check (Before Writing Code)

Before modifying any file, identify its position in the Knowledge Graph:
1. Open `Knowladge-Graph/knowledge-graph.json` or run `node Knowladge-Graph/generate-graph.js`.
2. Inspect **Upstream Callers** (who depends on this file?) and **Downstream Dependencies** (what does this file call?).
3. Ensure that changes to contracts, parameters, or schema fields are updated along the entire dependency path.

### Example Blast Radius Table:
| If you edit this file... | You MUST verify and update... |
| :--- | :--- |
| `backend/prisma/schema.prisma` | Run `npx prisma db push`, update relevant `backend/src/routes/*.js`, backend services, and frontend state. |
| `backend/src/services/entitlements.js` | Check `routes/bookings.js`, `routes/customer.js`, `routes/refunds.js`, `CustomerDashboard.jsx`. |
| `backend/src/services/scheduling.js` | Check `routes/bookings.js`, `routes/admin.js`, `ProviderDashboard.jsx`, `AdminDashboard.jsx`. |
| `frontend/src/services/api.js` | Check all `frontend/src/pages/*.jsx` and `frontend/src/components/*.jsx`. |
| `backend/src/middleware/auth.js` | Check token verification across all gated routes and role constants in `frontend/src/services/roles.js`. |

---

## 2. Common Debugging Paths & Graph Traversals

### Scenario A: `403 Forbidden` / `401 Unauthorized` on API Calls
1. **Frontend Call**: Check which page is making the request (e.g. `ProviderDashboard.jsx`).
2. **Auth Token Header**: Ensure `localStorage.getItem('token')` exists and is sent via `Authorization: Bearer <token>`.
3. **Route Gate**: Look up the endpoint in [Knowladge-Graph/ARCHITECTURE_GRAPH.md](file:///C:/Users/hdgan/OneDrive/Desktop/lucxx/Knowladge-Graph/ARCHITECTURE_GRAPH.md).
4. **Role Check**: Check if the route uses `authenticateToken`, `requireRole(['...'])`, or `requireKycApproved`. Verify the user's role in DB `User.role` or `Provider.kycStatus`.

### Scenario B: Entitlement or Booking Balance Discrepancy
1. Check `backend/src/services/entitlements.js` $\rightarrow$ `getUserEntitlements(userId)`.
2. Trace:
   - `UserSubscription` (must be `status: 'active'` and `endDate > NOW()`).
   - `SubscriptionEntitlement` (total units allocated for category).
   - Count active/completed `Booking` records matching that `subscriptionId` and `service.categoryId`.
3. Verify if cancelled bookings properly release units back to the available pool.

### Scenario C: Provider Job Auto-Assignment Issues
1. Check `backend/src/services/scheduling.js` $\rightarrow$ `autoAssignProvider(bookingId)`.
2. Requirements for provider selection:
   - `kycStatus === 'APPROVED'`
   - `serviceTowns` contains the booking's `town`
   - `availabilityStatus === 'available'`
   - No conflicting active booking at that date/time
   - Current time within `PlatformSetting` window (`autoAssignmentStartHour` to `autoAssignmentEndHour`).

### Scenario D: Payment Webhook Failures (PayHere / PayPal)
1. Check `backend/src/routes/integrations.js` and `backend/src/services/paymentContracts.js`.
2. Check `Payment.idempotencyKey` and `Payment.gatewayOrderId`.
3. Check status transitions: `PENDING` $\rightarrow$ `COMPLETED` / `FAILED`. Ensure webhook handles duplicate deliveries idempotently.

---

## 3. Safe Feature Implementation Steps

When adding a new feature (e.g., adding an SMS notification or a new booking filter):

```
Step 1: Database Model / Schema Update (if needed)
        └── backend/prisma/schema.prisma -> db:push -> prisma:generate

Step 2: Service / Business Logic
        └── backend/src/services/<service>.js (isolated, testable helper)

Step 3: Route Handler & Validation Middleware
        └── backend/src/routes/<route>.js (wire endpoint with auth & rateLimit)
        └── backend/src/index.js (mount route if new file)

Step 4: Frontend API Call & State Management
        └── frontend/src/services/api.js or page handler
        └── frontend/src/pages/<Page>.jsx

Step 5: Regenerate Knowledge Graph
        └── Run `npm run graph` to verify all new connections are linked.
```
