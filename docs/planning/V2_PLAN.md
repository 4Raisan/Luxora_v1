# Luxora V2 Implementation Plan

Baseline: tag `v1.5.0-stable` (commit `1a5d0a2`). This plan is derived from the
actual V1.5 codebase, the V1.5 production audit, and the deferred-items list —
not from speculative feature ideas. Nothing here starts until V1.5 is frozen.

Ground rules carried over from V1.5: extend existing patterns (auth, advisory
locks, idempotent payment activation, audit log, notification system, node:test
suites); additive migrations only; provider capabilities are never assumed —
unsupported provider operations are documented, not faked.

---

## 1. V2 GAP INVENTORY

### A. Must-have V2

| # | Feature | Why needed | Current state (V1.5) | Missing |
| --- | --- | --- | --- | --- |
| A1 | **Customer refund system** | Product decision: V1 has no refunds by design; paying customers currently have no recourse for a genuinely bad service beyond complaints. Gateway-initiated reversals (`PayHere -3`, NOWPayments refunded IPN) already sync, but no Luxora-initiated refund exists. | Webhook handlers mark payments `REFUNDED` and revoke the subscription atomically. No `RefundRequest` ledger, no customer/admin refund flow, no refund history API. | Full ledger + lifecycle (design below), customer request API, admin authorization API, notification + audit integration, frontend surfaces. |
| A2 | **Email address verification** | Account-recovery and password-reset currently trust that the address is deliverable; unverified addresses allow account-squatting on mistyped emails and weaken future security mail. Was explicitly deferred in V1 (no OTP). | `phoneVerified` exists but unused; Resend integration works (booking/reschedule/reset/payment emails). No `emailVerified` column or verification flow. | `emailVerified` column + verification token flow on register/email-change; gated resend with the existing `emailLimiter`; login unaffected in V2.0 (verification enforced as warning, hard-require decided later). |
| A3 | **KYC document supersession (migration)** | Re-uploads accumulate; admins review stale documents alongside current ones. No status column exists, so archival cannot be done without a schema change. | `KycDocument` rows are append-only; admin modal lists all with timestamps. | `supersededAt` column + upload rule (same provider+type marks older rows superseded), admin view filter. |

### B. Valuable V2 improvements

| # | Feature | Why | Current state |
| --- | --- | --- | --- |
| B1 | Hybrid rate limiting (per-IP + per-account) | Per-IP only; distributed attacks rotate IPs. `REDIS_URL` deployment is a prerequisite (operator). | Rate limiter is Redis-ready; keys are IP-only. |
| B2 | Admin list pagination | Admin collections return full tables (fine at current scale, degrades as data grows). | All admin GETs return unpaginated arrays with client-side filters. |
| B3 | PayHere live settlement validation | Sandbox is provider-broken; live settlement path has never been exercised. | Order/hosted/webhook code complete; production is sandbox-mode. |
| B4 | Provider payout statements | Providers see earnings and redemption requests but no consolidated payout statement per payout run. | Payout scheduler + admin payout actions exist. |
| B5 | Webhook delivery log viewer | Payment webhooks are stored on the payment row; debugging requires DB access. | `webhookPayload` column exists. |

### C. Optional / later (V2.x or V3)

- Customer data export (privacy request handling).
- Provider substitution preferences / customer-provider matching controls.
- Two-factor authentication for admins.
- Chatbot human-handoff queue.

### D. Not needed

- Multi-tenancy, generic framework extraction as a V2 workstream (the reusable
  foundation is tracked separately — see the CRUD Foundation Plan), real-time
  human chat, mobile apps.

### E. Already solved in V1.5

Profile/address cache sync, Colombo wall-clock dates, styled booking errors,
overview status filters, admin complaint SSE refresh, reschedule cooldown
enforcement, PayHere stale-order supersession, transition-gated complaint
notifications, boolean toggle validation, deactivation-aware password reset,
chat session bounds + rate limiting, env documentation, operator preflight
checklist, seed-credential hardening, rate-limiter Redis readiness.

---

## 2. REFUND SYSTEM DESIGN (A1)

### 2.1 Provider constraints (verified against the V1 integrations — do not assume more)

- **PayHere**: the V1 integration is order → hosted checkout → webhook
  (`status_code` 2 / -1 / -2 / -3). There is **no refund-initiation API call**
  in the integration. PayHere refunds are performed in the merchant portal and
  surface to Luxora only through the existing `-3` webhook. Any in-API refund
  capability must be confirmed against current PayHere documentation before an
  API adapter is written — it is NOT assumed.
- **NOWPayments**: the integration consumes IPN webhooks (including refunded)
  and verifies status via the live payments API before granting. Refund
  initiation is likewise not integrated.

Consequence: V2 refunds are **Luxora-ledger-first**. The system records and
governs the refund lifecycle, and the provider interaction is an isolated
adapter step that starts as **manual (portal-recorded)** with a documented
upgrade path to provider APIs. No fake provider success is ever recorded.

### 2.2 Lifecycle / state machine

```
                customer request                admin decision
  ┌──────────────────────────┐   ┌────────────────────────────────┐
  │ POST /payments/refunds   │   │ PUT /admin/refunds/:id         │
  ▼                          ▼   ▼                                │
REQUESTED ──► UNDER_REVIEW ──► APPROVED ──► PROCESSING ──► COMPLETED
                 │                                            │
                 ├──► REJECTED (admin, with note)             ├──► FAILED (provider/portal result negative)
                 └──► CANCELLED (customer, while open)        │
                                                              ▼
                                               gateway "-3"/refunded webhook
                                               may complete a PROCESSING refund
```

- Entry states: a request is created in `REQUESTED` (customer) or
  `APPROVED` (admin goodwill refund, admin is the requester).
- `PROCESSING` means "recorded with the provider (portal action taken or API
  accepted); awaiting provider settlement webhook". Admin records `providerRef`
  when moving to `PROCESSING`.
- `COMPLETED` is reached by (a) the provider webhook correlating with the open
  request, or (b) an admin explicitly recording the completed portal refund
  with `providerRef` (manual confirmation). Both paths are idempotent.
- `FAILED` records a negative provider result; the payment returns to
  effectively-unrefunded state (a new refund may then be requested).
- `REJECTED`/`CANCELLED` are terminal for that request; the customer may file a
  fresh request later.

### 2.3 Money and eligibility rules (LUXORA LOGIC — provider-independent)

- Eligible payment: `status === 'COMPLETED'`, gateway `PAYHERE` or
  `NOWPAYMENTS`, `capturedAmount > 0`.
- Amount: admin-authorised refunds may be **full or partial**;
  `sum(active + completed refund amounts) + newAmount <= capturedAmount`.
  Customer-requested refunds default to the full captured amount (V1 policy:
  unused-coin proration is a product decision recorded for V2.x, not silent).
- Coin/entitlement effect on `COMPLETED`: revoke the subscription created by
  that payment exactly like the existing gateway-refund path
  (`userSubscription.status = 'refunded'`, `autoRenew = false`,
  `nextRenewalDate = null`), inside the same transaction as the refund
  completion. Consumed service coins are NOT restored (a completed service was
  delivered); unused coins disappear with the revoked entitlements. This is a
  stated product rule, surfaced in the admin UI at approval time.
- Duplicate protection:
  - one **open** refund per payment: partial unique index on
    `(paymentId) WHERE status IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING')`;
  - per-transaction advisory lock on the payment id for every state mutation
    (same pattern as booking/PIN mutations);
  - customer double-clicks are additionally absorbed by an idempotency key
    (client sends one; server also dedupes on `requestedByUserId + paymentId`
    within a short window, mirroring the complaint dedup pattern).
- Unauthorized refund: only the payment owner can request; only admins can
  approve/reject/process/complete; providers have no refund role in V2.

### 2.4 Failure conditions (each mapped)

| Condition | Handling |
| --- | --- |
| Duplicate refund request | Partial unique index + 15s window dedup → returns the existing open request (200). |
| Repeated clicks | Idempotency key + dedup as above. |
| Concurrent approve/reject | `pg_advisory_xact_lock(paymentId)` + fresh re-read in-tx; loser gets 409 "already processed". |
| Already refunded (fully) | Eligibility check rejects with "payment already fully refunded". |
| Partially refunded | Amount validation against remaining unrefunded captured amount. |
| Invalid amount | Server-side: positive, ≤ captured, currency must equal `capturedCurrency`. |
| Refund greater than paid | Rejected (amount validation). |
| Unauthorized refund | Role + ownership checks (`requireRole`, `userId` scoping). |
| Provider timeout / provider failure | Request stays `PROCESSING` (no timeout auto-fail); admin records `FAILED` from the portal result, which re-opens refund eligibility. |
| Webhook replay | Existing duplicate-charge dedup; refund-completion correlation is idempotent on `providerRef`. |
| Webhook before expected state (e.g. `-3` arrives with no open request) | Current V1.5 behavior preserved verbatim: external-reversal sync marks payment `REFUNDED` + revokes subscription. If an open request exists with matching `providerRef`, it completes the request instead — never both. |
| Webhook after COMPLETED | Dedup path (no double revoke; `activate`-style fresh re-reads). |
| Database failure | Transactions roll back atomically; the request keeps its pre-transition state; client gets a 5xx and may safely retry. |
| Network retry of the API call | Idempotency key + dedup return the same request. |
| Provider says success but local update fails | `PROCESSING` + `providerRef` persist the provider-side fact; the completion write retries safely (idempotent correlation), and the admin "record completion" path is the manual backstop. |
| Local update succeeds but client times out | The refund request exists; the customer list reflects it on next load. Safe. |

### 2.5 Audit + notifications

- Every admin transition calls `logAdminAction` (existing pattern).
- Customer notified on: request received, APPROVED, REJECTED (with note),
  PROCESSING ("refund is being processed"), COMPLETED (with amount) — each
  exactly once per actual transition (complaint-notification pattern).
- Admins notified on new requests; admin lists refresh via a new
  `REFUND_*` realtime event registered in `useRealtime` (complaint pattern).

---

## 3. V2 ARCHITECTURE CHANGES

### 3.1 Database (additive migration only; rollback = drop the new table)

```prisma
enum RefundStatus {
  REQUESTED
  UNDER_REVIEW
  APPROVED
  PROCESSING
  COMPLETED
  FAILED
  REJECTED
  CANCELLED
}

model RefundRequest {
  id            Int          @id @default(autoincrement())
  paymentId     Int
  payment       Payment      @relation(fields: [paymentId], references: [id])
  requestedBy   Int          // customer or admin (admin goodwill)
  amount        Decimal      @db.Decimal(10, 2)
  currency      String       // must equal payment.capturedCurrency
  status        RefundStatus @default(REQUESTED)
  reason        String?      @db.VarChar(500)
  adminNote     String?      @db.VarChar(1000)
  providerRef   String?      @unique   // portal/API reference recorded at PROCESSING/COMPLETED
  requestedAt   DateTime     @default(now())
  decidedAt     DateTime?
  completedAt   DateTime?
  updatedAt     DateTime     @updatedAt

  @@index([paymentId])
  @@index([status])
  @@index([requestedBy])
}
```

Also: `emailVerified Boolean @default(false)` on `User` (A2) and
`supersededAt DateTime?` on `KycDocument` (A3) — separate migrations, same
additive policy.

Migration strategy: `prisma migrate dev --name add_refund_requests` locally;
`prisma migrate deploy` in CI (existing pipeline). Rollback: the table is
isolated (FK to Payment only); `DROP TABLE` restores V1.5 exactly. No V1
columns are altered.

### 3.2 API (all under the existing `/api` mount; follow integrations.js conventions)

| Route | Method | Auth | Validation | Idempotency | Failure states |
| --- | --- | --- | --- | --- | --- |
| `/payments/refunds` | POST | CUSTOMER (owns payment) | payment COMPLETED + owned; amount ≤ unrefunded captured; reason 3–500 | partial unique index + dedup window + advisory lock | 400 ineligible/amount, 404 not owned, 409 concurrent, 429 rate-limited |
| `/payments/refunds/my` | GET | CUSTOMER | — | read-only | — |
| `/admin/refunds` | GET | ADMIN | optional `status` filter | read-only | — |
| `/admin/refunds/:id` | PUT | ADMIN | legal transitions per state machine; `providerRef` required entering PROCESSING; completed amount ≤ captured | advisory lock + fresh re-read | 400 illegal transition/amount, 404, 409 concurrent |
| `/admin/refunds/:id` (customer cancel) | PUT `/payments/refunds/:id/cancel` | CUSTOMER (own request) | only while REQUESTED/UNDER_REVIEW | advisory lock | 400 terminal state |

Rate limiting: reuse the checkout limiter profile (30/15min) on POST.

### 3.3 Frontend

- Customer: payments view gains a "Request refund" action on COMPLETED payments
  (existing modal pattern) + refund history rows in Transaction History.
- Admin: payments view gains a Refunds section (list + decision modal, reusing
  the complaint-resolution modal pattern) and the realtime `REFUND_*` refresh.
- No changes to booking flows.

### 3.4 Webhook changes (extension, not rewrite)

- PayHere `-3` / NOWPayments refunded: if an open refund request exists for the
  payment whose `providerRef` matches the payload reference → complete it
  (idempotent). Otherwise → existing external-reversal behavior, unchanged.
- No new webhook URLs required.

---

## 4. IMPLEMENTATION ROADMAP (vertical slices, risk-ordered)

| Slice | Scope | Risk | Depends on |
| --- | --- | --- | --- |
| 0 | Freeze V1.5 (tag `v1.5.0-stable`) — **done** | — | — |
| 1 | `RefundRequest` migration + service (eligibility, state machine, idempotency) + contract tests | Low (additive, no UI) | — |
| 2 | Customer API: request + my-list + notifications + rate limit + live-server tests (auth/ownership/idempotency/concurrency) | Medium | Slice 1 |
| 3 | Admin API: list + transitions + audit + `REFUND_*` realtime + admin frontend section + browser verify | Medium | Slice 1 |
| 4 | Customer frontend: request modal + refund history + browser verify | Low | Slice 2 |
| 5 | Webhook correlation extension + provider manual-mode adapter + tests for replay/pre-post arrival | Medium | Slice 1 |
| 6 | A2 email verification (column + token flow + gated resend + tests) | Medium | — (independent) |
| 7 | A3 KYC supersession migration + upload rule + admin filter | Low | — |
| 8 | B1 hybrid rate-limit keys (after operator enables Redis) | Low | [OPERATOR] Redis |
| 9 | B2 admin pagination, B4 payout statements, B5 webhook viewer | Low | — |
| 10 | B3 PayHere live settlement validation (operator + probe) | External | [OPERATOR]/[PROVIDER] |

Highest-risk work: provider-facing refund settlement (Slice 5) — mitigated by
the manual-mode default. Security-sensitive: admin transitions (Slice 3).
Easiest independent: Slices 6–7.

## 5. V2 → stable

After all A-slices: full regression audit (V1 + V2 flows), adversarial refund
pass (the §2.4 table as executable tests), classification of leftovers as
`[CODE] [CONFIG] [OPERATOR] [PROVIDER LIMITATION] [DEFERRED]`, then tag
`v2.0.0`.
