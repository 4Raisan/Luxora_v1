# Slice 10 — operational tooling: payout statements + webhook viewer

## Payout statement architecture

Strict separation: `services/payoutStatements.js` owns the single authoritative
statement model (`buildPayoutStatement`); the admin route serializes it to JSON
and `toStatementCsv` serializes the same lines to CSV. No payout logic exists in
either serializer, so a future PDF/report layer can reuse the identical model.

A statement is derived purely from stored `ProviderPayout` rows. Luxora stores
no fee fields, so amounts are gross and net-identical; payouts are provider
earnings denominated in LKR by business rule (no per-payout currency column
exists — the constant is stated, not invented). Statement lines carry: id,
period, kind (monthly/redemption), status, amount, provider, bank details with
account numbers masked to the last four (decrypt-then-mask; full numbers never
leave the API), idempotency reference, requested/paid timestamps.

Summary totals (paid/pending/failed counts and sums, zero-initialized) always
cover the full filtered range while lines are page-bounded, so pagination and
totals stay consistent.

Bounds: `from`/`to` are validated `YYYY-MM` periods (inclusive, max 24 months),
status/provider filters validated, pages bounded by the Slice 9 helper, and the
CSV export is capped at 1000 rows — a larger filtered range fails with 400
"narrow the period range" instead of streaming unbounded output. Ordering is
deterministic (`period desc, id desc`) on the existing `@@index([period, status])`;
no new indexes were needed. The CSV serializer also applies the OWASP
formula-injection guard (leading `= + - @ TAB CR` in untrusted text is prefixed
with an apostrophe), and a regression test proves a hostile bank-holder value
is delivered inert while the JSON statement keeps the original value.

## Webhook viewer architecture

Read-only, derived from `Payment.webhookPayload` (the latest delivery per
payment, as stored by the PayHere/NOWPayments handlers). No new storage, no
mutation or replay routes — the test suite asserts PUT/POST paths 404.

- `GET /admin/webhook-events` — paginated newest-first (`updatedAt desc, id
  desc`) with gateway/status/payment-id/reference/date filters (day window
  capped at 92 days). List rows are summaries only; raw payloads never appear.
- `GET /admin/webhook-events/:paymentId` — full sanitized payload plus refund
  correlation (refund id, status, provider ref) and raw payload byte size.

Sanitization (`sanitizeWebhookPayload`): deep-clones with keys matching
/signature|secret|token|password|credential|auth|api_key|access_key|private_key/
replaced by `[REDACTED]`, strings truncated at 1000 chars, arrays/objects/depth
capped, and the whole payload withheld (`payload_truncated`) if still over
20000 serialized chars. Public provider data (e.g. a crypto `pay_address`)
stays inspectable so debugging remains useful. Event classification
(charge_settled, refund_event, order_superseded, ipn_*, demo_purchase) is a
presentational mapping of stored fields — no new provider capabilities implied.

## Pagination reuse

Both tools use the Slice 9 `parsePagination`/`paginated` contract and the admin
frontend reuses the guarded `loadPage`/`PageNav` machinery (stale responses
discarded, debounce on filters, on-demand load when the section opens).

## PayHere live settlement validation [OPERATOR / PRODUCTION VALIDATION]

Not performed in this coding slice. Required operator checkpoint before
enabling live PayHere:

1. Credentials: live `PAYHERE_MERCHANT_ID` + `PAYHERE_MERCHANT_SECRET`
   (secret never committed; stored in the hosting platform only), public HTTPS
   return/cancel/notify URLs, `PAYHERE_BASE_URL=https://www.payhere.lk`,
   `TRUST_PROXY` matching the ingress so webhook client IPs are real.
2. Safe test procedure: one small live charge (e.g. LKR 10–50 plan), complete
   and cancel one checkout each, then a merchant-portal refund of the charge.
3. Expected evidence: hosted-checkout redirect round-trip; webhook with
   `status_code=2` flipping the payment to COMPLETED and activating the
   subscription exactly once (retries acked idempotently); cancel (-1)/fail
   (-2) leaving FAILED; refund (-3) flipping to REFUNDED and revoking the
   subscription, optionally correlating with an open refund request; amounts
   in `payments` matching the LKR plan contract; no `console` secret output.

## Verification

- Complete backend suite with real Redis: **283 passed, 0 failed, 0 skipped**
  (268 baseline + 15 new tooling tests in `backend/tests/admin-tooling.test.js`).
- New coverage: statement totals/filters/ranges/bounds, CSV-vs-JSON equality,
  oversized export fail-safe, admin-only authorization, viewer pagination,
  gateway/status/payment/date filters, redaction, oversized payload handling,
  deterministic ordering, refund correlation, read-only enforcement.
- Frontend tests 8/8; production build passed; oxlint 0 errors (36 pre-existing
  style warnings); graph verification passed (230 nodes, 488 edges).
- No commits, no tag changes; no gateway abstractions, RLS, or CRUD extraction.
