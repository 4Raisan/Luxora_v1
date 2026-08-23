# Luxora frontend
React 19/Vite SPA. The frontend owns presentation, navigation, form state, and API calls; it does not own authentication truth, authorization, package/refund/payment rules, booking state, or database writes.
## Commands
    npm install
    Copy-Item .env.example .env.local
    npm run dev
    npm run build
    npm run preview
    npm run lint
The root equivalents are npm run frontend, npm run build, and npm run lint.
## Environment
VITE_API_URL is the complete API prefix, normally ending in /api, such as http://localhost:5000/api. Only VITE_ variables are exposed to the browser. Never put JWT, database, gateway, email, or SMS secrets here.
## Important paths
- src/main.jsx: entry point and global styles.
- src/App.jsx: router and protected role routes.
- src/services/api.js: base URL, request helper, Bearer headers, JSON/multipart handling.
- src/pages/CustomerDashboard.jsx, ProviderDashboard.jsx, AdminDashboard.jsx: role workspaces.
- src/components/PortalShell.jsx and PortalShell*.css: fixed desktop rail/top bar, mobile drawer, shared statuses/loading, motion/spatial effects.
## API conventions
Use apiRequest from src/services/api.js with paths relative to the API prefix. Use the existing session token. Treat non-2xx as errors and display safe messages. Use FormData for uploads without manually setting Content-Type. Refresh from the backend after mutations; never fabricate records. UI role checks never replace backend authorization.
## Responsive rules
Keep the shared dark architectural palette and PortalShell. Preserve keyboard/focus access, readable errors, fixed header/rail, mobile drawer/bottom navigation, reduced-motion support, and no horizontal overflow. Do not add heavy WebGL or pointer-driven React state.
## Verification
Start backend and confirm /api/health; confirm Network uses intended VITE_API_URL; test login and a real read/write flow; check 1440/1280 desktop and 768/390 mobile; inspect Console for 404/403/500; run build and lint.
