# Confirmed Product Rules

Confirmed with the product owner on 2026-08-23. These rules override older notes when they conflict.

## Roles and authority

- There is no Super Admin role.
- Customer, Provider, and Admin are the application roles.
- Admin can perform all administrative operations, including customer/provider management, plans, bookings, provider assignment, KYC, refunds, promotions, reports, support, and scheduling.
- Customers can buy subscription plans and book services.
- Providers fulfil automatically assigned customer bookings.
- Providers must keep an approved KYC record to access operational work.

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
- PayHere and NOWPayments are the supported production payment gateways; demo is the local/test payment flow.
- Credits are deducted when a booking is created/confirmed according to the service category.
- Buying or renewing a package creates or renews the corresponding credit entitlements.
- Admin manages package title, type, price, description, coins, and recommendation badge; package duration is fixed at 30 days.
- PayHere checkout requires public HTTPS return, cancel, and webhook URLs before it can be enabled.

## Notifications & Account Verification

Purchasing, booking, assignment, status changes, payment events, and other customer/provider/admin operational events create notifications through the backend notification flow. Confirmed integrations are Resend email and Google sign-in. Phone numbers are stored as standard profile contact info without SMS/OTP verification.

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
- NOWPayments
- Development demo-payment mode

## Implementation audit (2026-08-25)

The confirmed rules are implemented in the current contract surface:

- Admin owns scheduling and plan management without an additional administrator tier.
- Demo, PayHere, and NOWPayments are the supported payment flows.
- Provider earnings are fixed per configured service and captured on the booking when it is created.
- Providers select a bank account, monthly payout records are queued idempotently on the 31st when `PAYOUT_SCHEDULER_ENABLED=true`, and Admin can review/settle the payout ledger.
- **KG navigation:** use `AGENT_NAVIGATION_MAP.md` for request paths and trace every feature through route, service, schema, and UI before editing.
