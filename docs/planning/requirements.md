# Luxora requirements and acceptance rules
## Roles
Customers register/login, maintain profile/town/phone, buy packages, view balances, book included services, reschedule/cancel eligible bookings, read notifications, create complaints/reviews, and request eligible refunds.
Providers register, submit KYC, manage towns/availability, receive assigned work, complete PIN/photo lifecycle, and view earnings. KYC approval gates fulfilment.
Admins manage users, providers/KYC, bookings, plans, complaints, support, promotions, refunds, reports, and catalogue. Only Super Admins may change scheduling or plans.
## Packages/payments
Plans are individual or combo, active/inactive, priced in LKR, duration-bound, and composed of category units. Successful purchase grants balances and expiry. Booking consumes one matching unit. Demo mode runs the real purchase pipeline without charging. PayHere mode is enabled only when the backend reports payhere.
## Refunds
Refunds require an unused eligible exact purchase. Any used unit makes an individual/combo purchase ineligible; no partial combo refund. Duplicate requests reject. Rejection leaves package/payment active. Demo completion disables the package and updates payment/refund/notification records. PayHere is not refunded without gateway confirmation.
## Booking
Bookings reference customer, service, optional subscription, and optional provider. Assignment requires approved provider, matching category/town, availability, and scheduling. PINs/photos protect lifecycle. Invalid transitions, wrong-owner access, repeated payout, and locked PIN attempts reject server-side.
## Non-functional
JWT+bcrypt, explicit CORS, PostgreSQL/Prisma migrations, bounded pool, responsive UI, accessible errors/loading, backend-only secrets, real data only, no mobile horizontal overflow.
## Acceptance
Health/auth/catalogue/authorization work; individual/combo purchase and booking consumption work; KYC/availability/PIN/photo lifecycle works; admin queues work without pool exhaustion; refunds persist with notifications; demo/PayHere obey mode; build/lint/Prisma/browser checks pass.
