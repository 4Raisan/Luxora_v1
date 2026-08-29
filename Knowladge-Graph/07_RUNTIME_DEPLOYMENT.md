# Runtime and Deployment Map

Related: [[00_AGENT_START]] · [[01_AUTH_FLOW]] · [[05_API_CONTRACTS]] · [[06_DATABASE_SCHEMA]]

```text
Browser
  -> Vite development server (:3000) or Express-served frontend build (:5000)
  -> Express API (:5000/api)
  -> Prisma
  -> Docker PostgreSQL (:5432)
  -> private S3-compatible object storage when configured (local private-uploads fallback for development)
```

Primary runtime files:

- `start.bat`: local self-healing startup, database readiness, Prisma sync, seed, server launch
- `docker-compose.yml`: PostgreSQL container and production backend topology
- `backend/.env`: backend-only database and secret configuration
- `frontend/.env.local`: frontend API base configuration
- `backend/src/index.js`: CORS, router mounting, static frontend serving, error boundary
- `backend/src/services/storage.js`: private S3-compatible or local upload persistence

Use `/api/health` to check server and database connectivity before diagnosing frontend fetch errors.
