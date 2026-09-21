# Slice 7 — KYC document supersession

## Lifecycle and compatibility

Previously, POST `/api/provider/kyc-documents` appended 1–3 files without changing previous rows or the provider's approval. Registration sent NIC front and back in separate requests with the same `NIC` type. Admin decisions were provider-status updates without a document snapshot. Operational gates use `Provider.kycStatus`, not document counts.

A replacement is a complete same-type set (NIC, PASSPORT, or SELFIE). Each successful request supersedes all previously current rows for that provider/type and inserts its files as current, in one transaction. A NIC set can contain multiple files; uniqueness per database row would incorrectly discard an ID side. Registration now batches both NIC sides. The provider upload form uses the supported types and multipart `documents` field.

Uploads and admin review acquire the same transaction-scoped PostgreSQL advisory lock, namespace 731 and provider ID. The default PostgreSQL Read Committed isolation permits the next lock holder to observe the preceding committed replacement. Thus two successful simultaneous uploads leave only the later serialized set current. Different document types retain independent current sets.

A successful upload sets KYC to PENDING and clears the old rejection reason. Existing KYC gates therefore deny operational work until an admin reviews the replacement. Account activation is not changed, bookings are not deleted, and legacy approved providers without a re-upload retain their status. The pending-bookings endpoint now runs scheduler processing only after authorization/KYC checks.

Admin details return current and historical documents plus `current_document_ids`. Review submits the exact viewed IDs as `document_ids`; missing/stale/duplicate IDs return 409 for providers with current documents. The review transaction checks IDs, updates status and writes an audit with `details.documentIds`. A concurrent replacement either precedes the review (stale review rejected) or follows it (approval reset to pending). Legacy zero-document reviews retain their prior contract; no new document-completeness policy is introduced.

## Migration and existing data

Migration: `backend/prisma/migrations/20260917100000_kyc_document_supersession/migration.sql`.

Adds nullable `KycDocument.supersededAt` and a non-unique index on providerId/documentType/supersededAt. No rows, IDs, objects, or approval statuses are removed or rewritten. Existing rows remain NULL/current until an explicit complete replacement supersedes that type. There is no latest-row backfill: legacy NIC sides have no side or batch metadata, so their chronology cannot establish which rows are safe to archive.

The configured application database at localhost:5435 was unavailable during implementation. Production row counts were not inspected and the migration was not applied to the application/production database. Validation used a disposable PostgreSQL 18 instance at localhost:5547, with the repository's isolated `luxora_test` schema. A real-database migration test executes the actual migration against a temporary legacy table containing multiple NIC rows and confirms that every row remains intact/current.

Before deployment, operators should inspect aggregate legacy shape with this read-only query (no personal data or file paths):

```sql
SELECT "documentType", COUNT(*) AS provider_groups, SUM(file_count) AS files,
       COUNT(*) FILTER (WHERE file_count > 1) AS multi_file_groups
FROM (
  SELECT "providerId", "documentType", COUNT(*) AS file_count
  FROM "kyc_documents"
  GROUP BY "providerId", "documentType"
) AS grouped_documents
GROUP BY "documentType";
```

Deploy the additive migration before the updated API and coordinated frontend. Old registration clients sending NIC sides as separate requests must not continue using the replacement contract. Legacy ambiguous records should be reviewed or replaced as a complete set, never silently normalized by timestamp.

## Storage and authorization

Files are signature-validated and stored under random private keys before the database transaction. Validation, storage, or database failure does not supersede current rows. Failed request objects already persisted are cleaned up best-effort, as in the existing policy. Cleanup failure can leave an orphan object; no new garbage collector is introduced.

Superseded rows and physical objects are retained indefinitely in this slice. Retention expiry/cleanup remains deferred pending an explicit policy. Existing owner/admin-only retrieval applies equally to current and superseded IDs; customer, other-provider, inactive-account, and anonymous access remain denied. Admin lists do not expose internal storage keys.

## Verification

- New KYC suite: 23 real-database tests, all passed.
- Full backend suite: 231 passed, 0 failed, 0 skipped; includes auth, email verification, bookings, provider eligibility, refunds and KYC.
- Frontend helper suite: 8 passed, 0 failed.
- Frontend production build: passed.
- Lint: local `npm run lint` could not find oxlint; `npm exec --yes --package=oxlint@1.75.0 -- oxlint` completed with 0 errors and 28 warnings outside the new Slice 7 code.
- Knowledge and architecture graph verification: passed.
- Browser interaction and live S3/production migration were not verified.

The existing B3 regression now reviews current document IDs before approval. Upload validation test B11 uses a dedicated provider instead of changing the seeded provider's KYC status and contaminating subsequent booking tests.

V1.5 annotated tag still peels to `1a5d0a2dcb22375c8b371c3ca433307832ddf416`. No commits or tags were created or changed. Slices 8+ remain untouched (hybrid rate limiting, pagination, payout statements, webhook viewer, and operator-led live payment validation).
