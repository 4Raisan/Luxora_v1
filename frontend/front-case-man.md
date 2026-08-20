# Luxora frontend case manual

## Purpose and source of truth

This frontend preserves the **current Luxora API contract** while using `C:\Users\4Raisan\Desktop\OG-Luxora\frontend` as the visual reference. The old project contains local mock data, mock logins, and browser-storage workflows; do not copy those behaviours into this application.

Use this document when changing the UI. It explains which screen owns each user flow, the requests it already makes, and the limits that protect the working backend.

## Run locally

```bash
npm --prefix frontend install
npm --prefix frontend run dev -- --host 0.0.0.0
```

The browser talks to `VITE_API_URL` when it is set; otherwise `frontend/src/services/api.js` uses `/api` so Vite can proxy to the local backend. Do not hard-code an environment URL in a component.

## Visual system

- `src/components/PortalShell.jsx` is the authenticated-shell owner. It provides fixed navigation, the mobile drawer, the desktop customer header, notices, scroll state, and sign-out.
- `PortalShell.css` defines the base portal primitives.
- `PortalPolish.css` contains real-data dashboard layout treatment.
- `PortalMotion.css` and `PortalSpatial.css` contain only progressive visual motion: cursor ambience, button magnetism, reveal transitions, and shallow card depth.
- Motion must remain disabled for `prefers-reduced-motion` and must not be required to reach a control.
- Customer desktop navigation belongs in the fixed top header, matching OG-Luxora. Admin and Provider retain the fixed left workspace rail. At `900px` and below, all roles use the drawer plus bottom navigation so controls never sit under the viewport.

### OG layout translation

- Keep the OG hierarchy: a focused hero, compact summaries, dense operational records, and purposeful whitespace. Do not turn every content region into an oversized rounded panel.
- The top-bar label and the hero headline are intentionally separate (`title` and `heroTitle` on `PortalShell`). Use the former for compact navigation context and the latter for the page’s main story.
- Customer uses the OG full-width member arrival moment, then active memberships, booking, packages, service history, support, and profile. Admin uses compact metrics and operational tables; Provider uses a short welcome, three live summary metrics, then its work queue.
- Preserve `id` values in dashboard sections. Header/rail/mobile navigation relies on them for scroll navigation and active-state tracking.

## Route and API map

| Route | Screen owner | Existing reads | Existing writes/actions |
| --- | --- | --- | --- |
| `/login` | `pages/Login.jsx` | none | `POST /auth/login`, password-reset request |
| `/signup` | `pages/Signup.jsx` | none | customer registration |
| `/provider-register` | `pages/ProviderRegister.jsx` | categories where required | provider registration and uploads |
| `/customer-dashboard` | `pages/CustomerDashboard.jsx` | dashboard, services, subscriptions, entitlements, payments, payment mode, notifications, support, complaints, refunds, profile | booking, membership controls, payment completion, refund, support, complaint, profile, OTP, notification actions |
| `/provider-dashboard` | `pages/ProviderDashboard.jsx` | provider dashboard, assigned/claimable bookings, availability, towns, earnings | availability, booking status/PIN/proof actions, uploads |
| `/admin-dashboard` | `pages/AdminDashboard.jsx` | stats, reports, users, providers, bookings, categories, packages, complaints, promotions, support, refunds, scheduling | user/KYC/booking/refund/support/package/promotion/scheduling actions |
| `/book-service` | `pages/BookService.jsx` | services and customer data as implemented | booking action |
| public routes | `components/*`, `pages/Reviews.jsx` | only their present reads | only their present actions |

`src/services/api.js` is the only frontend request gateway. Keep endpoint paths, HTTP methods, request bodies, token handling, and error normalization there or in the existing callers. A redesign is not permission to add an endpoint.

## Customer flow

1. Login stores the backend-issued token and current user in `sessionStorage`.
2. The dashboard loads its existing data with one grouped request cycle. The header, membership cards, booking form, package catalogue, service history, support, and profile sections render from that data.
3. A package choice opens the existing payment flow. In `demo` mode it stays in Luxora and calls the existing demo order/completion endpoints. In PayHere mode it uses the existing server-supplied checkout form.
4. Booking controls only show services backed by the existing entitlement data. Do not fake an available balance in the UI.
5. Refund eligibility/status comes from `/refunds/my`; the UI must not calculate a different business rule in the browser.

## Provider flow

1. Provider availability, scheduled work, claims, PIN/proof steps, and earnings use the current provider and booking APIs.
2. A disabled/terminal booking is visually clear and must not expose an action that the backend will reject.
3. File uploads remain the existing upload action; never replace them with browser-only URLs or `localStorage` placeholders.

## Admin flow

1. The dashboard groups its existing reads to reduce backend connection pressure; preserve those groups rather than adding per-card fetches.
2. Metrics, reports, member management, KYC, bookings, plans, support, refunds, promotions, and scheduling show server data only.
3. Admin prompts are intentionally backed by current update endpoints. If replacing a prompt with a modal, call the same endpoint/body and show the server error beside the field.

## Error, loading, and empty-state rules

- A failed request is shown through the portal notice area; it must not silently turn into an empty list or a successful toast.
- `LoadingState` is used before the primary authenticated dataset exists. Keep role-specific data out of an unauthenticated or half-loaded screen.
- `EmptyState` explains why the list is empty and what real action can populate it. Do not use static OG sample rows.
- Destructive controls (cancel, disable, reject) must keep their confirmation and explain the result through the existing response/error path.
- Use visible labels, native form validation, keyboard-reachable buttons, and focusable drawers. Mobile content must remain within the viewport without horizontal scrolling.

## OG-Luxora compatibility cases

| OG visual/interaction | Current implementation | Safe status |
| --- | --- | --- |
| Customer sticky header and compact tabs | `PortalShell` customer header scrolls to real current sections | Supported |
| Admin/provider fixed workspace rail | `PortalShell` rail and top bar | Supported |
| Dark gold/green service styling | shared portal tokens and page CSS | Supported |
| Hover, cursor ambience, card depth | motion/spatial CSS only; reduced-motion fallback | Supported |
| Sample membership, bookings, notifications, and analytics | current API response fields | Do not copy OG sample data |
| Old role-by-email login fallback | current backend role from `/auth/login` | Not permitted |
| Old local password/profile persistence | current auth/profile endpoints | Not permitted |
| Old mock payment/refund shortcuts | current payment/refund endpoints | Not permitted |

## Change checklist

Before merging a frontend change:

1. Confirm it uses an already-listed endpoint and does not change a backend payload.
2. Test desktop, `900px`, `520px`, and a reduced-motion setting.
3. Check visual state for loading, empty data, a server validation error, and a successful action.
4. Run `npm --prefix frontend run build`, `npm --prefix frontend run lint`, and `git diff --check`.
5. Do not commit production URLs, credentials, test accounts, API keys, or database URLs.

## Known limits that need product/backend work first

- The exact OG dashboards include browser-only sample records and flows that have no current backend representation. They intentionally remain absent rather than pretending the action succeeded.
- No screen may invent partial refunds, balances, KYC states, payment outcomes, provider earnings, or notifications.
- If a desired OG control needs a field absent from the current response, document the needed contract change before adding UI. Do not introduce a speculative fetch from the frontend.
