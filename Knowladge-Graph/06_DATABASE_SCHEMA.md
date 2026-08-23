# Database and Persistence Map

Related: [[00_AGENT_START]] · [[02_CUSTOMER_BOOKING_FLOW]] · [[03_PROVIDER_FULFILLMENT_FLOW]] · [[04_ADMIN_OPERATIONS_FLOW]] · [[05_API_CONTRACTS]] · [[07_RUNTIME_DEPLOYMENT]]

`backend/prisma/schema.prisma` is the persistence contract. Prisma is the only application path to PostgreSQL.

Core relation groups:

```text
User -> Provider -> KycDocument
User -> UserSubscription -> SubscriptionEntitlement -> SubscriptionPlan
User -> Booking -> Service -> Category
Booking -> ServicePhoto / Payment / Review / RefundRequest
User -> Notification / SupportTicket / Complaint
```

Schema change procedure:

1. Change `schema.prisma` and preserve relations, indexes, and enum semantics.
2. Run Prisma generation and schema sync/migration via the project scripts.
3. Update route validation and service logic.
4. Update real frontend API handling and all affected states.
5. Run `npm run graph`.

