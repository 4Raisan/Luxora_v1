# Luxora Codebase Knowledge Graph

The Knowledge Graph maps Luxora’s frontend, API routes, middleware, services, integrations, Prisma models, tests, configuration, and runtime relationships. It helps developers and coding agents trace the full impact of a change before editing connected code.

Explore it online: **[Luxora Interactive Knowledge Graph](https://4raisan.github.io/Luxora_v1/)**

## Agent entry point and source order

Coding agents start with the repository-root [`AGENTS.md`](../AGENTS.md). That file directs them through the graph and the supporting references in this order:

```text
AGENTS.md
  ├── knowledge-graph.json
  ├── index.html
  ├── ARCHITECTURE_GRAPH.md
  ├── AGENT_DEBUGGING_PLAYBOOK.md
  ├── CONFIRMED_PRODUCT_RULES.md
  └── AGENT_NAVIGATION_MAP.md
          ├── 00_AGENT_START.md
          ├── 01_AUTH_FLOW.md
          ├── 02_CUSTOMER_BOOKING_FLOW.md
          ├── 03_PROVIDER_FULFILLMENT_FLOW.md
          ├── 04_ADMIN_OPERATIONS_FLOW.md
          ├── 05_API_CONTRACTS.md
          ├── 06_DATABASE_SCHEMA.md
          └── 07_RUNTIME_DEPLOYMENT.md
```

These links are part of the coding-agent workflow. Do not remove, rename, or replace them with a shortened README summary. `CONFIRMED_PRODUCT_RULES.md` is the authority for confirmed product behaviour when implementation details or older notes disagree.

## Files

| File | Purpose |
| --- | --- |
| [`knowledge-graph.json`](knowledge-graph.json) | Machine-readable nodes, edges, metadata, and source locations |
| [`index.html`](index.html) | Interactive browser explorer |
| [`ARCHITECTURE_GRAPH.md`](ARCHITECTURE_GRAPH.md) | System architecture and lifecycle reference |
| [`AGENT_DEBUGGING_PLAYBOOK.md`](AGENT_DEBUGGING_PLAYBOOK.md) | Debugging and blast-radius procedure |
| [`CONFIRMED_PRODUCT_RULES.md`](CONFIRMED_PRODUCT_RULES.md) | Confirmed roles, booking, payment, earnings, and operational rules |
| [`AGENT_NAVIGATION_MAP.md`](AGENT_NAVIGATION_MAP.md) | Index for task-specific agent flow documents |
| [`00_AGENT_START.md`](00_AGENT_START.md) | Required starting procedure for coding agents |
| [`01_AUTH_FLOW.md`](01_AUTH_FLOW.md) | Authentication and authorization flow |
| [`02_CUSTOMER_BOOKING_FLOW.md`](02_CUSTOMER_BOOKING_FLOW.md) | Customer booking lifecycle |
| [`03_PROVIDER_FULFILLMENT_FLOW.md`](03_PROVIDER_FULFILLMENT_FLOW.md) | Provider assignment and fulfilment lifecycle |
| [`04_ADMIN_OPERATIONS_FLOW.md`](04_ADMIN_OPERATIONS_FLOW.md) | Administrative operations and controls |
| [`05_API_CONTRACTS.md`](05_API_CONTRACTS.md) | Frontend-to-backend request and response contracts |
| [`06_DATABASE_SCHEMA.md`](06_DATABASE_SCHEMA.md) | Prisma models, relations, and persistence rules |
| [`07_RUNTIME_DEPLOYMENT.md`](07_RUNTIME_DEPLOYMENT.md) | Runtime services and deployment topology |
| [`generate-graph.js`](generate-graph.js) | Deterministic graph generator |
| [`validate-graph.js`](validate-graph.js) | Structural and semantic graph validator |

## How to use it

1. Locate the relevant node in `knowledge-graph.json` or the interactive explorer.
2. Inspect its incoming and outgoing edges to identify its blast radius.
3. Trace the complete contract: page or component → API client → mounted route → middleware → service → Prisma model.
4. Consult the matching flow document and confirmed product rules.
5. Update validation, authorization, persistence, and UI states together where applicable.
6. Regenerate and verify the graph before finishing.

## Regenerate and verify

From the repository root:

```powershell
npm run graph:verify
```

This regenerates the graph and validates its structure and important contracts. Review and commit any resulting graph changes with the related code change. Run it after changes to routes, middleware, services, Prisma models, frontend API calls, or other relationships represented by the graph.

## Interactive explorer

Open `index.html` locally or use the published GitHub Pages version. The explorer supports search, type and domain filters, dependency/dependent traversal, path finding, focus mode, multiple layouts, and node details with source locations.

The explorer is a view over `knowledge-graph.json`; it does not replace the machine graph or the written architecture and product-rule references.

## Publication

The Knowledge Graph Pages workflow publishes the explorer to GitHub Pages. Publication is separate from application CI so graph hosting does not duplicate backend, frontend, database, or Docker tests.
