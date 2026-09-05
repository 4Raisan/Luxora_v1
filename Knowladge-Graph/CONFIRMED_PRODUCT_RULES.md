# Confirmed Product Rules

Confirmed with the product owner on 2026-08-23. These rules override older notes when they conflict.

## Roles and authority

- There is no Super Admin role.
- Admin can perform all administrative operations, including customer/provider management, plans, bookings, provider assignment, KYC, promotions, reports, support, and scheduling.
- **Refund Policy**: There are **no refunds in V1**. All package purchases are final.
- Customers can buy subscription plans and book services.
- Providers fulfil automatically assigned customer bookings.
- Providers must keep an approved KYC record to access operational work.
- **Provider Availability**: Providers have two availability states: `ONLINE` (`available`) and `OFFLINE` (`offline`). When `OFFLINE`, no new jobs are auto-assigned. Providers cannot switch to `OFFLINE` if they have a service in progress or an assigned booking scheduled within 6 hours. When switching to `OFFLINE` (at least 6 hours before any assigned job), all future assigned bookings are automatically reassigned to other eligible online providers.
- **Customer Contact Information**: Customer phone numbers are visible on assigned booking cards across the Provider Dashboard so providers can coordinate service delivery.
- **Pet Care Modes**: Pet care bookings support explicit `Dog Care` (`dog`) and `Cat Care` (`cat`) modes, persisted on the booking record (`petType`) and displayed across customer, provider, and admin dashboards.
- **Provider Booking Cancellation**:
  - A provider can cancel only their own **assigned** future booking (`status === 'ASSIGNED'`).
  - Cancellation is blocked when fewer than **4 hours** remain before the scheduled booking time (`PROVIDER_CANCELLATION_NOTICE_HOURS = 4`).
  - Providers cannot cancel bookings that are in progress or completed.
  - Direct cancellation action: No admin cancellation request or cancellation-reason form is used.
  - When a valid provider cancellation occurs:
    1. Luxora searches for another eligible, approved, available provider who serves the same category and area and has no schedule conflict.
    2. If found, the booking is automatically reassigned and remains `ASSIGNED`.
    3. If none is found, the booking becomes `CANCELLED`.
    4. A cancelled booking no longer consumes the customer’s subscription entitlement, so the token is restored automatically.
    5. The provider, customer, and admin dashboards receive updates and notifications via Server-Sent Events (SSE).
- **Customer Custom Requests**: Customers can submit and track bespoke concierge service requests via `/customer-requests`, monitoring status progression across `Awaiting Provider`, `Provider Assigned`, and `Completed`.

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

Bookings cannot be cancelled once they are `IN_PROGRESS`. Customer cancellations are permitted while `PENDING` or `ASSIGNED`. Provider cancellations are permitted while `ASSIGNED` with at least 4 hours notice. Cancellation and entitlement restoration rules are enforced server-side within database transactions.

## Plans, credits, and payments

- Subscription plans are the purchasing model.
- Demo payment is used for development/testing.
- PayHere and NOWPayments are the supported production payment gateways; demo is the local/test payment flow.
- Credits are deducted when a booking is created/confirmed according to the service category.
- Buying or renewing a package creates or renews the corresponding credit entitlements.
- Admin manages package title, type, price, description, coins, and recommendation badge; package duration is fixed at 30 days.
- PayHere checkout requires public HTTPS return, cancel, and webhook URLs before it can be enabled.
- Official PayHere Sandbox testing instruments (non-production testing reference only): Visa (`4916217501611292`), MasterCard (`5307732125531191`), AMEX (`346781005510225`), Expiry: Any future date, CVV: Any 3 digits.

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
