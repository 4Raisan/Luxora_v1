# Luxora Agent Start

Start here before changing production code.

## Read in this order

1. [Authentication and authorization](01_AUTH_FLOW.md)
2. [Customer booking](02_CUSTOMER_BOOKING_FLOW.md)
3. [Provider fulfilment](03_PROVIDER_FULFILLMENT_FLOW.md)
4. [Admin operations](04_ADMIN_OPERATIONS_FLOW.md)
5. [API contracts](05_API_CONTRACTS.md)
6. [Database schema](06_DATABASE_SCHEMA.md)
7. [Runtime and deployment](07_RUNTIME_DEPLOYMENT.md)

## Truth sources

- Machine dependency graph: `knowledge-graph.json`
- Interactive dependency browser: `index.html`
- Exact API contract source: `../backend/src/routes/`
- Database contract source: `../backend/prisma/schema.prisma`

After route, schema, service, or API-call changes run `npm run graph:verify`.

