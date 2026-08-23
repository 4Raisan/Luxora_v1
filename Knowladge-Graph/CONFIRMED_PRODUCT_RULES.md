# Confirmed Product Rules

Confirmed with the product owner on 2026-08-23. These rules override older notes when they conflict.

## Roles and authority

- There is no Super Admin role.
- Customer, Provider, and Admin are the application roles.
- Admin can perform all administrative operations, including customer/provider management, plans, bookings, provider assignment, KYC, refunds, promotions, reports, support, and scheduling.
- Customers can buy subscription plans and book services.
- Providers fulfil automatically assigned customer bookings.

## Booking flow

```text
Customer selects service
  -> backend validates customer, town, entitlement/payment rules
  -> Booking is persisted as PENDING
  -> scheduling logic automatically assigns an eligible provider
  -> ASSIGNED
  -> provider starts with the customer start PIN and required before evidence
  -> IN_PROGRESS
  -> provider completes with completion PIN and after evidence
  -> COMPLETED
  -> provider earnings are credited
```

Bookings cannot be cancelled once they are `IN_PROGRESS`. Cancellation and entitlement restoration rules must be enforced server-side.

## Plans, credits, and payments

- Subscription plans are the purchasing model.
- Demo payment is used for development/testing.
- PayHere is the production payment gateway; no PayPal flow is part of the confirmed product.
- Credits are deducted when a booking is created/confirmed according to the service category.
- Buying or renewing a package creates or renews the corresponding credit entitlements.

## Notifications

Purchasing, booking, assignment, status changes, payment events, and other customer/provider/admin operational events should create notifications through the backend notification flow. Confirmed integrations are Resend email and Google sign-in; SMS is not confirmed as active.

## Provider earnings and profile data

- Each provider has a fixed configured earning amount per service/category (for example auto, pet, and garden).
- Earnings update after a service reaches `COMPLETED`.
- A monthly withdrawal runs on the 31st to the provider's selected bank account; this requires persisted bank-selection/payout data and a server-side job or scheduler.
- Customers may update mobile number, address, and town.
- Providers may update mobile number, address, town selection, and display name.

## Confirmed integrations

- Google sign-in
- Resend
- PayHere
- Development demo-payment mode

## Implementation audit (2026-08-23)

The rules above are the product source of truth. The current repository still has these contract gaps, which agents must treat as open implementation work rather than completed behavior:

- **Role authority gap:** the schema, auth middleware, admin routes, and admin UI still contain `isSuperAdmin` / “Super admin” scheduling gates. Those routes must be moved to the normal Admin authority and the obsolete concept removed or made inert.
- **Payment cleanup gap:** PayHere and demo mode are wired, but PayPal enum/helpers remain in the Prisma schema and integration service. PayPal must not be exposed or selected by application flows.
- **Earnings gap:** completed-job earnings currently use a global 85% of booking total. This does not implement provider/category fixed rates; rates and the credited amount need persisted configuration and a server-side calculation.
- **Payout gap:** no confirmed monthly-31st withdrawal ledger, selected-bank model, idempotent payout run, or provider payout history was found in the current contract surface. These need to be designed before claiming automatic withdrawal is complete.
- **KG navigation:** use `AGENT_NAVIGATION_MAP.md` for request paths and trace every feature through route, service, schema, and UI before editing.
