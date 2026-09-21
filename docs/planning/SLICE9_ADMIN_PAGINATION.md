# Slice 9 — admin pagination and bounded query pattern

## Paginated collections

Six admin collections are now bounded. Before this slice, five of them returned unbounded arrays and audit logs capped at 200 rows with no navigation.

| GET endpoint | Ordering | Server filters | Old bound |
| --- | --- | --- | --- |
| `/admin/users` | createdAt desc, id desc | `search` (name/email, ≤100 chars), `role` | unbounded |
| `/admin/bookings` | createdAt desc, id desc | `status`, `search` (customer/provider name or `#id`) | unbounded |
| `/admin/complaints` | createdAt desc, id desc | `status`, `search` (customer name/email) | unbounded |
| `/admin/refunds` | requestedAt desc, id desc | `status`, `payment_id`, `customer` (name/email or `#id`) | unbounded |
| `/admin/reviews` (list portion) | createdAt desc, id desc | `search` (provider name) | unbounded; summary/providers stay global |
| `/admin/audit-logs` | createdAt desc, id desc | — | take 200, not navigable |

Deliberately NOT paginated: `/admin/providers` (bounded growth, client-side KYC workflow filters, revisit at scale), `/admin/payouts` (take 200 by design), `/admin/reports` (aggregate counts + top-10, bounded by design), `/admin/stats` (aggregates), notifications (user-scoped, newest 50), KYC documents (bounded per provider).

## Contract and helper

Response: `{ data: [...], pagination: { page, pageSize, total, totalPages, hasNext, hasPrevious } }`. The reviews endpoint adds `pagination` additively to its existing composite shape. `?page=1&pageSize=25` are the defaults; `limit` remains accepted as a pageSize alias. Query params parse through `toPositiveInt`, so arrays, booleans, floats, negatives and `?pageSize=1000000` all fail with 400 rather than coercing. Max page size is 100 (200 for audit logs). Deterministic ordering adds `id desc` as the tiebreaker so equal-timestamp rows cannot shuffle across pages.

`backend/src/middleware/pagination.js` is the whole shared surface: `parsePagination`, `paginationMeta`, `paginated`, `DESC_ORDER`, `clampSearch` (search inputs capped at 100 chars). No generic framework; endpoints keep their own filters and serialization. Offset pagination is used because admin CRUD tables need jump-to-page and total counts; cursor pagination would not serve the existing UI.

## Database

Additive migration `20260917110000_admin_pagination_indexes`: `users.createdAt`, `bookings.createdAt`, `complaints.createdAt`, `refund_requests.requestedAt`. Justification: every paginated listing runs `ORDER BY <col> DESC LIMIT/OFFSET` plus a filtered `COUNT`; without the index Postgres seq-scans and sorts the full table per page request. `admin_audit_logs` already had a `createdAt` index. Each page runs exactly two queries (page + count) with fixed `take`; includes are bounded by the page size, no N+1 loops introduced.

## Frontend

`AdminDashboard.jsx`: per-collection loaders with a monotonic request sequence so stale responses never overwrite newer pages; debounced (350 ms) filter inputs reset to page 1 and hit server-side filters, replacing the previous client-side filtering of users/bookings/complaints/refunds/reviews; a shared `PageNav` (previous/next, page X of Y, total, loading state) sits under each table; existing empty states retained. Role tabs now show the active tab's server-reported total.

Realtime: complaint SSE refreshes the current bounded complaints page; `BOOKING_CREATED` refreshes the current bookings page instead of prepending unbounded rows locally; status-change events keep their cheap in-place row update. Post-action `loadAll()` reloads each collection's current page, not always page 1. This also fixed the pre-existing `refreshRefunds` undefined-function bug in admin refund actions (it now calls the paginated loader), and the 409 re-sync fetch is bounded by `payment_id`.

## Export/report separation

No admin export subsystem exists; `/admin/reports` returns JSON aggregates only, and jsPDF usage is frontend customer receipts fed by API data — no business logic is embedded in serialization today. Architecture is ready for a later DATA QUERY → BOUNDED DATA → REPORT MODEL → SERIALIZATION → DELIVERY layer; no refactor was needed.

## Incidental fix

`transitionRefund` now maps Prisma `P2034` serialization write conflicts to 409 (matching the payouts route), so race losers surface as conflicts instead of 500s under load — the full-suite stress exposed this pre-existing gap.

## Verification

- Complete backend suite with real Redis: **268 passed, 0 failed, 0 skipped** (253 baseline + 15 new pagination tests).
- New `backend/tests/admin-pagination.test.js`: 15 real-database tests covering defaults, explicit pages, max/oversized/invalid/coerced params, deterministic ordering with timestamp ties, filters+search+pagination, empty pages, last page, deleted/updated records mid-pagination, admin-only access, and bounded responses on previously unbounded endpoints.
- Frontend tests 8/8; production build passed; graph verification passed; oxlint 0 errors (34 warnings, pre-existing style); `git diff --check` clean.
- Deliberate test-contract updates for the new response shapes: `fresh-db-smoke` (audit logs), `booking-concurrency` (audit logs), `refund-admin` (refunds list).
- Browser interaction and production deployment were not verified. No commits, no tag changes, Slices 10+ untouched.
