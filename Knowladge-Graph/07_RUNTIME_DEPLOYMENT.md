# Runtime and Deployment Map

Related: [Agent start](00_AGENT_START.md) · [Authentication](01_AUTH_FLOW.md) · [API contracts](05_API_CONTRACTS.md) · [Database schema](06_DATABASE_SCHEMA.md) · [Architecture Explorer](https://4raisan.github.io/Luxora_v1/architecture/)

```text
Browser Client
  ├── HTTPS / REST  -> Vercel Edge CDN (Frontend: https://luxora.bond)
  ├── HTTPS / API   -> Northflank Docker Cluster (Backend: https://site--luxora-backend--6kb9tg67ytl4.code.run)
  └── SSE Stream    -> /api/realtime persistent push connection
       │
       ├── Prisma ORM 6.19 -> Neon Serverless PostgreSQL 15 (pooled DATABASE_URL / direct DIRECT_URL)
       ├── Cloud Storage   -> Private S3 bucket (Cloudflare R2 / AWS S3) for KYC & photos
       ├── Gateways        -> PayHere (LKR MD5 IPN) & NOWPayments (Crypto HMAC-SHA512 IPN)
       └── Email API       -> Resend transactional REST client
```

Primary runtime files & deployment targets:

- `frontend/`: Deployed to **Vercel Global Edge** via git-integrated deployment.
- `backend/`: Deployed to **Northflank Container Cluster** via multi-stage `Dockerfile`.
- `backend/prisma/schema.prisma`: Deployed against **Neon Serverless PostgreSQL** using pooled `DATABASE_URL` for queries and `DIRECT_URL` for migrations.
- `Knowladge-Graph/`: Deployed to **GitHub Pages** via `.github/workflows/knowledge-graph-pages.yml`:
  - Knowledge Graph: `https://4raisan.github.io/Luxora_v1/`
  - Architecture Explorer: `https://4raisan.github.io/Luxora_v1/architecture/`
- `start.bat`: Local self-healing startup for developer machines.

Branch & Release Workflow:
1. Feature work occurs on isolated branches (e.g., `post-launch-implementation`).
2. Pull requests trigger the 8-job GitHub Actions CI suite (`ci.yml`) including Protected Files Guard and Knowledge Graph verification.
3. Merges into `main` automatically publish frontend updates to Vercel, backend images to Northflank, and documentation/explorers to GitHub Pages.
