# Luxora Debugging Playbook

## Before changing code

```powershell
rg -n "endpoint-or-field" frontend/src backend/src backend/prisma
npm run graph
```

Trace: page -> `apiRequest()` -> mounted route -> middleware -> service -> Prisma model.

## Common checks

| Symptom | Check |
| --- | --- |
| `401` / `403` | `sessionStorage` token, JWT, role, KYC |
| Missing coins | Active subscription, entitlement rows, booking category, refund/cancel state |
| Provider not assigned | KYC, availability, town/province, schedule conflict |
| PayHere failure | Payment mode, public HTTPS callbacks, order ID, amount/currency, webhook signature |
| UI stale data | API response shape, `apiRequest()` path, loading/error state, server refresh after mutation |

## Verification

```powershell
npm run build
npm run lint
node --test
npm run graph
```

For frontend changes, also check desktop and mobile layouts, browser console, and Network responses.

## Change rules

- Do not invent frontend records or balances.
- Do not bypass KYC, role, or payment gates.
- Keep API validation, persistence, and UI states aligned.
- Use `prisma migrate deploy` in production; reserve `db:push` for disposable local databases.
