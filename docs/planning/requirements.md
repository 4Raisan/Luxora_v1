# Luxora requirements and acceptance rules

## Roles

Customers maintain contact/address data, buy packages, view entitlements, book services, retrieve their Service PINs, manage eligible bookings/subscriptions, and use reviews, complaints, support, notifications, receipts, and refunds. Providers submit KYC, configure service towns/availability/bank details, fulfil only assigned work with required evidence and PINs, and view earnings/payouts. Admin performs all administrative operations; there is no Super Admin.

## Payments and entitlements

Plans are 30-day individual-category or combo packages priced in LKR. Only server-verified demo, PayHere, or NOWPayments settlement creates a subscription. Booking consumes one matching unit. Refund/cancellation state immediately changes server-authoritative eligibility. Cross-currency captured values are never combined as one revenue amount.

## Booking

Creation validates future date/time, customer address/town, active category entitlement, duplicate submission, provider category/town/KYC/availability, cooldown, and time conflicts. A booking is persisted as `ASSIGNED` when a provider is safely selected or `PENDING` when none is available. Start requires assigned provider, BEFORE evidence, and the start PIN; completion requires AFTER evidence and the completion PIN. Lockout, replay, ownership, state transition, and exactly-once earnings are enforced server-side.

## Security and reliability

JWT identity/role/active state come from PostgreSQL on every request. Password reset revokes old sessions. Uploads are private, ownership checked, magic-byte validated, and size limited. Webhooks verify signature, identity, amount, currency, state, and idempotency. Secrets remain backend-only. Migrations, isolated automated tests, lint, build, graph generation, and live non-mutating checks are release gates.
