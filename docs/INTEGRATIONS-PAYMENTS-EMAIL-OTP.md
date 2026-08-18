# Luxora payments, email and phone verification

Luxora keeps all third-party secrets on the backend. Never put these values in `frontend/.env` or commit a real `.env` file.

## Configure

1. Copy `backend/.env.example` to `backend/.env`.
2. Add sandbox credentials first:
   - PayHere: `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, and optional return/callback URLs.
   - PayPal: sandbox `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
   - Resend: `RESEND_API_KEY` and a verified sender in `RESEND_FROM_EMAIL` (the default `onboarding@resend.dev` can only send test mail to the Resend account owner).
   - Twilio Verify: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and a Verify Service SID (`VA...`). Trial accounts require verified destination numbers.
3. Restart the backend after changing environment variables.

## Backend endpoints

Authenticated payment endpoints:

- `POST /api/payments/payhere/order` with `{ amount, currency, customer }`; submit the returned `fields` to `checkoutUrl`.
- `POST /api/payments/paypal/order` with `{ amount, currency, description }`; redirect the customer to `approvalUrl`.
- `POST /api/payments/paypal/capture` with `{ orderId }` after PayPal approval.
- PayHere sends its server callback to `POST /api/payments/payhere/webhook`; this endpoint is public and validates the PayHere MD5 signature.

Transactional email:

- `POST /api/email` with `{ to, subject, html, text? }`.
- Welcome emails, password-reset links, booking confirmations, subscription receipts, and completion notices are sent automatically when `RESEND_API_KEY` is configured. Email failure is non-fatal to the main user action.

Twilio Verify:

- `POST /api/profile/phone/send` with `{ phone: "+94771234567" }`.
- `POST /api/profile/phone/verify` with `{ phone, code }`; a successful verification updates the authenticated user’s phone and `phoneVerified` flag.
- The equivalent generic endpoints are also available at `/api/otp/send` and `/api/otp/verify`.

These phone endpoints work for customers, providers, and admins because they require any valid JWT, while payment and email endpoints also require authentication.

## Password reset

- `POST /api/auth/password-reset/request` with `{ email }` sends a Resend reset link without revealing whether the email exists.
- `POST /api/auth/password-reset/confirm` with `{ token, password }` changes the password. Tokens expire after 15 minutes.

The reset-token store is memory-backed for local development. For multiple backend instances, move it to a database/Redis table before production.

## Run after configuration

```powershell
cd backend
npx prisma db push
npx prisma generate
npm run dev
```

Use sandbox accounts and credentials from the PayHere, PayPal, Resend and Twilio dashboards. Never test live payments until callback URLs, signature validation and payment-to-booking reconciliation have been verified.
