# Luxora Agent Start

Start here before changing production code.

## Read in this order

1. [[01_AUTH_FLOW]]
2. [[02_CUSTOMER_BOOKING_FLOW]]
3. [[03_PROVIDER_FULFILLMENT_FLOW]]
4. [[04_ADMIN_OPERATIONS_FLOW]]
5. [[05_API_CONTRACTS]]
6. [[06_DATABASE_SCHEMA]]
7. [[07_RUNTIME_DEPLOYMENT]]

## Truth sources

- Machine dependency graph: `knowledge-graph.json`
- Interactive dependency browser: `index.html`
- Exact API contract source: `../backend/src/routes/`
- Database contract source: `../backend/prisma/schema.prisma`

After route, schema, service, or API-call changes run `npm run graph`.

