# Luxora integrations, payments, email, and contact data

All third-party credentials are backend-only. The active integrations are PayHere, NOWPayments, Resend, Google sign-in, PostgreSQL, and optional S3-compatible private storage. PayPal, Twilio, SMS OTP, Telegram, and WhatsApp verification are not implemented.

## Payment settlement

- PayHere, NOWPayments, and Demo are independent payment paths; enabling one does not disable the others.
- `DEMO_PAYMENTS_ENABLED=true` enables the local/test checkout and makes no financial transaction. Existing deployments using `PAYMENT_MODE=demo` remain supported as a fallback.
- `GET /payments/mode` reports the availability and environment of each gateway so the frontend can label PayHere Sandbox separately from Demo checkout.
- PayHere order creation requires public HTTPS return/cancel/notify URLs. The webhook verifies merchant/checksum, order, exact LKR amount/currency, and state before activating a package.
- NOWPayments order creation records the LKR price plus the fixed invoice conversion. HMAC-SHA512 is mandatory. `waiting`, `confirming`, `confirmed`, and `sending` remain pending; `failed`/`expired` fail; `refunded` refunds; only `finished` can settle.
- A `finished` NOWPayments IPN additionally requires exact price/currency and a matching authoritative `/payment/:id` response with the same order ID, payment ID, price contract, and `finished` state.
- Browser return URLs never grant benefits. Payment activation, subscription creation, entitlements, notification, and receipt state are backend-owned and idempotent.

## Receipts and email

Resend sends welcome, password-reset, booking, completion, renewal, and payment-receipt messages when configured. A completed payment stays completed if email fails. Receipt delivery state is recorded in the payment payload and owners/admins may retry `/payments/:id/receipt/resend`. Production sending requires a verified `RESEND_FROM_EMAIL` domain.

## Contact and reset behavior

Phone numbers are ordinary profile contact fields with E.164 normalization where possible; there is no phone-verification endpoint. Password reset requests do not reveal account existence. Tokens are hashed in PostgreSQL, expire after 15 minutes, are consumed once under concurrency, and increment `User.tokenVersion` to revoke existing sessions.

## Upload storage

Set `S3_BUCKET`, credentials, region/endpoint, and optional prefix on ephemeral or multi-instance hosts. Without S3 configuration the backend uses `private-uploads/` only as a local development fallback.
