# Luxora integrations, payments, email, and phone verification
All third-party credentials belong in the backend environment. Never put them in frontend env files, browser code, screenshots, logs, or Git.
## Configuration
Core: DATABASE_URL, JWT_SECRET, PORT, FRONTEND_URL, CORS_ORIGIN.
PayHere: merchant ID/secret, base/return/cancel/notify URLs.
PayPal: client ID/secret/base URL.
Resend: API key and verified sender.
Twilio Verify: account SID, auth token, Verify service SID.
See backend/.env.example. Use sandbox credentials first and restart backend after changes.
## Payment modes
PAYMENT_MODE=demo keeps the customer inside Luxora and uses /api/payments/demo/order then /api/payments/demo/:id/complete. Backend creates payment, subscription, entitlements, expiry, and notifications through normal rules. Failure/cancel does not activate.
PAYMENT_MODE=payhere uses /api/payments/payhere/order and gateway checkout. PayHere calls /api/payments/payhere/webhook; signature is validated and state reconciled. Do not mark PayHere refunded without gateway confirmation. Do not add a frontend demo shortcut or insert subscriptions from browser.
## Email
POST /api/email is available for controlled sends. Core workflows send welcome/reset/booking/subscription/completion messages when Resend is configured. Email failure must not silently change domain state.
## Phone
POST /api/profile/phone/send and /verify accept E.164 numbers. Generic /api/otp/send and /verify are equivalent. Registration has /api/auth/register/phone/send and /verify. Never log codes/tokens; trial Twilio needs verified destinations.
## Password reset
POST /api/auth/password-reset/request does not reveal account existence. Confirm accepts a short-lived token. Current token storage is memory-backed; multi-instance production requires PostgreSQL/Redis.
## Deployment checklist
Use HTTPS callback URLs; add exact browser origins to CORS_ORIGIN; test duplicate/delayed callbacks and idempotency; verify payment -> subscription -> entitlements -> notifications in PostgreSQL; inspect safe status/error fields only; test demo separately from sandbox PayHere.
