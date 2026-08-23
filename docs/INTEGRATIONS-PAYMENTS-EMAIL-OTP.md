# Luxora integrations, payments, email, phone verification, and Google sign-in
All third-party credentials belong in the backend environment. Never put them in frontend env files, browser code, screenshots, logs, or Git.
## Configuration
Core: DATABASE_URL, JWT_SECRET, PORT, FRONTEND_URL, CORS_ORIGIN.
PayHere: merchant ID/secret, base/return/cancel/notify URLs.
PayPal: client ID/secret/base URL.
Resend: RESEND_API_KEY and RESEND_FROM_EMAIL. Resend is the only mail transport.
EasySendSMS SMS: REST API key and approved sender ID from the EasySendSMS dashboard. Luxora generates and verifies OTPs server-side; EasySendSMS is used only to deliver the SMS.
Google Sign-In: GOOGLE_CLIENT_ID (backend) must equal VITE_GOOGLE_CLIENT_ID (frontend).
See backend/.env.example. Use sandbox credentials first and restart backend after changes.
## Payment modes
PAYMENT_MODE=demo keeps the customer inside Luxora and uses /api/payments/demo/order then /api/payments/demo/:id/complete. Backend creates payment, subscription, entitlements, expiry, and notifications through normal rules. Failure/cancel does not activate.
PAYMENT_MODE=payhere uses /api/payments/payhere/order and gateway checkout. PayHere calls /api/payments/payhere/webhook; signature is validated and state reconciled. Do not mark PayHere refunded without gateway confirmation. Do not add a frontend demo shortcut or insert subscriptions from browser.
## Email
All transactional mail goes through Resend (RESEND_API_KEY + RESEND_FROM_EMAIL); there is no other mail transport. Core workflows send welcome/reset/booking/subscription/completion messages when Resend is configured, and a missing/placeholder key is logged once as a warning instead of failing silently. Resend restriction: the shared test sender onboarding@resend.dev delivers only to the Resend account owner's own address; sending to real users requires a verified domain (resend.com/domains, e.g. luxora.bond) and a sender on that domain. Email failure must not silently change domain state.
## Google Sign-In
POST /auth/google takes the Google ID token (credential), verifies it against Google's tokeninfo endpoint, and requires aud === GOOGLE_CLIENT_ID plus a verified, unexpired email. It is for CUSTOMER accounts only: new emails create a customer row (name/email synced from the Google profile, random password), while existing provider/admin emails get 403 and must password-sign-in. Configuration: same OAuth client ID as GOOGLE_CLIENT_ID (backend) and VITE_GOOGLE_CLIENT_ID (frontend); every site origin must be registered under Authorized JavaScript origins in Google Cloud Console (https://www.luxora.bond, https://luxora.bond, and localhost/127.0.0.1 dev ports), or Google returns origin_mismatch. When GOOGLE_CLIENT_ID is unset the endpoint returns 503 and the frontend hides the button.
## Phone
POST /api/profile/phone/send and /verify accept local Sri Lankan mobile numbers (e.g. 0771575701) or E.164 (+94771575701). Generic /api/otp/send and /verify are equivalent. Registration has /api/auth/register/phone/send and /verify. Never log codes/tokens; EasySendSMS receives the normalized number without the plus sign (e.g. 94771575701).
## Password reset
POST /api/auth/password-reset/request does not reveal account existence. Tokens are stored as SHA-256 hashes in PostgreSQL (password_reset_tokens) with 15-minute expiry; only the hashed form is persisted and the raw token appears solely in the emailed reset link built from FRONTEND_URL/reset-password?reset_token=. Confirm marks the token used and rehashes the new password in one transaction.
## Deployment checklist
Use HTTPS callback URLs; add exact browser origins to CORS_ORIGIN and to the Google OAuth client's Authorized JavaScript origins (including any new domain); verify the Resend sender domain before expecting delivery to real users; test duplicate/delayed callbacks and idempotency; verify payment -> subscription -> entitlements -> notifications in PostgreSQL; inspect safe status/error fields only; test demo separately from sandbox PayHere.
