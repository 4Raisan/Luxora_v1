# Luxora Agent Entry Point

Use this file before changing code in this repository.

## Source of truth

- Machine graph: `Knowladge-Graph/knowledge-graph.json`
- Interactive explorer: `Knowladge-Graph/index.html`
- Architecture and lifecycle reference: `Knowladge-Graph/ARCHITECTURE_GRAPH.md`
- Debugging/blast-radius procedure: `Knowladge-Graph/AGENT_DEBUGGING_PLAYBOOK.md`
- Confirmed product rules: `Knowladge-Graph/CONFIRMED_PRODUCT_RULES.md`
- Graph generator: `Knowladge-Graph/generate-graph.js`

Regenerate after changes to routes, schema, services, or frontend API calls:

```powershell
npm run graph:verify
```

## Layer map

```text
frontend/src/pages|components
        -> frontend/src/services/api.js (API_BASE + Authorization header)
        -> backend/src/index.js (mounted /api routers + CORS/error handling)
        -> backend/src/middleware (JWT, role/KYC gates, validation)
        -> backend/src/routes (request validation + orchestration)
        -> backend/src/services (business rules/integrations)
        -> backend/prisma/schema.prisma (models, relations, enums)
        -> PostgreSQL (Docker Compose service: postgres:5432)
```

## Change protocol

1. Locate the node in `knowledge-graph.json` and inspect upstream/downstream edges.
2. Trace the complete contract: page/component -> `apiRequest()` -> mounted route -> middleware -> service/database.
3. Update validation, authorization, persistence, and UI loading/error/empty states together.
4. Verify route paths and response shapes against the backend code; do not invent frontend data.
5. Run the smallest relevant checks, then `npm run graph:verify` to refresh and validate the graph.

## Important mounts

`backend/src/index.js` mounts `/api/auth`, `/api/bookings`, `/api/customer`, `/api/provider`, `/api/admin`, `/api/profile`, `/api/support`, `/api/notifications`, `/api/promotions`, `/api/reviews`, `/api/complaints`, `/api/uploads` (via `/api`), integrations, refunds, and API docs.

Provider operations are gated by JWT role and approved KYC in `backend/src/routes/provider.js` and `backend/src/routes/bookings.js`. Never bypass those gates in the frontend.

Product truth overrides: no Super Admin; Admin can perform all admin operations. Customer bookings are automatically assigned to eligible providers, cannot be cancelled after `IN_PROGRESS`, and must use persisted credits/payment state. Provider earnings are fixed per configured service/category and settle after completion; monthly payout to the selected bank account is a backend/scheduler responsibility.
