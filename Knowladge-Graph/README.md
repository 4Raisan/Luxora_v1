# 🕸️ Luxora Codebase Knowledge Graph

Welcome to the **Luxora Knowledge Graph** hub. This directory provides automated tools, interactive visual diagrams, machine-readable dependency graphs, and debugging playbooks designed specifically for **AI Coding Agents** and human engineers.

---

## 📁 Directory Structure

| File | Purpose |
| :--- | :--- |
| **`generate-graph.js`** | Automated scanner that parses Prisma, Express routes, services, middleware, and React frontend to generate the live graph. |
| **`index.html`** | Interactive visual web application to search, filter, and inspect nodes, dependencies, and blast radius in any browser. |
| **`knowledge-graph.json`** | Machine-readable structured graph (163+ nodes, 259+ edges) for AI agents to query dependency paths. |
| **`ARCHITECTURE_GRAPH.md`** | Comprehensive reference specification of the system architecture, API matrix, and state machines. |
| **`AGENT_DEBUGGING_PLAYBOOK.md`** | Step-by-step impact-analysis and debugging guide for coding agents. |

---

## 🚀 How to Use

### 1. View the Interactive Knowledge Graph in Browser
Simply open `Knowladge-Graph/index.html` in your web browser, or serve it locally.

**Features:**
- 🔍 **Real-time Search**: Search by component name (`CustomerDashboard`), API path (`/api/bookings`), service, or database model (`User`).
- 🏷️ **Group Filters**: Filter by Frontend, Routes, API Endpoints, Services, Middleware, or Database models.
- 🎯 **Blast Radius Inspector**: Click any node to instantly view all upstream callers and downstream dependencies.

### 2. Regenerate the Graph After Code Changes
Whenever you add or change files, routes, models, or components, run:

```bash
npm run graph
```
or
```bash
node Knowladge-Graph/generate-graph.js
```

This will automatically re-scan the entire codebase and update both `knowledge-graph.json` and `index.html`.
