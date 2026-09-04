# Luxora Business Logic Reference

**Status:** current implementation reference  
**Repository:** Luxora  
**Last reviewed:** 2026-09-04  
**Scope:** customer, provider, admin, catalogue, subscription, payment, booking, fulfilment, support, payout, notification, security, and operational rules.

This document consolidates the product rules and the rules enforced by the current code. It is intended to be read with [`CONFIRMED_PRODUCT_RULES.md`](./CONFIRMED_PRODUCT_RULES.md), [`AGENT_NAVIGATION_MAP.md`](./AGENT_NAVIGATION_MAP.md), the backend routes/services, and [`schema.prisma`](../backend/prisma/schema.prisma).

## 1. Authority and interpretation

Use these sources in this order when making a product or code decision:

1. A newer explicit product decision from the product owner.
2. This reference after it has been regenerated from the current code.
3. `CONFIRMED_PRODUCT_RULES.md` for confirmed product intent.
4. Backend route and service behavior for enforced server rules.
5. Prisma schema for persistence, relations, and enum constraints.
6. Frontend behavior for presentation and client-side validation only.

The backend is authoritative for authentication, authorization, payment settlement, entitlements, provider assignment, booking state, PIN verification, earnings, and payout balances. The frontend must not invent data or replace a backend failure with a success state.

## 2. Product model

Luxora is a subscription-based home concierge platform. Customers purchase packages containing category-specific service units (“coins” in the UI), then redeem those units by booking services. Providers fulfil assigned work. Admin operates the catalogue, provider network, scheduling, complaints, reporting, and payout ledger.

The care categories currently represented by the product are:

- Auto Care
- Garden Care
- Pet Care

Pet Care bookings support explicit `dog` and `cat` modes. The value is persisted on `Booking.petType` and shown to customer, provider, and admin views.

## 3. Roles and permissions

### Customer

Customers may:

- Register, sign in, reset their password, or use Google sign-in.
- View categories, services, packages, and active promotions.
- Purchase packages through a verified payment flow.
- View entitlements, payments, bookings, notifications, support, complaints, and profile data.
- Create, cancel, and reschedule their own eligible bookings.
- View the appropriate active booking PIN.
- Submit a review after a completed service.
- Create support tickets, complaints, and bespoke service requests.
- Update their mobile number, address, and town.

Customers cannot access provider operations or admin operations.

### Provider

Providers may:

- Register with one to three valid service categories and service coverage.
- Upload KYC documents while their KYC is pending.
- Operate only after KYC approval.
- View assigned bookings and eligible pending bookings.
- Claim eligible pending bookings.
- Start and complete assigned services using evidence and customer PINs.
- Set availability, categories, towns/provinces, display name, and mobile number.
- View earnings and payout history.
- Add/select a bank account and request a redemption.
- View and complete eligible bespoke service requests.
- Receive support updates and notifications.

Providers cannot perform admin operations or view another provider’s private data.

### Admin

There is no Super Admin role. An authenticated active `ADMIN` may perform all administrative operations:

- Manage users and account activation.
- Review provider KYC and documents.
- Manage services, categories, packages, promotions, and display order.
- Configure scheduling windows and cooldowns.
- Assign, unassign, cancel, and administratively update bookings.
- Manage complaints and support tickets.
- Review ratings and reports.
- Queue and settle provider payouts.
- Inspect audit logs.

## 4. Identity, registration, and sessions

### Registration

`POST /api/auth/register` accepts customer or provider registration. Admin self-registration is not allowed.

Common rules:

- Name is required and capped at 100 characters.
- Email must be valid and is trimmed/lowercased.
- Email must be unique.
- Password must pass the shared password validator.
- Phone is normalized where possible.
- Town must be from the Sri Lankan location list when supplied.

Provider-specific rules:

- Role is `PROVIDER` only when explicitly requested; otherwise registration creates a customer.
- One to three valid category names are required.
- Service towns are normalized, deduplicated, and capped at ten.
- Provider town must be a valid Sri Lankan town.
- The provider record is created with `PENDING` KYC.
- Active admins receive a new-provider notification.
- A provider-registration email is attempted.

Customer registration creates a ready customer account and attempts a welcome email.

### Login and authorization

`POST /api/auth/login` checks the database user, bcrypt password hash, and active flag. A successful login returns a JWT valid for seven days. The token includes user identity, role, name, and token version.

Every protected request:

- Requires a bearer token.
- Verifies JWT signature and expiry.
- Reloads the user from the database.
- Rejects inactive users.
- Rejects a stale token version.
- Enforces route-specific role checks.

Provider routes add an approved-KYC gate. KYC document upload is the exception: pending providers may upload documents.

### Google sign-in

Google sign-in is customer-only. The server verifies the Google ID token against the configured client ID, verified email state, and expiry. Existing provider/admin emails cannot be converted through Google sign-in. A new Google customer receives a random internal password and a normal customer JWT.

### Password reset

Password-reset requests always return the same generic message to prevent account enumeration. Existing users receive a single-use token that:

- Is stored as a SHA-256 hash.
- Expires in 15 minutes.
- Is consumed atomically.
- Invalidates older unused reset tokens for that user.
- Increments `User.tokenVersion`, revoking existing sessions.

## 5. Profile and location rules

Customers may update phone, street address, district, and town. Providers may update phone, street address, town, display name, categories, and service coverage.

Location values are normalized against the Sri Lankan town/province catalogue. Provider coverage may be expressed as:

- Individual towns, maximum ten; or
- Province coverage, represented as `province:<district/province>` internally.

The customer phone number is part of the assigned booking information visible to the assigned provider for service coordination.

## 6. Catalogue, services, packages, and entitlements

### Categories and services

Categories and services are publicly readable. Each service has:

- Category
- Title and description
- Customer price
- Duration in minutes
- Fixed provider earning amount

### Subscription packages

Packages are the purchasing model. Every package runs for exactly 30 days.

Canonical package types:

- `Auto Care`
- `Garden Care`
- `Pet Care`
- `Combo Package`

Single-category packages must contain exactly one matching category entitlement. Combo packages must contain at least two distinct category entitlements. Every entitlement must have a valid category and at least one unit. A category cannot appear twice in the same package.

Admin controls package title, type, price, description, features, recommendation badge, active flag, display order, and category units. Features are stored as JSON and normalized to a maximum of 20 entries, each at most 160 characters.

An active package is shown publicly. A package with user-subscription or payment history cannot be deleted; it must be disabled instead. Subscription catalogue responses are cached for 60 seconds and invalidated after admin package changes.

### Entitlement accounting

An active subscription is one with:

```text
status = active
endDate > current time
```

The entitlement snapshot groups active subscription units by category. Usage is counted from non-cancelled bookings linked to the subscription and category. A booking is bookable only when the customer has remaining units for the requested service category.

The server selects a specific subscription entitlement during booking creation and stores its subscription ID on the booking. Cancelled bookings no longer count as usage, which restores the unit without a separate credit mutation.

If a user-level entitlement row is absent, the system falls back to the plan-level entitlement definition for compatibility with older data.

## 7. Promotions and pricing

A promotion is eligible when:

- `active = true`;
- `startsAt` is empty or has passed; and
- `endsAt` is empty or has not passed.

Promotions may be catalogue-wide or assigned to specific plans. When multiple eligible promotions apply, the highest percentage discount wins; a tie is resolved by newest creation time.

Discounts are percentage-based and rounded to two decimal places using half-up rounding. The payment record stores original amount, discount amount, promotion ID, expected amount, and expected currency.

## 8. Payment and subscription activation

Supported gateways/modes:

- `DEMO` for local/test checkout
- `PAYHERE`
- `NOWPAYMENTS`

### General payment rules

- A payment starts as `PENDING`.
- The server stores an idempotency key and unique gateway order ID.
- Rapid duplicate requests within 15 seconds reuse the pending payment/order.
- Expected amount and currency are authoritative.
- Benefits are never granted from a browser redirect alone.
- A verified successful gateway event activates the subscription atomically.
- A duplicate successful callback is acknowledged without double activation.
- Receipts and notifications are attempted after activation.
- Email failure does not roll back a settled payment.

### Demo payments

Demo mode creates a server-side payment order and completes it through the demo completion endpoint. No real money is charged. Demo completion calls the same subscription activation and receipt flow as a verified gateway payment.

When demo mode is enabled, due subscriptions with auto-renew enabled can be renewed by the demo renewal job. The old subscription becomes expired, a new 30-day subscription is created with copied entitlements, and a completed demo payment is recorded.

### PayHere

PayHere order creation requires:

- Customer authentication
- Active plan
- Payment mode not set to demo
- Configured public HTTPS return, cancel, and webhook URLs

PayHere webhooks require a valid signature. Status code `2` is a successful charge; `-1` and `-2` are failed states. Amount and currency must match the pending payment before activation.

### NOWPayments

NOWPayments order creation requires configured API and IPN secrets. LKR pricing is converted through the currency service for the crypto invoice. The IPN must have a valid HMAC-SHA512 signature and matching order/payment identity. The server then performs authoritative NOWPayments status verification before activating benefits.

### Subscription activation

Successful activation creates:

- A 30-day active `UserSubscription`;
- User subscription entitlement rows copied from the plan;
- A completed payment state;
- Customer notification;
- Receipt data and email attempt.

The direct `/subscriptions/subscribe` activation endpoint intentionally returns `410`; direct activation without verified payment is disabled.

## 9. Booking creation and validation

Only customers can create normal bookings.

Required rules:

- Valid positive service ID.
- Valid `YYYY-MM-DD` date.
- Today or a future date.
- Time in a 15-minute interval.
- Existing service record.
- Active entitlement with remaining units in the service category.
- No non-cancelled duplicate for the same customer, service, date, and time.

The customer’s saved town/address is copied onto the booking. Pet type is normalized and persisted for Pet Care bookings.

The booking transaction locks/rechecks the entitlement and performs duplicate protection inside a serializable transaction. This prevents double-spending units and concurrent duplicate bookings.

The booking stores the service price and the provider earning amount at creation time. Later service-rate changes do not change historical bookings.

Two six-digit PINs are generated:

- Start PIN
- Completion PIN

The server stores bcrypt hashes and encrypted customer copies. The customer receives the start PIN only when the booking is assigned; the completion PIN is revealed only while the booking is in progress.

## 10. Provider assignment and scheduling

Automatic assignment runs only inside the platform assignment window. Defaults are:

- Start hour: 07:00
- End hour: 16:00
- Auto-assignment cooldown: 6 hours

Admin may set a cooldown from 1–24 hours and valid start/end hours from 0–23, with start not after end.

An automatically eligible provider must be:

- KYC approved;
- Active;
- Online/available;
- Offering the service category;
- Serving the booking town or matching province/district;
- Free from overlapping assigned/in-progress work;
- Outside the provider’s latest same-day auto-assignment cooldown.

The scheduler selects the least-loaded eligible provider. Provider selection occurs in the same serializable transaction as booking creation so two concurrent customers cannot select the same apparent slot.

If no eligible provider is found, the booking remains `PENDING`. Read routes and the timeout scheduler retry assignment before the pending deadline.

## 11. Booking state machine and fulfilment

Normal provider lifecycle:

```text
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
```

Provider status transitions are strictly sequential. A provider may not skip states or operate on a booking not assigned to them.

### Assigned to in progress

The provider must:

- Be the assigned provider;
- Pass the start PIN;
- Upload at least one `BEFORE` photo;
- Start within two hours after scheduled start.

### In progress to completed

The provider must:

- Pass the completion PIN;
- Upload at least one `AFTER` photo;
- Complete within two hours after expected service end.

On completion, the booking becomes `COMPLETED`, the provider earning captured on the booking is added to provider earnings, and the customer is notified to leave a review.

### PIN security

- Maximum five failed PIN attempts.
- After five failures, verification is locked for 15 minutes.
- Attempts reset after the lock period or successful verification.
- Expired PINs cannot be used.
- PIN mutations are serialized with a per-booking advisory lock.

## 12. Timeout and automatic cancellation rules

The booking timeout service scans active bookings initially and every 60 seconds. Read routes also trigger a throttled scan, at most once every 30 seconds.

Timeouts:

- `PENDING`: cancel 30 minutes after scheduled start if still unassigned.
- `ASSIGNED`: cancel two hours after scheduled start if not started.
- `IN_PROGRESS`: cancel two hours after expected service end if not completed.

Timeout cancellation stores a reason, restores the entitlement through the non-cancelled usage calculation, notifies the customer/provider, and attempts customer email.

## 13. Customer cancellation and rescheduling

Customers may cancel only `PENDING` or `ASSIGNED` bookings. Cancellation is terminal and not allowed after service starts or after completion.

Rescheduling requires:

- Explicit confirmation;
- Valid future date;
- 15-minute time interval;
- Reason of 3–500 characters;
- No duplicate booking for the new slot.

Rescheduling cancels the old booking, creates a new booking with the same service/subscription entitlement, generates fresh PINs, and reruns automatic assignment. The old cancellation reason records the new schedule and customer reason.

V1 product policy: package purchases are final and there are no customer refunds.

## 14. Provider availability and coverage

Provider availability states are:

- `available` / online
- `offline`

Offline providers receive no new automatic assignments. A provider cannot switch offline while:

- A service is in progress; or
- An assigned booking starts within six hours.

When a provider safely switches offline, future assigned bookings are reassigned or returned to the eligible pending pool.

Manual pending-booking claims still apply the category, town, active-account, KYC, and time-conflict checks. The online requirement is relaxed for this explicit manual claim path.

## 15. KYC and provider onboarding

KYC states:

```text
PENDING → APPROVED
PENDING → REJECTED
REJECTED → PENDING/APPROVED after review
```

Admins may approve, reject, or reset KYC. Rejection requires a 3–500 character reason. Approval unlocks operational work and sends notification/email. Rejection reassigns or unassigns the provider’s future operational bookings and sends the reason.

KYC uploads:

- JPEG, PNG, or PDF only;
- Maximum 5 MB per file;
- Maximum three documents per request;
- Stored through private local/S3-compatible storage;
- Retrieved through authenticated upload routes.

## 16. Bespoke service requests

Customers can request a service outside the standard package booking flow.

Requirements:

- Subject and notes;
- Valid category;
- Today/future preferred date;
- 15-minute preferred time;
- Customer town already saved.

The request remains open and unassigned until an eligible provider claims it. Eligibility checks provider KYC, active account, category, location, and schedule. A custom request has a one-hour service duration and a two-hour buffer against normal bookings and other accepted custom requests.

Claiming is concurrency-safe. The assigned provider can complete the request, changing it to resolved and notifying customer/admin/provider.

## 17. Provider earnings, bank accounts, and payout ledger

Each booking stores a fixed provider earning copied from the service at booking creation. Earnings increase only when the booking reaches completed, with an atomic guard against duplicate completion credit.

Bank-account rules:

- Provider must supply a supported bank, account holder, account number, and branch.
- Account number is encrypted with AES-256-GCM at rest.
- A keyed hash supports blind deduplication/lookup.
- Only one account is selected at a time.
- API responses mask account numbers to the last four digits.
- Production requires `BANK_ENCRYPTION_KEY`.

Redemptions:

- Minimum request: LKR 5,000.
- Amount cannot exceed available earnings.
- A selected bank account is required.
- Requested amount is deducted atomically and placed in a pending payout ledger row.
- Admin is notified.

Monthly payouts:

- Run on the last calendar day of the month when the scheduler is enabled.
- Include providers with positive earnings and a selected bank account.
- Create at most one monthly payout per provider/period.
- Deduct the queued amount from the provider balance.
- Snapshot bank details for the ledger.
- Admin marks the payout `PAID` or `FAILED`.
- A failed payout restores the exact amount to provider earnings.

## 18. Reviews, complaints, and support

### Reviews

Only the customer who owns a booking can review it. The booking must be completed and have a provider. Rating is an integer from 1–5, comment is optional and capped at 1,000 characters, and the booking has one review maximum.

### Complaints

Customers can create complaints with or without a booking reference. The referenced booking must belong to the customer. Subject is capped at 150 characters and description at 2,000 characters.

Complaint states:

```text
OPEN → IN_REVIEW → RESOLVED
```

Admins may add a response note. Resolution notifies the customer.

### Support tickets

Support tickets contain subject, message, priority, status, and optional admin response.

Priorities: `LOW`, `NORMAL`, `HIGH`, `URGENT`.  
Statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.

Rapid duplicate ticket/complaint submissions within 15 seconds are deduplicated.

## 19. Notifications, email, and realtime

Notifications are persisted for operational events including registration, KYC decisions, payments, subscription activation, booking creation/assignment/status, cancellation, completion, complaints, support updates, service requests, and payouts.

Notification writes are non-fatal: a notification failure must not undo the business transaction.

Realtime booking, service-request, and payout events are broadcast through the SSE/realtime service. Email uses Resend when configured. Email failure is logged and does not reverse a completed transaction.

## 20. Admin reporting and audit

Admin statistics and reports include:

- Customer/provider counts;
- Pending providers;
- Active subscriptions;
- Total/completed bookings;
- Settled revenue in LKR;
- Open complaints;
- Average rating and review count;
- Popular services;
- Provider performance.

Important admin mutations create an `AdminAuditLog` entry with admin ID, action, target type/ID, details, IP address where available, and timestamp.

## 21. Account deactivation behavior

Admins cannot deactivate their own account through the user toggle.

When a customer is deactivated:

- Active pending/assigned/in-progress bookings are cancelled.
- Customer and assigned provider are notified.
- Cancelled bookings no longer consume entitlement units.

When a provider is deactivated:

- The provider’s future assignments are reassigned or unassigned.
- The provider cannot receive new operational work.

## 22. Upload and storage rules

Booking photos accept JPEG/PNG and are limited to five files per upload request, with a 5 MB per-file limit. File signatures are checked rather than trusting only the client MIME type.

Storage uses configured S3-compatible private storage when available and a local `private-uploads/` fallback for development. Authenticated routes are required to retrieve protected KYC and service-photo files.

## 23. Security and integrity rules

- JWT authentication and fresh database authorization checks protect private routes.
- Role checks are enforced server-side.
- Provider operations require approved KYC.
- Passwords use bcrypt; reset tokens are hashed.
- PINs use bcrypt hashes plus encrypted customer copies.
- Bank account numbers use AES-GCM encryption and masked responses.
- PayHere and NOWPayments callbacks require signature verification.
- Serializable transactions and advisory locks protect entitlement use, booking claims, booking lifecycle/PIN updates, bank selection, redemptions, and payout decisions.
- Rapid duplicate submissions are deduplicated for bookings, payments, complaints, and support tickets.
- API errors use appropriate authentication, validation, conflict, and dependency status codes.
- Sensitive secrets remain backend-only; frontend `VITE_` variables are public.

## 24. Main API contract surface

Backend mounts currently include:

```text
/api/auth
/api/bookings
/api/customer
/api/provider
/api/admin
/api/profile
/api/support
/api/notifications
/api/promotions
/api/reviews
/api/complaints
/api/uploads
/api  (catalogue, integrations, chat, and related public endpoints)
```

Representative routes include:

- Auth: register, login, Google sign-in, password reset request/confirm, current user.
- Catalogue: categories, services, active subscriptions, entitlements, auto-renew, subscription cancellation.
- Booking: create, own bookings, assigned bookings, pending bookings, claim, PIN retrieval, status, schedule, cancel, reschedule, photos.
- Provider: availability, categories, towns, earnings, bank accounts, redemption requests, KYC documents.
- Admin: settings, providers/KYC, users, plans, bookings, complaints, support, reports, reviews, payouts, audit logs.
- Payments: PayHere order/webhook, NOWPayments order/IPN, demo order/completion, payment history, receipt resend.

## 25. Background jobs and caches

- Booking timeout scheduler scans every 60 seconds.
- Read-triggered timeout scans are throttled to 30 seconds.
- Demo renewal processing renews due auto-renew subscriptions only in demo mode.
- Monthly payout scheduling runs hourly and queues payouts on the last day of each month when enabled.
- Public subscription catalogue responses cache for 60 seconds.

## 26. Confirmed rules versus current-code exceptions

These items need explicit product-owner decisions or follow-up cleanup:

1. **Refunds:** confirmed V1 policy says there are no refunds and package purchases are final. PayHere webhook code still contains a compatibility path for a refund callback that marks a payment refunded and revokes the subscription. This is not the intended V1 customer policy.
2. **Terms text:** older frontend Terms copy still mentions refund eligibility and should be aligned with the confirmed no-refund rule.
3. **Tester accounts:** frontend comments mention `tester` aliases, but the current database seed creates `customer@luxora.lk`, `provider@luxora.lk`, and `admin@luxora.lk` with the configured seed passwords. Do not document tester aliases as guaranteed accounts unless they are seeded.
4. **Admin completion override:** the admin booking endpoint enforces legal status transitions and provider presence, but its completion path does not perform the provider photo/PIN checks used by the provider path. Decide whether Admin is allowed to override those fulfilment checks; then align code and documentation.
5. **Production renewal:** demo auto-renew is implemented. A production recurring-charge scheduler is not established by the current code and requires an authorized payment-provider workflow.

## 27. Source map

- Product rules: [`CONFIRMED_PRODUCT_RULES.md`](./CONFIRMED_PRODUCT_RULES.md)
- Request tracing: [`AGENT_NAVIGATION_MAP.md`](./AGENT_NAVIGATION_MAP.md)
- Database contract: [`schema.prisma`](../backend/prisma/schema.prisma)
- Authentication: [`auth.js`](../backend/src/routes/auth.js), [`auth middleware`](../backend/src/middleware/auth.js)
- Booking lifecycle: [`bookings.js`](../backend/src/routes/bookings.js), [`bookingTimeouts.js`](../backend/src/services/bookingTimeouts.js)
- Scheduling: [`scheduling.js`](../backend/src/services/scheduling.js)
- Entitlements: [`entitlements.js`](../backend/src/services/entitlements.js)
- Payments: [`integrations.js`](../backend/src/routes/integrations.js), [`paymentContracts.js`](../backend/src/services/paymentContracts.js)
- Provider operations: [`provider.js`](../backend/src/routes/provider.js)
- Admin operations: [`admin.js`](../backend/src/routes/admin.js)
- Support and bespoke requests: [`support.js`](../backend/src/routes/support.js)
- Reviews and complaints: [`reviews.js`](../backend/src/routes/reviews.js), [`complaints.js`](../backend/src/routes/complaints.js)
- Payouts and banking: [`payouts.js`](../backend/src/services/payouts.js), [`bankingCrypto.js`](../backend/src/services/bankingCrypto.js)
- Notifications/realtime: [`notify.js`](../backend/src/services/notify.js), [`realtime.js`](../backend/src/services/realtime.js)

