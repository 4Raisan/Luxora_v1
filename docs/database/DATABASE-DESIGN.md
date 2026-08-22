# Luxora database design
PostgreSQL is managed through Prisma. backend/prisma/schema.prisma is canonical; generated client code is not hand-edited.
## Relationship map
User -> optional Provider, UserSubscription, Payment, Booking, Complaint, Review, SupportTicket, Notification, RefundRequest, PasswordResetToken.
SubscriptionPlan -> SubscriptionEntitlement -> Category. UserSubscription -> plan, user, bookings, payments, and one RefundRequest. Booking -> Service -> Category, optional Provider/Subscription, Photos and Review. PlatformSetting is a singleton.
## Important models
| Model | Meaning | Invariant |
|---|---|---|
| User | Account/profile/role | email unique; role plus isSuperAdmin |
| Provider | KYC/towns/availability/earnings | one-to-one with User |
| Category/Service | Catalogue | service belongs to category |
| SubscriptionPlan | Individual/combo package | price/duration/active/entitlements |
| SubscriptionEntitlement | Units per category | unique plan/category |
| UserSubscription | Purchased package | dates/status/renewal |
| Payment | Gateway attempt/state | unique gateway order/idempotency |
| Booking | Service request | owner/service/provider/subscription |
| RefundRequest | Refund decision | unique subscription |
| Notification | User event | recipient-scoped |
## Invariants
Booking consumes only the matching purchase entitlement. Expired/cancelled/disabled/refunded purchases cannot be used. Refund eligibility is evaluated for the exact purchase: any used unit makes individual or combo ineligible; partial combo refunds are not invented. Demo success/failure/cancel and PayHere callback behavior are backend-controlled.
## Migration workflow
    npx prisma format
    npx prisma validate
    npx prisma generate
    npx prisma migrate dev --name describe_change
    npx prisma migrate deploy
Use db:push only for disposable local synchronization. Never rewrite applied migrations. Review foreign keys, delete behavior, uniqueness, indexes, and rollback/backup plans.
## Performance and safety
Use the singleton Prisma client; never instantiate per request. Hosted DATABASE_URL should include connection_limit=5 and pool_timeout=10. Never commit env files, dumps, uploads, or real personal/payment data.
