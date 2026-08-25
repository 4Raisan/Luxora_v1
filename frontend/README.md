# Luxora Frontend

React 19 + Vite SPA. The UI renders server data; the API remains the authority for roles, payments, coins, bookings, and database writes.

## Run locally

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Commands

```powershell
npm run dev
npm run build
npm run preview
npm run lint
```

## Environment

| Variable | Example |
| --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` |

Only `VITE_` variables reach the browser. Never put database, JWT, payment, email, or WhatsApp secrets in this file.

## Important paths

| Path | Purpose |
| --- | --- |
| `src/App.jsx` | Routes and role entry points |
| `src/services/api.js` | API base URL and request helper |
| `src/pages/*Dashboard.jsx` | Customer, provider, admin workspaces |
| `src/components/PortalShell.jsx` | Shared portal layout |

## UI checks

```text
1. Start the backend and check /api/health.
2. Confirm Network requests use VITE_API_URL.
3. Test a real signed-in read/write flow.
4. Check desktop and mobile layouts.
5. Run build and lint.
```

Use `apiRequest()`, refresh from the server after mutations, and show API errors instead of inventing local records.
