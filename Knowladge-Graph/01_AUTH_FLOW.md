# Authentication and Authorization Flow

Related: [[00_AGENT_START]] · [[05_API_CONTRACTS]] · [[06_DATABASE_SCHEMA]] · [[07_RUNTIME_DEPLOYMENT]]

```text
Login / registration page
  -> frontend/src/services/api.js
  -> POST /api/auth/login or /api/auth/register
  -> backend/src/routes/auth.js
  -> password hashing + Prisma User/Provider write
  -> JWT response
  -> sessionStorage token + user
  -> RequireAuth.jsx + role check
  -> protected dashboard
```

Server authority always wins. The frontend may guide users, but the backend enforces token validity, role, KYC status, ownership, and input rules.

Primary files:

- `frontend/src/pages/Login.jsx`, `Signup.jsx`, `ProviderRegister.jsx`
- `frontend/src/components/RequireAuth.jsx`
- `frontend/src/services/api.js`, `roles.js`
- `backend/src/routes/auth.js`
- `backend/src/middleware/auth.js`, `rateLimit.js`, `validators.js`

