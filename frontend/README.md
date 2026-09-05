# iLuxora Frontend

The Luxora frontend is a React and Vite application for customer, provider, and administrator workflows. It consumes the Luxora API through the shared request client in `src/services/api.js`.

## Local development

```powershell
npm ci
npm run dev
```

The development server runs at `http://localhost:3000` by default.

Useful checks:

```powershell
npm run lint
npm run build
```

## API configuration

Copy `.env.example` to `.env` and set `VITE_API_URL` when the API is not available at the default location.

```env
VITE_API_URL=http://localhost:5000/api
```

API resolution is intentionally environment-aware:

| Situation                          | API base used                 |
| ---------------------------------- | ----------------------------- |
| Development without `VITE_API_URL` | `http://localhost:5000/api`   |
| Production without `VITE_API_URL`  | Same-origin `/api`            |
| Separate frontend and API domains  | Explicit `VITE_API_URL` value |

The client normalizes an explicit URL so requests consistently use the `/api` prefix. A Vercel frontend deployed separately from the backend must define `VITE_API_URL` with the public backend URL.

All `VITE_` variables are embedded in the browser build and are public. Never store JWT secrets, payment secrets, database credentials, bank-encryption keys, or other server credentials in frontend environment variables.

## Production build

```powershell
npm run build
npm run preview
```

Vite writes the production bundle to `dist/`. Vercel should use `npm run build` and publish that directory.

## Authentication and navigation

The shared API client attaches the current bearer token and handles the configured API base. Protected pages must still respect backend authorization: frontend role redirects improve navigation but do not replace JWT, role, ownership, or provider-KYC checks enforced by the API.

When changing a page’s API usage, verify the full contract:

1. Request method and path.
2. Request body and validation rules.
3. Authentication and role requirements.
4. Response shape, loading, empty, and error states.
5. The matching backend route and service behaviour.

Then run `npm run graph:verify` from the repository root so the Knowledge Graph continues to reflect frontend-to-backend links.

## Source map

```text
src/pages/           Route-level screens
src/components/      Reusable UI components
src/services/api.js  API base resolution and authenticated requests
src/App.jsx           Routes and role entry points
public/              Static public assets
```

See the [root README](../README.md) for full-project setup and the [Knowledge Graph guide](../Knowladge-Graph/README.md) for cross-layer navigation.
