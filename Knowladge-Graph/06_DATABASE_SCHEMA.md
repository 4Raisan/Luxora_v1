# Database and Persistence Map

Related: [Agent start](00_AGENT_START.md) · [Customer booking](02_CUSTOMER_BOOKING_FLOW.md) · [Provider fulfilment](03_PROVIDER_FULFILLMENT_FLOW.md) · [Admin operations](04_ADMIN_OPERATIONS_FLOW.md) · [API contracts](05_API_CONTRACTS.md) · [Runtime and deployment](07_RUNTIME_DEPLOYMENT.md)

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
5. Run `npm run graph:verify`.

