# Luxora Pre-Release Production Preflight Checklist

Before releasing any updates or migrations to production, execute the following mandatory preflight steps.

---

## 1. Environment & Secret Verification

Ensure all mandatory production variables are set in the host environment or orchestration manager:
- `DATABASE_URL`: Production PostgreSQL connection string with TLS/SSL enabled.
- `JWT_SECRET`: High-entropy 32+ byte string.
- `BANK_ENCRYPTION_KEY`: Dedicated 32-byte secret (or passphrase) for AES-256-GCM bank account encryption.
- `TRUST_PROXY`: Set to `'1'` (or specific reverse proxy hop/subnet). Never leave unconfigured behind a reverse proxy.
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: Required for durable KYC/service upload storage.
- `CORS_ORIGIN`: Explicit comma-separated allowed origins (e.g. `https://luxora.bond,https://admin.luxora.bond`). Wildcards (`*`) are disallowed with credentials.

---

## 2. Mandatory Production Database Backup

Take an authoritative snapshot/dump of the production database before applying any schema or data changes:

```bash
pg_dump -h <db_host> -U <db_user> -d <db_name> -F c -b -v -f luxora_backup_$(date +%Y%m%d_%H%M%S).dump
```

---

## 3. Schema & Data Migration Preflight

1. **Deploy Prisma Schema Migrations**:
   ```bash
   npm --prefix backend run db:migrate
   ```

2. **Bank Account Encryption Preflight Dry-Run**:
   Run the dry-run command to verify encryption keys and ensure all existing accounts can be safely encrypted without writing to the database:
   ```bash
   npm --prefix backend run preflight:bank-accounts
   ```
   *Expected output: `[PREFLIGHT DRY-RUN] Bank account encryption verification passed.`*

3. **Execute Bank Account Migration**:
   ```bash
   npm --prefix backend run migrate:bank-accounts
   ```
   *Every record is roundtrip-verified against original plaintext before persistence.*

---

## 4. Key Rotation Procedure (When Rotating `BANK_ENCRYPTION_KEY`)

1. Set `OLD_BANK_KEY` and `NEW_BANK_KEY` in maintenance script environment.
2. Re-encrypt all records:
   ```javascript
   import { reencryptAccountNumber } from './src/services/bankingCrypto.js';
   // Iterate accounts within transaction and update with reencryptAccountNumber(acc.accountNumber, OLD_BANK_KEY, NEW_BANK_KEY)
   ```
3. Deploy new application instances configured with `BANK_ENCRYPTION_KEY=NEW_BANK_KEY`.
