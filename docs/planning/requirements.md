# Luxora requirements and acceptance rules

## Roles

Customers maintain contact/address data, buy packages, view entitlements, book services, retrieve their Service PINs, manage eligible bookings/subscriptions, and use reviews, complaints, support, notifications, and receipts. Providers submit KYC, configure service towns/availability/bank details, fulfil only assigned work with required evidence and PINs, and view earnings/payouts. Admin performs all administrative operations; there is no Super Admin. There are no customer cash refunds in V1; eligible cancellations restore service coins only.

## Payments and entitlements

Plans are 30-day individual-category or combo packages priced in LKR. Only server-verified demo, PayHere, or NOWPayments settlement creates a subscription. Booking consumes one matching unit. Cancellation state immediately changes server-authoritative eligibility; no cash refunds are issued. Cross-currency captured values are never combined as one revenue amount.

## Booking

Creation validates a server-enforced minimum lead time of 4 hours (exactly 4 hours ahead is allowed), future date/time, customer address/town, active category entitlement, duplicate submission, provider category/town/KYC/availability, cooldown, and time conflicts. A booking is persisted as `ASSIGNED` when a provider is safely selected or `PENDING` when none is available. Start requires assigned provider, BEFORE evidence, and the start PIN; completion requires AFTER evidence and the completion PIN. Lockout, replay, ownership, state transition, and exactly-once earnings are enforced server-side.

## Cancellation, HOLD, timeouts, and scheduling

Customers may cancel `PENDING` or `ASSIGNED` bookings before start with no fee; `IN_PROGRESS`, `COMPLETED`, and `CANCELLED` cannot be cancelled and `CANCELLED` is terminal. Providers may cancel only their own `ASSIGNED` future booking with at least 4 hours notice; a replacement is attempted first and the coin restores only when none is found. Providers cannot go offline with an `IN_PROGRESS` job or an assigned booking within 4 hours; further-out assignments reroute. Admin customer HOLD cancels `PENDING`/`ASSIGNED` (never `IN_PROGRESS`) and blocks new bookings; admin provider HOLD cancels ≤4h assignments with coin restore and reroutes later ones, leaving `IN_PROGRESS` untouched; both are idempotent. A booking still `PENDING` at its scheduled start is cancelled immediately with coin restore and customer notice. Rescheduling cancels the old booking once and creates an independent new booking that must also satisfy the 4-hour minimum. Auto-assignment runs 07:00–16:00 Asia/Colombo with a 5-hour per-provider cooldown; manual claims bypass the cooldown.

## Security and reliability

JWT identity/role/active state come from PostgreSQL on every request. Password reset revokes old sessions. Uploads are private, ownership checked, magic-byte validated, and size limited. Webhooks verify signature, identity, amount, currency, state, and idempotency. Secrets remain backend-only. Migrations, isolated automated tests, lint, build, graph generation, and live non-mutating checks are release gates.
