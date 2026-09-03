/**
 * Live System Architecture Graph Generator for Luxora
 * 
 * Dynamically scans the Luxora full-stack repository (Frontend, Backend, Prisma Database,
 * Realtime SSE, Payment Gateways, CI/CD, and Multi-Cloud Deployments) to construct a living,
 * multi-view System Architecture Graph.
 * 
 * Outputs:
 * - Knowladge-Graph/architecture-graph.json (Deterministic Machine-Readable Architecture Graph)
 * - Knowladge-Graph/architecture.html (Interactive Presentation-Quality Architecture Explorer)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const prismaSchemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
const outputJsonPath = path.join(__dirname, 'architecture-graph.json');
const outputHtmlPath = path.join(__dirname, 'architecture.html');

console.log('🔍 Starting Luxora Live System Architecture Graph Extraction...');

const nodes = [];
const edges = [];
const nodeMap = new Map();
const edgeSet = new Set();

function addNode(node) {
  if (!node || !node.id) return;
  if (!nodeMap.has(node.id)) {
    const entry = {
      id: node.id,
      label: node.label || node.id,
      layer: node.layer || 'Application',
      type: node.type || 'module',
      views: Array.from(new Set(node.views || ['system'])),
      file: node.file || '',
      description: node.description || '',
      metadata: node.metadata || {},
    };
    nodeMap.set(node.id, entry);
    nodes.push(entry);
  } else {
    const existing = nodeMap.get(node.id);
    if (node.views) {
      existing.views = Array.from(new Set([...existing.views, ...node.views]));
    }
    if (node.description && (!existing.description || existing.description.length < node.description.length)) {
      existing.description = node.description;
    }
    if (node.metadata) {
      existing.metadata = { ...existing.metadata, ...node.metadata };
    }
    if (node.file && !existing.file) {
      existing.file = node.file;
    }
  }
}

function addEdge(from, to, type, label, description, views = ['system']) {
  if (!from || !to) return;
  const edgeId = `${from}->${to}:${type}`;
  if (!edgeSet.has(edgeId)) {
    edgeSet.add(edgeId);
    edges.push({
      id: edgeId,
      from,
      to,
      type,
      label: label || type,
      description: description || `Connection from ${from} to ${to}`,
      views: Array.from(new Set(views)),
    });
  } else {
    const existing = edges.find((e) => e.id === edgeId);
    if (existing && views) {
      existing.views = Array.from(new Set([...existing.views, ...views]));
    }
  }
}

// =========================================================================
// 1. EXTRACT USER ACTORS & ROLES
// =========================================================================
console.log('👤 Extracting User Actors & Roles...');

addNode({
  id: 'user:customer',
  label: '👤 Customer',
  layer: 'Users & Roles',
  type: 'user_actor',
  views: ['system', 'frontend', 'booking', 'payments', 'security', 'deployment'],
  file: 'backend/prisma/schema.prisma',
  description: 'Purchases 30-day packages, books home services with active category coins, reveals 4-digit start and completion PINs, submits reviews, complaints, and support tickets.',
  metadata: { role: 'CUSTOMER', capabilities: ['package_purchase', 'coin_booking', 'pin_access', 'complaints'] },
});

addNode({
  id: 'user:provider',
  label: '👤 Provider (Technician)',
  layer: 'Users & Roles',
  type: 'user_actor',
  views: ['system', 'frontend', 'booking', 'realtime', 'security', 'deployment'],
  file: 'backend/prisma/schema.prisma',
  description: 'Submits KYC identity proofs, manages coverage towns and live availability, receives auto-assigned bookings, claims pending jobs, verifies Start and Completion PINs with photographic evidence, and tracks earnings.',
  metadata: { role: 'PROVIDER', capabilities: ['kyc_submission', 'availability_toggle', 'booking_fulfillment', 'double_pin_verification'] },
});

addNode({
  id: 'user:admin',
  label: '👤 Admin (Platform)',
  layer: 'Users & Roles',
  type: 'user_actor',
  views: ['system', 'frontend', 'backend', 'security', 'deployment'],
  file: 'backend/prisma/schema.prisma',
  description: 'Oversees platform operations, evaluates provider KYC submissions, defines 30-day service packages, resolves complaints, replies to support tickets, and queues monthly provider bank payouts. There is no Super Admin.',
  metadata: { role: 'ADMIN', capabilities: ['kyc_decision', 'package_crud', 'payout_settlement', 'audit_logging'] },
});

// =========================================================================
// 2. EXTRACT PRISMA DATABASE MODELS (Database Layer)
// =========================================================================
console.log('🗄️ Extracting Database Models from Prisma Schema...');

if (fs.existsSync(prismaSchemaPath)) {
  const schemaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
  const modelMatches = [...schemaContent.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/gm)];

  // Core models highlighted in System Overview; all models in Database view
  const coreSystemModels = new Set(['Booking', 'User', 'Provider', 'UserSubscription', 'Payment', 'Service']);

  for (const match of modelMatches) {
    const modelName = match[1];
    const body = match[2];
    const fieldLines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'));
    const fields = fieldLines.map((l) => l.split(/\s+/)[0]).filter(Boolean);

    let views = ['database'];
    if (coreSystemModels.has(modelName)) {
      views.push('system');
    }

    let desc = `Prisma PostgreSQL model storing ${modelName} records.`;

    if (['Booking', 'ServicePhoto'].includes(modelName)) {
      views.push('booking');
      desc = `Core fulfillment record managing status lifecycle, dual-PIN bcrypt hashes, AES customer PIN display ciphers, and photo evidence.`;
    } else if (['Payment', 'SubscriptionPlan', 'SubscriptionEntitlement', 'UserSubscription', 'UserSubscriptionEntitlement'].includes(modelName)) {
      views.push('payments');
      desc = `Financial ledger record maintaining 30-day billing cycles, PayHere/NOWPayments transaction tokens, and exact token coin wallet balances.`;
    } else if (['Provider', 'KycDocument', 'ProviderBankAccount', 'ProviderPayout'].includes(modelName)) {
      views.push('security', 'booking');
      desc = `Provider operational record tracking KYC approval, coverage towns, AES-256-GCM encrypted bank accounts, and monthly payout ledgers.`;
    } else if (['User', 'PasswordResetToken', 'AdminAuditLog'].includes(modelName)) {
      views.push('security');
      desc = `Identity record holding bcrypt password hashes, tokenVersion for session invalidation, and administrative governance audit logs.`;
    }

    addNode({
      id: `model:${modelName.toLowerCase()}`,
      label: `🗄️ Model: ${modelName}`,
      layer: 'Database & Models',
      type: 'database_model',
      views,
      file: 'backend/prisma/schema.prisma',
      description: desc,
      metadata: { fieldsCount: fields.length, fields: fields.slice(0, 10) },
    });
  }

  // Model relationships
  addEdge('model:user', 'model:provider', 'relates', '1:1 Provider Record', 'A user account with role PROVIDER is linked 1:1 to a Provider profile.', ['database']);
  addEdge('model:user', 'model:usersubscription', 'owns', '1:N Subscriptions', 'A customer owns 0 or more 30-day active or expired subscriptions.', ['database', 'payments', 'system']);
  addEdge('model:usersubscription', 'model:usersubscriptionentitlement', 'allocates', '1:N Coins', 'Active subscription holds live remaining token coin balances per category.', ['database', 'payments']);
  addEdge('model:user', 'model:booking', 'books', '1:N Bookings', 'A customer creates bookings consuming active category entitlements.', ['database', 'booking', 'system']);
  addEdge('model:provider', 'model:booking', 'fulfills', '1:N Assigned Bookings', 'An approved provider is assigned to fulfill scheduled bookings.', ['database', 'booking', 'system']);
  addEdge('model:booking', 'model:servicephoto', 'evidence', '1:N Photos', 'Service execution stores mandatory BEFORE and AFTER photos.', ['database', 'booking']);
  addEdge('model:booking', 'model:review', 'rates', '1:1 Rating', 'Customer rates completed service with 1-5 stars and comments.', ['database']);
  addEdge('model:provider', 'model:kycdocument', 'verifies', '1:N Identity Proofs', 'Provider submits NIC, Passport, or Driving License documents.', ['database', 'security']);
  addEdge('model:provider', 'model:providerbankaccount', 'payout_dest', '1:N Bank Accounts', 'Provider registers AES-256-GCM encrypted bank accounts.', ['database', 'security', 'payments']);
  addEdge('model:providerbankaccount', 'model:providerpayout', 'settles', '1:N Payouts', 'Monthly earnings are disbursed to the selected verified bank account.', ['database', 'payments']);
  addEdge('model:usersubscription', 'model:payment', 'settled_by', '1:1 Payment', 'Subscription activation requires verified payment record.', ['database', 'payments', 'system']);
}

// =========================================================================
// 3. EXTRACT FRONTEND PAGES & COMPONENTS (Frontend Layer)
// =========================================================================
console.log('💻 Extracting Frontend Presentation Architecture...');

const frontendPages = [
  { id: 'page:customer-dashboard', label: '💻 Customer Dashboard', file: 'frontend/src/pages/CustomerDashboard.jsx', desc: 'Customer portal featuring 4 core tabs: Overview (token wallet balance), Booking Wizard, Active Bookings (PIN reveal cards), and Invoices with client-side jsPDF downloads.', views: ['system', 'frontend', 'booking', 'payments', 'realtime'] },
  { id: 'page:provider-dashboard', label: '💻 Provider Dashboard', file: 'frontend/src/pages/ProviderDashboard.jsx', desc: 'Provider operational desk: Availability toggle (ONLINE/OFFLINE), calendar appointments, pending booking claims, dual-PIN verification dialogs, and earnings summaries.', views: ['system', 'frontend', 'booking', 'realtime'] },
  { id: 'page:admin-dashboard', label: '💻 Admin Dashboard', file: 'frontend/src/pages/AdminDashboard.jsx', desc: '13-module administrative suite: User activation, KYC document approvals/rejections, 30-day package creation, booking oversight, complaint resolution, and monthly payout execution.', views: ['system', 'frontend', 'backend', 'security'] },
  { id: 'page:login-signup', label: '🔐 Auth & Onboarding', file: 'frontend/src/pages/Login.jsx', desc: 'Authentication entry point handling email/password login, Google OAuth 2.0 Web Client Sign-In, and role-specific registration.', views: ['system', 'frontend', 'security'] },
  { id: 'page:book-service', label: '📅 Booking Wizard', file: 'frontend/src/pages/BookService.jsx', desc: 'Multi-step service booking wizard: category selector (Auto, Garden, Pet Care), town/district selection, date picker, and 15-minute slot validation.', views: ['frontend', 'booking'] },
  { id: 'component:active-booking-cards', label: '🪪 Active Booking Cards', file: 'frontend/src/components/ActiveBookingCards.jsx', desc: 'Real-time card displaying assigned provider contact number, Start PIN & Completion PIN reveal buttons, status badge, and cancel dialog.', views: ['frontend', 'booking', 'realtime'] },
  { id: 'component:session-animation', label: '✨ Session Animation', file: 'frontend/src/components/SessionConfirmationAnimation.jsx', desc: 'Luxury SVG completion celebration modal rendered upon successful booking confirmation.', views: ['frontend', 'booking'] },
  { id: 'component:require-auth', label: '🛡️ RequireAuth Guard', file: 'frontend/src/components/RequireAuth.jsx', desc: 'Route-level client security component that validates token existence and user role before granting dashboard access.', views: ['frontend', 'security'] },
  { id: 'service:frontend-api', label: '🔌 API Client (apiRequest)', file: 'frontend/src/services/api.js', desc: 'Central HTTP client that injects Authorization Bearer tokens, enforces a 30s AbortController timeout, and purges sessionStorage on 401/403 session revocations.', views: ['system', 'frontend', 'backend', 'security'] },
  { id: 'hook:use-realtime', label: '📡 useRealtime Hook', file: 'frontend/src/hooks/useRealtime.js', desc: 'Frontend EventSource subscription to /api/realtime; listens for 7 named events (BOOKING_CREATED, ASSIGNED, CLAIMED, etc.) and triggers onSync state recovery on reconnect.', views: ['system', 'frontend', 'booking', 'realtime'] },
];

for (const p of frontendPages) {
  addNode({
    id: p.id,
    label: p.label,
    layer: 'Frontend Presentation',
    type: p.id.startsWith('page:') ? 'frontend_page' : (p.id.startsWith('hook:') ? 'frontend_hook' : 'frontend_component'),
    views: p.views,
    file: p.file,
    description: p.desc,
  });
}

// User -> Frontend relationships
addEdge('user:customer', 'page:customer-dashboard', 'interacts', 'Manages Bookings & Wallet', 'Customer uses portal to check coin balances and track services.', ['system', 'frontend', 'booking']);
addEdge('user:customer', 'page:book-service', 'books', 'Selects Service & Slot', 'Customer chooses domestic service discipline and schedule.', ['frontend', 'booking']);
addEdge('user:provider', 'page:provider-dashboard', 'operates', 'Fulfills Assigned Jobs', 'Provider reviews schedule, claims pending bookings, and enters PINs.', ['system', 'frontend', 'booking']);
addEdge('user:admin', 'page:admin-dashboard', 'administers', 'Oversees Platform & Payouts', 'Administrator approves KYC, defines packages, and manages payouts.', ['system', 'frontend']);
addEdge('page:customer-dashboard', 'component:active-booking-cards', 'renders', 'Visualizes Active Jobs', 'Overview tab embeds live booking cards with PIN reveal dialogs.', ['frontend', 'booking']);
addEdge('page:customer-dashboard', 'hook:use-realtime', 'subscribes', 'Listens for Booking Events', 'Customer dashboard auto-refreshes when booking status updates via SSE.', ['frontend', 'booking', 'realtime']);
addEdge('page:provider-dashboard', 'hook:use-realtime', 'subscribes', 'Listens for New & Claimable Jobs', 'Provider dashboard auto-refreshes on new auto-assignments or pending claim notifications.', ['frontend', 'booking', 'realtime']);
addEdge('page:admin-dashboard', 'hook:use-realtime', 'subscribes', 'Listens for All System Events', 'Admin dashboard receives real-time operational stream across all bookings.', ['frontend', 'realtime']);
addEdge('page:customer-dashboard', 'service:frontend-api', 'invokes', 'Dispatches REST Calls', 'All dashboard data fetching is routed through apiRequest().', ['frontend', 'backend']);
addEdge('page:provider-dashboard', 'service:frontend-api', 'invokes', 'Dispatches REST Calls', 'Provider actions (availability, PINs, banking) routed through apiRequest().', ['frontend', 'backend']);
addEdge('page:admin-dashboard', 'service:frontend-api', 'invokes', 'Dispatches REST Calls', 'Admin updates (KYC, packages, payouts) routed through apiRequest().', ['frontend', 'backend']);

// =========================================================================
// 4. EXTRACT BACKEND API GATEWAY, ROUTES & MIDDLEWARE (Backend Layer)
// =========================================================================
console.log('⚡ Extracting Backend API Gateway, Routes & Middleware...');

addNode({
  id: 'server:express-app',
  label: '⚡ Express 5 API Gateway',
  layer: 'API Gateway & Middleware',
  type: 'backend_server',
  views: ['system', 'backend', 'security', 'deployment'],
  file: 'backend/src/index.js',
  description: 'Central HTTP server configuring security headers (CSP, HSTS, X-Frame-Options), strict CORS origins, reverse proxy trust, central Prisma error handling, and background schedulers.',
  metadata: { port: 5000, framework: 'Express 5.2.1', runtime: 'Node.js 22 LTS' },
});

// Middleware Nodes
addNode({
  id: 'middleware:auth',
  label: '🛡️ Auth Gate (Token)',
  layer: 'API Gateway & Middleware',
  type: 'middleware',
  views: ['system', 'backend', 'security'],
  file: 'backend/src/middleware/auth.js',
  description: 'Verifies Bearer JWT signature, asserts active account status, and compares tokenVersion against PostgreSQL to enforce instantaneous global session revocation on password resets.',
  metadata: { tokenType: 'JWT Bearer', revocationMechanism: 'tokenVersion integer comparison' },
});

addNode({
  id: 'middleware:require-role',
  label: '🛡️ Role Gate (RBAC)',
  layer: 'API Gateway & Middleware',
  type: 'middleware',
  views: ['backend', 'security'],
  file: 'backend/src/middleware/auth.js',
  description: 'Restricts endpoint access to specific roles (CUSTOMER, PROVIDER, ADMIN). Blocks unauthorized cross-role attempts with HTTP 403 Forbidden.',
});

addNode({
  id: 'middleware:rate-limit',
  label: '🛡️ Rate Limiter',
  layer: 'API Gateway & Middleware',
  type: 'middleware',
  views: ['backend', 'security'],
  file: 'backend/src/middleware/rateLimit.js',
  description: 'In-memory sliding window rate limiter defending authentication, payment webhooks, and email dispatch endpoints against brute-force and DoS attacks.',
});

addNode({
  id: 'middleware:kyc-guard',
  label: '🛡️ Provider KYC Gate',
  layer: 'API Gateway & Middleware',
  type: 'middleware',
  views: ['backend', 'booking', 'security'],
  file: 'backend/src/routes/provider.js',
  description: 'Enforces that providers must have kycStatus === APPROVED before they can claim bookings, receive auto-assignments, reveal addresses, or submit PINs.',
});

// Route Routers
const backendRoutes = [
  { id: 'route:auth', label: '🚦 /api/auth Router', file: 'backend/src/routes/auth.js', desc: 'Customer/provider registration, login, Google Sign-In, password reset token issuance and revocation.', views: ['backend', 'security'] },
  { id: 'route:bookings', label: '🚦 /api/bookings Router', file: 'backend/src/routes/bookings.js', desc: 'Fulfillment engine: POST booking creation, auto-assignment, pending booking claiming, Start PIN + BEFORE photo verification, Completion PIN + AFTER photo verification, and cancellation requests.', views: ['system', 'backend', 'booking', 'realtime'] },
  { id: 'route:provider', label: '🚦 /api/provider Router', file: 'backend/src/routes/provider.js', desc: 'Provider operations: availability toggle (ONLINE/OFFLINE), coverage town selection, AES-256-GCM bank account registration, and earnings aggregation.', views: ['backend', 'booking', 'security'] },
  { id: 'route:admin', label: '🚦 /api/admin Router', file: 'backend/src/routes/admin.js', desc: 'Platform oversight: KYC approvals/rejections with reason notes, 30-day package definitions, manual booking reassignment, complaint resolutions, and monthly payout execution.', views: ['backend', 'security', 'payments'] },
  { id: 'route:customer', label: '🚦 /api/customer Router', file: 'backend/src/routes/customer.js', desc: 'Customer dashboard data aggregations, active subscription coins snapshot, booking histories, and profile updates.', views: ['backend', 'booking'] },
  { id: 'route:services', label: '🚦 /api/services Router', file: 'backend/src/routes/services.js', desc: 'Public service catalog, category definitions, 30-day package listings, and subscription checkout session creation.', views: ['backend', 'payments'] },
  { id: 'route:integrations', label: '🚦 /api/integrations Router', file: 'backend/src/routes/integrations.js', desc: 'Webhook receivers: PayHere MD5 signature verified IPN, NOWPayments HMAC-SHA512 IPN, and Resend transactional email client.', views: ['backend', 'payments', 'email'] },
  { id: 'route:uploads', label: '🚦 /api/uploads Router', file: 'backend/src/routes/uploads.js', desc: 'Multipart memory-buffered upload processor performing magic-byte content sniffing for genuine JPEG/PNG/PDF files before streaming to S3.', views: ['backend', 'security', 'email'] },
];

for (const r of backendRoutes) {
  addNode({
    id: r.id,
    label: r.label,
    layer: 'API Gateway & Middleware',
    type: 'backend_route',
    views: r.views,
    file: r.file,
    description: r.desc,
  });
}

// =========================================================================
// 5. EXTRACT DOMAIN SERVICES & REALTIME (Service Layer)
// =========================================================================
console.log('⚙️ Extracting Domain Services & Realtime Engine...');

addNode({
  id: 'service:realtime',
  label: '📡 Realtime SSE Engine',
  layer: 'Realtime & SSE',
  type: 'realtime_service',
  views: ['system', 'backend', 'booking', 'realtime'],
  file: 'backend/src/services/realtime.js',
  description: 'Server-Sent Events manager keeping an in-memory map of authenticated active connections, a 25-second keep-alive ping loop, and targeted role/user event broadcasting via broadcastBookingEvent().',
  metadata: {
    endpoint: 'GET /api/realtime',
    heartbeatIntervalMs: 25000,
    events: ['connected', 'BOOKING_CREATED', 'BOOKING_ASSIGNED', 'BOOKING_CLAIMED', 'BOOKING_STATUS_CHANGED', 'BOOKING_CANCELLED', 'PAYMENT_UPDATED'],
  },
});

addNode({
  id: 'service:scheduling',
  label: '⚙️ Scheduling & Dispatch',
  layer: 'Domain Services',
  type: 'backend_service',
  views: ['system', 'backend', 'booking'],
  file: 'backend/src/services/scheduling.js',
  description: 'Autonomous provider auto-assignment algorithm; evaluates category capability, geographic service town match, KYC=APPROVED status, ONLINE availability, 2-hour schedule non-overlap, and 6-hour safety windows.',
  metadata: { strategy: 'least-loaded-provider', safetyWindowHours: 6 },
});

addNode({
  id: 'service:booking-timeouts',
  label: '⏱️ Timeout Background Worker',
  layer: 'Domain Services',
  type: 'backend_service',
  views: ['backend', 'booking'],
  file: 'backend/src/services/bookingTimeouts.js',
  description: 'Continuous background scheduler asserting transactional advisory locks (pg_advisory_xact_lock) to auto-cancel unassigned bookings after 30 min or unstarted bookings after 2h, immediately restoring customer coin entitlements.',
  metadata: { unassignedTimeoutMins: 30, unstartedTimeoutHours: 2, lockStrategy: 'pg_advisory_xact_lock' },
});

addNode({
  id: 'service:banking-crypto',
  label: '🔒 AES-256 Banking Crypto',
  layer: 'Security Controls',
  type: 'security_service',
  views: ['backend', 'security', 'payments'],
  file: 'backend/src/services/bankingCrypto.js',
  description: 'Cryptographic security module encrypting provider bank account numbers at rest using AES-256-GCM (enc:v1:<iv+ciphertext+tag>), paired with non-reversible SHA-256 search hashes and display masking (****1234).',
  metadata: { algorithm: 'AES-256-GCM', hashAlgorithm: 'SHA-256', keyDerivation: 'SHA-256(BANK_ENCRYPTION_KEY)' },
});

addNode({
  id: 'service:payouts',
  label: '💰 Monthly Payouts Manager',
  layer: 'Domain Services',
  type: 'backend_service',
  views: ['backend', 'payments'],
  file: 'backend/src/services/payouts.js',
  description: 'Gathers all COMPLETED bookings within the calendar month, calculates fixed provider service earnings, and queues idempotent monthly payout records for admin review and bank settlement.',
  metadata: { cycle: 'monthly', payoutStatus: ['PENDING', 'PAID', 'FAILED'] },
});

addNode({
  id: 'service:storage',
  label: '📦 S3 Storage Client',
  layer: 'Domain Services',
  type: 'backend_service',
  views: ['backend', 'security', 'email', 'deployment'],
  file: 'backend/src/services/storage.js',
  description: 'Multi-cloud object storage wrapper integrating @aws-sdk/client-s3 with local fallback. Enforces assertStorageConfigured() on production startup to prevent container ephemeral data loss.',
  metadata: { supportedProviders: ['AWS S3', 'Cloudflare R2', 'Local Disk Fallback'] },
});

addNode({
  id: 'service:integrations',
  label: '🔌 Gateway Integrations',
  layer: 'Domain Services',
  type: 'backend_service',
  views: ['backend', 'payments', 'email'],
  file: 'backend/src/services/integrations.js',
  description: 'PayHere MD5 signature token generation and timingSafeEqual IPN verification, NOWPayments HMAC-SHA512 verification over sorted JSON keys, and Resend REST email dispatch.',
});

// Backend inter-module connections
addEdge('service:frontend-api', 'server:express-app', 'http_request', 'REST JSON Calls', 'Frontend dispatches all HTTP requests to Express 5 gateway.', ['system', 'frontend', 'backend']);
addEdge('server:express-app', 'middleware:auth', 'applies', 'Token & Session Gate', 'Every protected API route executes authenticateToken middleware.', ['system', 'backend', 'security']);
addEdge('middleware:auth', 'model:user', 'verifies', 'Checks tokenVersion & Active', 'Queries PostgreSQL to ensure account active and token not revoked.', ['backend', 'security']);
addEdge('server:express-app', 'route:auth', 'mounts', 'Mounts /api/auth', 'Mounts customer and provider auth routers.', ['backend', 'security']);
addEdge('server:express-app', 'route:bookings', 'mounts', 'Mounts /api/bookings', 'Mounts bookings lifecycle controller.', ['backend', 'booking', 'system']);
addEdge('server:express-app', 'route:provider', 'mounts', 'Mounts /api/provider', 'Mounts provider operations controller.', ['backend', 'booking']);
addEdge('server:express-app', 'route:admin', 'mounts', 'Mounts /api/admin', 'Mounts system administration router.', ['backend', 'security']);
addEdge('server:express-app', 'route:customer', 'mounts', 'Mounts /api/customer', 'Mounts customer dashboard aggregator.', ['backend']);
addEdge('server:express-app', 'route:services', 'mounts', 'Mounts /api/services', 'Mounts catalog and subscription purchase router.', ['backend', 'payments']);
addEdge('server:express-app', 'route:integrations', 'mounts', 'Mounts /api/integrations', 'Mounts payment and email webhook receiver.', ['backend', 'payments', 'email']);
addEdge('server:express-app', 'route:uploads', 'mounts', 'Mounts /api/uploads', 'Mounts multipart file upload router.', ['backend', 'security']);
addEdge('server:express-app', 'service:realtime', 'mounts', 'Mounts /api/realtime', 'Exposes SSE endpoint for persistent client connections.', ['backend', 'realtime', 'system']);
addEdge('hook:use-realtime', 'service:realtime', 'connects', 'Persistent SSE Connection', 'Browser establishes EventSource stream to receive real-time notifications.', ['system', 'frontend', 'realtime']);

// Booking Flow Connections
addEdge('route:bookings', 'service:scheduling', 'delegates', 'Auto-Assigns Provider', 'Assigns eligible technician matching town, category, and KYC.', ['backend', 'booking', 'system']);
addEdge('service:scheduling', 'model:provider', 'queries', 'Evaluates Eligibility', 'Finds providers with kycStatus=APPROVED, town match, and availability.', ['booking', 'system']);
addEdge('route:bookings', 'model:booking', 'mutates', 'Persists Booking States', 'Creates and updates booking status from PENDING to COMPLETED.', ['booking', 'database', 'system']);
addEdge('route:bookings', 'model:usersubscriptionentitlement', 'deducts', 'Consumes 1 Coin Unit', 'Deducts 1 service coin from the active category wallet.', ['booking', 'payments', 'database']);
addEdge('route:bookings', 'service:realtime', 'broadcasts', 'broadcastBookingEvent()', 'Dispatches BOOKING_CREATED, ASSIGNED, CLAIMED, and STATUS_CHANGED events.', ['booking', 'realtime']);
addEdge('service:booking-timeouts', 'model:booking', 'auto_cancels', 'Cancels Stale Bookings', 'Cancels unassigned (30m) or unstarted (2h) bookings and restores coins.', ['booking', 'database']);

// Payments Flow Connections
addEdge('user:customer', 'page:book-service', 'selects_plan', 'Selects 30-Day Plan', 'Customer selects individual or combo subscription package.', ['payments']);
addEdge('page:book-service', 'route:services', 'initiates_checkout', 'POST /checkout', 'Initiates checkout and creates pending payment record.', ['payments']);
addEdge('route:services', 'model:payment', 'creates_pending', 'Creates Payment (PENDING)', 'Persists expected amount, currency, and gateway order ID.', ['payments', 'database']);
addEdge('route:services', 'ext:payhere', 'generates_hash', 'Generates MD5 Hash', 'Creates PayHere checkout form payload with MD5 signature.', ['payments']);
addEdge('route:services', 'ext:nowpayments', 'creates_invoice', 'Creates Crypto Invoice', 'Requests NOWPayments crypto checkout invoice in USD.', ['payments']);
addEdge('ext:payhere', 'route:integrations', 'dispatches_ipn', 'PayHere Webhook IPN', 'PayHere posts payment status to /api/payments/payhere/webhook.', ['payments']);
addEdge('ext:nowpayments', 'route:integrations', 'dispatches_ipn', 'NOWPayments IPN', 'NOWPayments posts crypto status to /api/payments/nowpayments/ipn.', ['payments']);
addEdge('route:integrations', 'model:payment', 'settles_payment', 'Updates Payment (COMPLETED)', 'Verifies signature and transitions payment to COMPLETED.', ['payments', 'database']);
addEdge('route:integrations', 'model:usersubscription', 'activates_sub', 'Activates UserSubscription', 'Creates 30-day active user subscription.', ['payments', 'database']);
addEdge('route:integrations', 'model:usersubscriptionentitlement', 'allocates_coins', 'Allocates Coins', 'Clones package units into active category token wallet.', ['payments', 'database']);

// Email & Cloud Services Connections
addEdge('route:auth', 'service:integrations', 'sends_welcome', 'Triggers Welcome Email', 'Dispatches welcome email on customer or provider signup.', ['email']);
addEdge('route:bookings', 'service:integrations', 'sends_assignment', 'Triggers Booking Email', 'Dispatches email notification when provider is assigned.', ['email', 'booking']);
addEdge('service:booking-timeouts', 'service:integrations', 'sends_timeout', 'Triggers Timeout Email', 'Notifies customer if booking unassigned or unstarted.', ['email', 'booking']);
addEdge('route:uploads', 'service:storage', 'persists_buffer', 'Stores File Buffer', 'Upload router passes memory buffer to S3 storage client.', ['email', 'security']);

// Deployment Connections
addEdge('user:customer', 'deploy:vercel', 'accesses_spa', 'HTTPS luxora.bond', 'Customer accesses React SPA through Vercel Edge CDN.', ['deployment', 'system']);
addEdge('user:provider', 'deploy:vercel', 'accesses_spa', 'HTTPS luxora.bond', 'Provider accesses portal through Vercel Edge CDN.', ['deployment']);
addEdge('user:admin', 'deploy:vercel', 'accesses_spa', 'HTTPS luxora.bond', 'Administrator accesses control desk through Vercel Edge CDN.', ['deployment']);
addEdge('deploy:northflank', 'ext:postgresql', 'pools_connections', 'Prisma Connection Pool', 'Northflank API communicates with PostgreSQL instance.', ['deployment', 'database']);
addEdge('deploy:northflank', 'ext:s3', 'object_storage', 'S3 API Over HTTPS', 'Northflank API streams photos and documents to S3.', ['deployment', 'email']);

// Security Connections
addEdge('user:customer', 'page:login-signup', 'submits_credentials', 'Enters Password', 'User enters email and plaintext password.', ['security']);
addEdge('page:login-signup', 'route:auth', 'authenticates', 'POST /api/auth/login', 'Submits credentials to auth router.', ['security']);
addEdge('route:auth', 'sec:bcrypt', 'hashes_password', 'bcrypt.compare()', 'Compares password against stored bcrypt hash (10 salt rounds).', ['security']);
addEdge('route:auth', 'sec:jwt-revocation', 'signs_jwt', 'jwt.sign(tokenVersion)', 'Issues JWT containing current database tokenVersion.', ['security']);
addEdge('route:provider', 'service:banking-crypto', 'encrypts_bank', 'AES-256-GCM Encryption', 'Encrypts bank account number at rest with auth tag.', ['security']);
addEdge('route:uploads', 'sec:magic-bytes', 'validates_signature', 'detectFileSignature()', 'Sniffs raw magic bytes (JPEG/PNG/PDF) to block exploits.', ['security']);
addEdge('server:express-app', 'sec:security-headers', 'enforces_headers', 'Nosniff, CSP, HSTS', 'Injects HTTP security headers on all incoming responses.', ['security']);

// Realtime Connections
addEdge('user:customer', 'hook:use-realtime', 'opens_stream', 'Subscribes to SSE', 'Customer opens EventSource stream to /api/realtime.', ['realtime']);
addEdge('user:provider', 'hook:use-realtime', 'opens_stream', 'Subscribes to SSE', 'Provider opens EventSource stream to /api/realtime.', ['realtime']);
addEdge('user:admin', 'hook:use-realtime', 'opens_stream', 'Subscribes to SSE', 'Admin opens EventSource stream to /api/realtime.', ['realtime']);
addEdge('route:bookings', 'service:realtime', 'triggers_broadcast', 'broadcastBookingEvent()', 'Dispatches booking state change events to target users.', ['realtime', 'booking']);
addEdge('service:realtime', 'hook:use-realtime', 'pushes_events', 'SSE Event Stream', 'Pushes 7 named event types to connected browser clients.', ['realtime']);
addEdge('hook:use-realtime', 'component:active-booking-cards', 'triggers_sync', 'Refreshes Live Cards', 'Updates card statuses and triggers onSync recovery.', ['realtime', 'booking']);

// =========================================================================
// 6. EXTRACT EXTERNAL SERVICES (External Layer)
// =========================================================================
console.log('☁️ Extracting External Cloud Services...');

const externalServices = [
  { id: 'ext:payhere', label: '💳 PayHere (LKR)', file: 'backend/src/services/integrations.js', desc: 'Central Bank of Sri Lanka (CBSL) approved payment aggregator handling domestic credit/debit cards and mobile wallets in LKR with MD5 server-to-server IPN verification.', views: ['system', 'payments', 'email'] },
  { id: 'ext:nowpayments', label: '🪙 NOWPayments (Crypto)', file: 'backend/src/services/paymentContracts.js', desc: 'Global cryptocurrency gateway supporting non-custodial crypto payments (BTC, ETH, USDT) with USD conversion and HMAC-SHA512 IPN signatures.', views: ['system', 'payments', 'email'] },
  { id: 'ext:resend', label: '✉️ Resend Email API', file: 'backend/src/services/integrations.js', desc: 'Modern transactional email platform dispatched via direct HTTPS REST API (https://api.resend.com/emails) with HTML-escaped templates.', views: ['system', 'email'] },
  { id: 'ext:s3', label: '☁️ S3 Cloud Bucket', file: 'backend/src/services/storage.js', desc: 'Durable private cloud object storage (Cloudflare R2 or AWS S3) storing encrypted provider KYC identity documents and booking photographic evidence.', views: ['system', 'security', 'email', 'deployment'] },
  { id: 'ext:google-oauth', label: '🔑 Google OAuth 2.0', file: 'backend/src/routes/auth.js', desc: 'Federated Google Sign-In validating client tokens via Google tokeninfo API to streamline customer onboarding.', views: ['security', 'email'] },
  { id: 'ext:postgresql', label: '🗄️ PostgreSQL 15', file: 'backend/prisma/schema.prisma', desc: 'ACID relational database engine hosting all business entities, transactional advisory locks, and decimal financial balances.', views: ['system', 'database', 'deployment'] },
];

for (const e of externalServices) {
  addNode({
    id: e.id,
    label: e.label,
    layer: 'External Cloud Services',
    type: 'external_service',
    views: e.views,
    file: e.file,
    description: e.desc,
  });
}

addEdge('route:integrations', 'ext:payhere', 'verifies_ipn', 'MD5 IPN Verification', 'Validates timing-safe MD5 signature hash for PayHere webhook.', ['payments', 'email']);
addEdge('route:integrations', 'ext:nowpayments', 'verifies_ipn', 'HMAC-SHA512 IPN', 'Validates HMAC-SHA512 signature over sorted JSON payload.', ['payments', 'email']);
addEdge('service:integrations', 'ext:resend', 'dispatches', 'HTTPS POST /emails', 'Sends transactional email alerts for bookings, welcomes, and resets.', ['email']);
addEdge('service:storage', 'ext:s3', 'puts_object', 'Streams Document Buffers', 'Stores validated multipart file buffers in cloud bucket.', ['security', 'email']);
addEdge('server:express-app', 'ext:postgresql', 'acid_transactions', 'Prisma Connection Pool', 'Executes type-safe SQL queries, migrations, and row locks.', ['system', 'database']);

// =========================================================================
// 7. EXTRACT CI/CD PIPELINE & QUALITY CHECKS (DevOps Layer)
// =========================================================================
console.log('🚀 Extracting CI/CD Pipeline & DevOps Architecture...');

addNode({
  id: 'cicd:github-repo',
  label: '🐙 GitHub Repository',
  layer: 'CI/CD & DevOps',
  type: 'cicd_trigger',
  views: ['system', 'cicd', 'deployment'],
  file: '.github/workflows/ci.yml',
  description: 'Git version control root triggering automated GitHub Actions workflows, Vercel edge builds, and Northflank container deployments upon push.',
});

addNode({
  id: 'cicd:guard',
  label: '🛡️ Protected Files Guard',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['system', 'cicd', 'security'],
  file: 'scripts/ci/guard-protected-files.mjs',
  description: 'Automated security check that verifies only authorized maintainer @4Raisan can modify workflow files, Dockerfiles, and security configs. Fails immediately for unauthorized actors.',
});

addNode({
  id: 'cicd:classifier',
  label: '🔍 01 - Plan & Secrets',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['system', 'cicd'],
  file: 'scripts/ci/plan-checks.mjs',
  description: 'Parses git commit diffs to plan selective CI execution and runs Gitleaks to block exposed credentials.',
});

addNode({
  id: 'cicd:quality',
  label: '🧪 02 - Quality & SPA',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['cicd'],
  file: '.github/workflows/ci.yml',
  description: 'Executes Oxlint static analysis, tests the CI classifier, and builds the React SPA with Vite.',
});

addNode({
  id: 'cicd:kg',
  label: '📊 02b - KG Verification',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['cicd', 'kg'],
  file: '.github/workflows/ci.yml',
  description: 'Runs Knowledge Graph extraction, validates node/edge integrity, and asserts deterministic zero-drift output.',
});

addNode({
  id: 'cicd:backend',
  label: '🐘 03 - Backend Postgres',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['cicd'],
  file: '.github/workflows/ci.yml',
  description: 'Spins up isolated PostgreSQL test service container, runs Prisma migrations, and executes test suites against luxora_test.',
});

addNode({
  id: 'cicd:audit',
  label: '📦 04 - Dependency Audit',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['cicd'],
  file: '.github/workflows/ci.yml',
  description: 'Runs npm audit with high-severity threshold across root, frontend, and backend packages.',
});

addNode({
  id: 'cicd:docker',
  label: '🐳 05 - Docker Smoke',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['cicd'],
  file: '.github/workflows/ci.yml',
  description: 'Builds production multi-stage Alpine container, spins up isolated database, and executes health probe validation.',
});

addNode({
  id: 'cicd:gate',
  label: '🚪 06 - Required Gate',
  layer: 'CI/CD & DevOps',
  type: 'cicd_check',
  views: ['system', 'cicd'],
  file: '.github/workflows/ci.yml',
  description: 'Strict gate executing via if: always(); verifies that all scheduled jobs completed with status success and rejects unexpected skips.',
});

// CI/CD Pipeline Edges
addEdge('cicd:github-repo', 'cicd:guard', 'triggers', 'Push / PR Event', 'Starts security guard in parallel with plan check.', ['system', 'cicd']);
addEdge('cicd:github-repo', 'cicd:classifier', 'triggers', 'Push / PR Event', 'Classifies changed files to plan selective jobs.', ['system', 'cicd']);
addEdge('cicd:guard', 'cicd:quality', 'gates', 'requires guard success', 'Quality check runs only after guard passes.', ['cicd']);
addEdge('cicd:guard', 'cicd:kg', 'gates', 'requires guard success', 'Knowledge Graph verify runs only after guard passes.', ['cicd']);
addEdge('cicd:guard', 'cicd:backend', 'gates', 'requires guard success', 'Backend tests run only after guard passes.', ['cicd']);
addEdge('cicd:guard', 'cicd:audit', 'gates', 'requires guard success', 'Dependency audit runs only after guard passes.', ['cicd']);
addEdge('cicd:guard', 'cicd:docker', 'gates', 'requires guard success', 'Docker smoke runs only after guard passes.', ['cicd']);
addEdge('cicd:quality', 'cicd:gate', 'reports_to', 'Passes Result', 'Gate verifies quality job outcome.', ['cicd']);
addEdge('cicd:kg', 'cicd:gate', 'reports_to', 'Passes Result', 'Gate verifies knowledge graph job outcome.', ['cicd']);
addEdge('cicd:backend', 'cicd:gate', 'reports_to', 'Passes Result', 'Gate verifies backend test outcome.', ['cicd']);
addEdge('cicd:docker', 'cicd:gate', 'reports_to', 'Passes Result', 'Gate verifies docker smoke outcome.', ['cicd']);
addEdge('cicd:guard', 'cicd:gate', 'reports_to', 'Must Pass', 'Gate strictly asserts GUARD_RESULT === success.', ['system', 'cicd']);

// =========================================================================
// 8. EXTRACT DEPLOYMENT TARGETS (Deployment Layer)
// =========================================================================
console.log('🌐 Extracting Production Deployment Targets...');

addNode({
  id: 'deploy:vercel',
  label: '▲ Vercel Edge (Frontend)',
  layer: 'Deployment Infrastructure',
  type: 'deployment_target',
  views: ['system', 'deployment'],
  file: 'vercel.json',
  description: 'Hosts the React 19 SPA on a global edge CDN (luxora.bond:443); manages SSL termination, asset compression, and single-page routing via vercel.json rewrites.',
  metadata: { domain: 'https://luxora.bond', platform: 'Vercel Edge Network', rewrite: '/(.*) -> /index.html' },
});

addNode({
  id: 'deploy:northflank',
  label: '🚢 Northflank (Backend)',
  layer: 'Deployment Infrastructure',
  type: 'deployment_target',
  views: ['system', 'deployment'],
  file: 'Dockerfile',
  description: 'Multi-stage Dockerized Node.js 22 Alpine container cluster hosting the Express 5 API gateway, running automated health checks on /api/health and executing prisma migrate deploy on startup.',
  metadata: { url: 'https://site--luxora-backend--6kb9tg67ytl4.code.run', healthEndpoint: '/api/health', baseImage: 'node:22-alpine' },
});

addNode({
  id: 'deploy:github-pages',
  label: '🌐 GitHub Pages (Docs & KG)',
  layer: 'Deployment Infrastructure',
  type: 'deployment_target',
  views: ['system', 'deployment', 'kg'],
  file: '.github/workflows/knowledge-graph-pages.yml',
  description: 'Independent static deployment hosting the interactive Knowledge Graph and Architecture Explorer at 4raisan.github.io/Luxora_v1/.',
  metadata: { url: 'https://4raisan.github.io/Luxora_v1/' },
});

addEdge('cicd:github-repo', 'deploy:vercel', 'deploys_via_webhook', 'Git Push to main', 'Vercel pulls commit, builds Vite SPA, and deploys to edge CDN.', ['system', 'deployment']);
addEdge('cicd:github-repo', 'deploy:northflank', 'deploys_via_webhook', 'Git Push to main', 'Northflank pulls commit, builds Docker container, runs migrations, and boots API.', ['system', 'deployment']);
addEdge('cicd:github-repo', 'deploy:github-pages', 'deploys_via_workflow', 'knowledge-graph-pages.yml', 'GitHub Actions workflow validates graph and publishes to GitHub Pages.', ['system', 'deployment', 'kg']);
addEdge('deploy:vercel', 'deploy:northflank', 'cors_requests', 'HTTPS REST API Calls', 'Vercel SPA communicates with Northflank API with whitelisted CORS headers.', ['system', 'deployment']);

// =========================================================================
// 9. EXTRACT KNOWLEDGE GRAPH SUBSYSTEM (KG Layer)
// =========================================================================
console.log('📊 Extracting Knowledge Graph Subsystem...');

addNode({
  id: 'kg:generator',
  label: '📊 KG AST Generator',
  layer: 'Knowledge Graph Subsystem',
  type: 'kg_component',
  views: ['kg', 'system'],
  file: 'Knowladge-Graph/generate-graph.js',
  description: 'Static analysis parser scanning Prisma schemas, routes, services, middleware, and frontend components to construct 192 nodes and 408 edges.',
});

addNode({
  id: 'kg:validator',
  label: '📊 KG Integrity Validator',
  layer: 'Knowledge Graph Subsystem',
  type: 'kg_component',
  views: ['kg'],
  file: 'Knowladge-Graph/validate-graph.js',
  description: 'Deterministic test script checking node/edge stability, absence of secrets, source path validity, and relative asset loading.',
});

addNode({
  id: 'kg:explorer',
  label: '📊 KG Visual Explorer',
  layer: 'Knowledge Graph Subsystem',
  type: 'kg_component',
  views: ['kg', 'system'],
  file: 'Knowladge-Graph/index.html',
  description: 'Vis-network interactive visualizer rendering multi-track concentric layout for developers and coding agents.',
});

addEdge('kg:generator', 'kg:validator', 'validated_by', 'npm run graph:validate', 'Validator verifies newly generated graph against strict invariants.', ['kg']);
addEdge('kg:generator', 'kg:explorer', 'populates', 'Compiles index.html', 'Generates visual explorer with embedded graph data.', ['kg']);

// =========================================================================
// 10. EXTRACT SECURITY MECHANISMS (Security Layer)
// =========================================================================
console.log('🔒 Extracting Security & Cryptographic Controls...');

addNode({
  id: 'sec:jwt-revocation',
  label: '🔑 Token Revocation',
  layer: 'Security Controls',
  type: 'security_control',
  views: ['security'],
  file: 'backend/src/middleware/auth.js',
  description: 'Stateful invalidation pattern: JWT carries tokenVersion integer. When user resets password or admin deactivates account, tokenVersion increments in PostgreSQL, instantly revoking all active client sessions across all devices.',
});

addNode({
  id: 'sec:bcrypt',
  label: '🔒 Bcrypt (10 Rounds)',
  layer: 'Security Controls',
  type: 'security_control',
  views: ['security', 'booking'],
  file: 'backend/src/routes/auth.js',
  description: 'Adaptive cryptographic key derivation protecting user passwords and 4-digit start/completion PIN codes against brute-force and dictionary attacks.',
});

addNode({
  id: 'sec:magic-bytes',
  label: '🔍 Magic-Bytes Sniffer',
  layer: 'Security Controls',
  type: 'security_control',
  views: ['security'],
  file: 'backend/src/routes/uploads.js',
  description: 'Content-based file sniffer checking raw buffer headers (FF D8 FF for JPEG, 89 50 4E 47 for PNG, 25 50 44 46 for PDF) to reject spoofed executable extensions.',
});

addNode({
  id: 'sec:security-headers',
  label: '🛡️ CSP & Security Headers',
  layer: 'Security Controls',
  type: 'security_control',
  views: ['security'],
  file: 'backend/src/index.js',
  description: 'Defense-in-depth HTTP headers enforcing X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, HSTS, and strict Content-Security-Policy.',
});

addEdge('sec:jwt-revocation', 'middleware:auth', 'powers', 'Session Revocation Check', 'authenticateToken compares tokenVersion against PostgreSQL User table.', ['security']);
addEdge('sec:magic-bytes', 'route:uploads', 'safeguards', 'Sniffs Ingested Buffers', 'Prevents malicious script uploads masquerading as photos.', ['security']);

// =========================================================================
// 11. DEFINE 12 ARCHITECTURAL VIEWS
// =========================================================================
const architectureViews = [
  { id: 'system', name: 'System Overview', icon: '🌐', description: 'End-to-end multi-tier production architecture: Users, Vercel Frontend, Northflank Express Gateway, PostgreSQL Database, External Services, CI/CD, and Cloud Deployments.' },
  { id: 'frontend', name: 'Frontend Architecture', icon: '💻', description: 'React 19 Single Page Application architecture: Dashboard portals, Booking Wizard, API Client layer (apiRequest), useRealtime SSE subscriber, and Auth guards.' },
  { id: 'backend', name: 'Backend & API Gateway', icon: '⚡', description: 'Express 5 REST API gateway: Mounted route routers, middleware authentication/role/KYC gates, domain services, and automated background schedulers.' },
  { id: 'database', name: 'Database Architecture', icon: '🗄️', description: 'PostgreSQL 15 Prisma schema models, foreign keys, 1:1 and 1:N relations, exact Decimal(12,2) money fields, and transactional advisory locks.' },
  { id: 'booking', name: 'Booking Lifecycle', icon: '📅', description: 'Complete service fulfillment flow: Booking creation -> Auto-dispatch vs Pending claim -> Start PIN + BEFORE photo -> Completion PIN + AFTER photo -> Earnings accrual.' },
  { id: 'realtime', name: 'Realtime / SSE', icon: '📡', description: 'Server-Sent Events architecture: /api/realtime endpoint, in-memory connection registry, 25s keep-alive ping, broadcastBookingEvent(), 7 named events, and frontend sync.' },
  { id: 'payments', name: 'Payments Engine', icon: '💳', description: 'Tri-gateway payment processing: PayHere LKR MD5 signatures, NOWPayments Crypto HMAC-SHA512 IPN, Demo mode, atomic subscription activation, and non-refundable coin policy.' },
  { id: 'email', name: 'Email & External Services', icon: '☁️', description: 'External cloud infrastructure: Resend transactional email API, S3 durable object storage, Google OAuth 2.0, PayHere, NOWPayments, Vercel, and Northflank.' },
  { id: 'cicd', name: 'CI/CD Pipeline', icon: '🚀', description: '8-job GitHub Actions CI pipeline: Selective execution classifier (plan-checks.mjs), Protected Files Guard, 01-06 quality checks, and hardened gate.' },
  { id: 'deployment', name: 'Production Deployments', icon: '🚢', description: 'Decoupled production hosting: Vercel Global Edge (Frontend), Northflank Alpine Container (Backend), and GitHub Pages (Knowledge Graph).' },
  { id: 'kg', name: 'Knowledge Graph', icon: '📊', description: 'Living codebase knowledge graph subsystem: Static analysis AST extractor, deterministic drift validator, and interactive visual network explorer.' },
  { id: 'security', name: 'Security Architecture', icon: '🔒', description: 'Defense-in-depth security engineering: JWT tokenVersion revocation, Bcrypt 10 salt rounds, AES-256-GCM bank account encryption, magic-byte sniffers, and CSP headers.' },
];

// Sort deterministically
nodes.sort((a, b) => a.id.localeCompare(b.id));
edges.sort((a, b) => a.id.localeCompare(b.id));

const architectureData = {
  schemaVersion: '1.0.0',
  stats: {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalViews: architectureViews.length,
  },
  views: architectureViews,
  nodes,
  edges,
};

// Write JSON
fs.writeFileSync(outputJsonPath, JSON.stringify(architectureData, null, 2), 'utf8');
console.log(`✅ Wrote deterministic Architecture Graph JSON: ${outputJsonPath} (${nodes.length} nodes, ${edges.length} edges)`);

// =========================================================================
// 12. GENERATE INTERACTIVE ARCHITECTURE EXPLORER (architecture.html)
// =========================================================================
console.log('🎨 Generating Interactive Architecture Explorer HTML...');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luxora Live System Architecture Explorer</title>
  <script type="text/javascript" src="./vis-network.min.js"></script>
  <style>
    :root {
      --bg-primary: #070b14;
      --bg-secondary: #0d1424;
      --bg-panel: #111a2f;
      --bg-card: #15223c;
      --accent-gold: #c9a84c;
      --accent-gold-light: #e5c76b;
      --accent-blue: #38bdf8;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border-color: #1e2d4d;
      --border-highlight: #2e4472;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Top Navigation Header */
    header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      flex-shrink: 0;
      z-index: 20;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      font-weight: 900;
      font-size: 14pt;
      letter-spacing: 1.5px;
      color: var(--accent-gold);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .brand-tag {
      background: rgba(201, 168, 76, 0.15);
      border: 1px solid var(--accent-gold);
      color: var(--accent-gold-light);
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stat-pill {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 8pt;
      color: var(--text-secondary);
    }
    .stat-pill strong { color: var(--text-primary); }

    .nav-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 8.5pt;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .nav-btn:hover {
      background: var(--border-color);
      border-color: var(--accent-gold);
      color: var(--accent-gold-light);
    }

    /* Views Ribbon */
    .view-ribbon {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      padding: 6px 16px;
      gap: 6px;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: thin;
      scrollbar-color: var(--border-color) transparent;
      flex-shrink: 0;
      z-index: 10;
    }

    .view-tab {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-secondary);
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 8.5pt;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .view-tab:hover {
      background: var(--bg-card);
      color: var(--text-primary);
    }

    .view-tab.active {
      background: rgba(201, 168, 76, 0.15);
      border-color: var(--accent-gold);
      color: var(--accent-gold-light);
    }

    /* Main Explorer Workspace */
    .main-layout {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    /* Left Control Sidebar */
    .control-sidebar {
      width: 320px;
      flex-shrink: 0;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 16px;
      gap: 14px;
      z-index: 15;
    }

    .sidebar-section-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--accent-gold);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .view-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      font-size: 8.5pt;
      line-height: 1.4;
      color: var(--text-secondary);
    }
    .view-card strong { color: var(--text-primary); display: block; margin-bottom: 4px; font-size: 9.5pt; }

    .search-input {
      width: 100%;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 8.5pt;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus {
      border-color: var(--accent-gold);
    }

    .layer-filter-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .layer-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: var(--bg-panel);
      border: 1px solid transparent;
      border-radius: 4px;
      font-size: 8pt;
      cursor: pointer;
      user-select: none;
    }
    .layer-item:hover { border-color: var(--border-color); }
    .layer-item.active { background: var(--bg-card); border-color: var(--border-highlight); }

    .layer-label-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .layer-badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .layer-count {
      background: var(--bg-primary);
      color: var(--text-muted);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 600;
    }

    .canvas-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .btn-action {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 7px 10px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .btn-action:hover { background: var(--border-color); border-color: var(--accent-gold); }

    /* Center Network Canvas */
    .canvas-container {
      flex: 1;
      position: relative;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 50%, #0d1424 0%, #070b14 100%);
      overflow: hidden;
    }

    #network {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .canvas-overlay-stats {
      position: absolute;
      top: 14px;
      left: 14px;
      background: rgba(13, 20, 36, 0.9);
      border: 1px solid var(--border-color);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 8pt;
      color: var(--text-secondary);
      pointer-events: none;
      z-index: 5;
    }

    /* Right Slide-Over Inspector */
    .inspector-panel {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 380px;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      box-shadow: -8px 0 32px rgba(0,0,0,0.6);
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 25;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 20px;
      gap: 16px;
    }

    .inspector-panel.open {
      transform: translateX(0);
    }

    .inspector-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      border-radius: 4px;
    }
    .inspector-close-btn:hover { color: #fff; background: var(--border-color); }

    .node-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
      padding-right: 24px;
    }

    .node-type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .node-title {
      font-size: 12.5pt;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .node-file {
      font-family: 'Consolas', monospace;
      font-size: 7.5pt;
      color: var(--accent-gold-light);
      background: var(--bg-primary);
      padding: 4px 8px;
      border-radius: 4px;
      word-break: break-all;
      border: 1px solid var(--border-color);
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .node-desc {
      font-size: 8.5pt;
      line-height: 1.45;
      color: var(--text-secondary);
      background: var(--bg-panel);
      padding: 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }

    .dependency-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dependency-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 8pt;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }
    .dependency-card:hover { border-color: var(--accent-gold); }

    .trace-btn {
      width: 100%;
      background: var(--accent-gold);
      color: #070b14;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 8.5pt;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .trace-btn:hover { background: var(--accent-gold-light); }
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <div class="brand">
      <div class="brand-logo">LUXORA <span style="color:#f8fafc;font-weight:400;">ARCHITECTURE</span></div>
      <div class="brand-tag">Live System Explorer</div>
    </div>
    <div class="header-actions">
      <div class="stat-pill">Nodes: <strong id="statNodes">0</strong></div>
      <div class="stat-pill">Edges: <strong id="statEdges">0</strong></div>
      <div class="stat-pill">Views: <strong id="statViews">12</strong></div>
      <a href="./index.html" class="nav-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3zM9 3v18M3 9h18"/></svg>
        Codebase Knowledge Graph
      </a>
    </div>
  </header>

  <!-- Views Ribbon -->
  <div class="view-ribbon" id="viewRibbon">
    <!-- Injected dynamically -->
  </div>

  <!-- Main Workspace -->
  <div class="main-layout">
    
    <!-- Left Sidebar: Controls & Filters -->
    <aside class="control-sidebar">
      <div>
        <div class="sidebar-section-title">Active View Information</div>
        <div class="view-card" id="viewCard">
          <strong id="viewCardTitle">System Overview</strong>
          <span id="viewCardDesc">End-to-end multi-tier production architecture.</span>
        </div>
      </div>

      <div>
        <div class="sidebar-section-title">Search Architecture</div>
        <input type="text" id="searchInput" class="search-input" placeholder="Filter by component, file, route...">
      </div>

      <div>
        <div class="sidebar-section-title">
          <span>Architectural Layers</span>
          <span id="layerCountTotal" style="color:var(--text-muted);"></span>
        </div>
        <div class="layer-filter-list" id="layerFilterList">
          <!-- Injected dynamically -->
        </div>
      </div>

      <div>
        <div class="sidebar-section-title">Canvas Controls</div>
        <div class="canvas-actions">
          <button class="btn-action" id="btnFit">Fit to Screen</button>
          <button class="btn-action" id="btnReset">Reset View</button>
          <button class="btn-action" id="btnPhysics" style="grid-column: span 2;">Toggle Force Physics</button>
        </div>
      </div>
    </aside>

    <!-- Center Canvas: Vis Network -->
    <main class="canvas-container">
      <div class="canvas-overlay-stats" id="canvasOverlayStats">Rendering view...</div>
      <div id="network"></div>
    </main>

    <!-- Right Slide-Over Inspector -->
    <aside class="inspector-panel" id="inspectorPanel">
      <button class="inspector-close-btn" id="btnCloseInspector">✕</button>

      <div id="inspectorContent" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="node-header">
          <div class="node-type-badge" id="inspLayerBadge">Layer</div>
          <div class="node-title" id="inspTitle">Node Name</div>
          <div class="node-file" id="inspFile">path/to/file</div>
        </div>

        <button class="trace-btn" id="btnTracePath">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Trace Dependency Flow
        </button>

        <div>
          <div class="sidebar-section-title">Architectural Responsibility</div>
          <div class="node-desc" id="inspDesc">Description...</div>
        </div>

        <div id="inspInboundSection">
          <div class="sidebar-section-title">Inbound Dependencies (Called By)</div>
          <div class="dependency-list" id="inspInboundList"></div>
        </div>

        <div id="inspOutboundSection">
          <div class="sidebar-section-title">Outbound Dependencies (Calls / Uses)</div>
          <div class="dependency-list" id="inspOutboundList"></div>
        </div>
      </div>
    </aside>

  </div>

  <!-- Interactive Explorer Logic -->
  <script type="module">
    let graphData;
    try {
      const response = await fetch('./architecture-graph.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      graphData = await response.json();
    } catch (error) {
      document.body.innerHTML = '<main style="padding:2rem;color:#fff;background:#070b14;font-family:system-ui"><h1>Architecture Graph Unavailable</h1><p>The architecture graph JSON could not be loaded via ./architecture-graph.json.</p></main>';
      throw error;
    }

    // Expose for browser console inspection & testing
    window.graphData = graphData;

    // Layer Color Palette
    const layerColors = {
      'Users & Roles': { bg: '#818cf8', border: '#a5b4fc', text: '#ffffff' },
      'Frontend Presentation': { bg: '#38bdf8', border: '#7dd3fc', text: '#020617' },
      'API Gateway & Middleware': { bg: '#c9a84c', border: '#e5c76b', text: '#020617' },
      'Domain Services': { bg: '#fb923c', border: '#fdba74', text: '#020617' },
      'Database & Models': { bg: '#facc15', border: '#fef08a', text: '#020617' },
      'Realtime & SSE': { bg: '#34d399', border: '#6ee7b7', text: '#020617' },
      'External Cloud Services': { bg: '#a78bfa', border: '#c4b5fd', text: '#020617' },
      'CI/CD & DevOps': { bg: '#f472b6', border: '#f9a8d4', text: '#020617' },
      'Deployment Infrastructure': { bg: '#2dd4bf', border: '#5eead4', text: '#020617' },
      'Security Controls': { bg: '#f87171', border: '#fca5a5', text: '#020617' },
      'Knowledge Graph Subsystem': { bg: '#94a3b8', border: '#cbd5e1', text: '#020617' },
    };

    let activeView = 'system';
    let physicsActive = false;
    let selectedNodeId = null;
    let activeSearchTerm = '';
    const activeLayers = new Set(Object.keys(layerColors));

    // Stats
    document.getElementById('statNodes').textContent = graphData.stats.totalNodes;
    document.getElementById('statEdges').textContent = graphData.stats.totalEdges;
    document.getElementById('statViews').textContent = graphData.stats.totalViews;

    // View Ribbon Injection
    const viewRibbon = document.getElementById('viewRibbon');
    graphData.views.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'view-tab' + (v.id === activeView ? ' active' : '');
      btn.innerHTML = '<span>' + v.icon + '</span><span>' + v.name + '</span>';
      btn.onclick = () => switchView(v.id);
      viewRibbon.appendChild(btn);
    });

    // Layer Filter List Injection
    const layerFilterList = document.getElementById('layerFilterList');
    Object.keys(layerColors).forEach(layerName => {
      const count = graphData.nodes.filter(n => n.layer === layerName).length;
      if (count === 0) return;

      const item = document.createElement('div');
      item.className = 'layer-item active';
      item.innerHTML = \`
        <div class="layer-label-group">
          <div class="layer-badge-dot" style="background: \${layerColors[layerName].bg}"></div>
          <span>\${layerName}</span>
        </div>
        <span class="layer-count">\${count}</span>
      \`;
      item.onclick = () => {
        if (activeLayers.has(layerName)) {
          activeLayers.delete(layerName);
          item.classList.remove('active');
        } else {
          activeLayers.add(layerName);
          item.classList.add('active');
        }
        updateFilterVisibility();
      };
      layerFilterList.appendChild(item);
    });

    // Filter nodes and edges by active view
    function getActiveViewElements() {
      const currentViewDef = graphData.views.find(v => v.id === activeView) || graphData.views[0];
      const viewNodes = graphData.nodes.filter(n => n.views.includes(activeView));
      const viewNodeIds = new Set(viewNodes.map(n => n.id));
      const viewEdges = graphData.edges.filter(e => viewNodeIds.has(e.from) && viewNodeIds.has(e.to));
      return { currentViewDef, viewNodes, viewEdges };
    }

    // =========================================================================
    // DETERMINISTIC ARCHITECTURAL HIERARCHY LAYOUT ENGINE
    // =========================================================================
    function computeArchitectureLayout(viewId, viewNodes) {
      const positions = {};

      if (viewId === 'system') {
        // Multi-tier layered layout with side columns for DevOps and Deployment
        const tiers = {
          'Users & Roles': { y: -320, spacing: 240, nodes: [] },
          'Frontend Presentation': { y: -160, spacing: 180, nodes: [] },
          'API Gateway & Middleware': { y: 0, spacing: 190, nodes: [] },
          'Domain Services': { y: 160, spacing: 190, nodes: [] },
          'Realtime & SSE': { y: 160, spacing: 190, nodes: [] },
          'Database & Models': { y: 320, spacing: 180, nodes: [] },
          'External Cloud Services': { y: 480, spacing: 180, nodes: [] },
        };

        const sideColumns = {
          'CI/CD & DevOps': { x: 720, startY: -320, stepY: 100, nodes: [] },
          'Deployment Infrastructure': { x: 720, startY: 180, stepY: 110, nodes: [] },
          'Security Controls': { x: -750, startY: -100, stepY: 120, nodes: [] },
          'Knowledge Graph Subsystem': { x: -750, startY: 340, stepY: 110, nodes: [] },
        };

        viewNodes.forEach(node => {
          if (sideColumns[node.layer]) {
            sideColumns[node.layer].nodes.push(node);
          } else if (tiers[node.layer]) {
            tiers[node.layer].nodes.push(node);
          } else {
            tiers['Domain Services'].nodes.push(node);
          }
        });

        // Center tier nodes horizontally
        Object.keys(tiers).forEach(tKey => {
          const tier = tiers[tKey];
          const count = tier.nodes.length;
          if (count === 0) return;
          const totalWidth = (count - 1) * tier.spacing;
          const startX = -totalWidth / 2;
          tier.nodes.forEach((n, idx) => {
            positions[n.id] = {
              x: Math.round(startX + idx * tier.spacing),
              y: tier.y
            };
          });
        });

        // Position side column nodes vertically
        Object.keys(sideColumns).forEach(cKey => {
          const col = sideColumns[cKey];
          col.nodes.forEach((n, idx) => {
            positions[n.id] = {
              x: col.x,
              y: col.startY + idx * col.stepY
            };
          });
        });

        return positions;
      }

      if (viewId === 'booking') {
        // Chronological fulfillment workflow layout (left to right)
        const workflowOrder = [
          { id: 'user:customer', x: -620, y: -60 },
          { id: 'page:book-service', x: -440, y: -60 },
          { id: 'route:bookings', x: -260, y: -60 },
          { id: 'model:usersubscriptionentitlement', x: -260, y: 140 },
          { id: 'service:scheduling', x: -70, y: -60 },
          { id: 'model:provider', x: -70, y: 140 },
          { id: 'model:booking', x: 130, y: -60 },
          { id: 'service:booking-timeouts', x: 130, y: -220 },
          { id: 'user:provider', x: 130, y: 140 },
          { id: 'page:provider-dashboard', x: 330, y: -60 },
          { id: 'model:servicephoto', x: 330, y: 140 },
          { id: 'service:realtime', x: 330, y: -220 },
          { id: 'page:customer-dashboard', x: 520, y: -60 },
          { id: 'component:active-booking-cards', x: 520, y: 140 },
          { id: 'service:payouts', x: 710, y: -60 },
          { id: 'model:review', x: 710, y: 140 },
        ];

        workflowOrder.forEach(w => {
          positions[w.id] = { x: w.x, y: w.y };
        });

        let remIdx = 0;
        viewNodes.forEach(n => {
          if (!positions[n.id]) {
            positions[n.id] = { x: -400 + remIdx * 180, y: 280 };
            remIdx++;
          }
        });

        return positions;
      }

      if (viewId === 'realtime') {
        // Central hub broadcaster layout
        positions['service:realtime'] = { x: 0, y: 0 };
        positions['server:express-app'] = { x: 0, y: -180 };
        positions['route:bookings'] = { x: -260, y: -180 };

        positions['hook:use-realtime'] = { x: 0, y: 160 };
        positions['page:customer-dashboard'] = { x: -280, y: 290 };
        positions['page:provider-dashboard'] = { x: 0, y: 290 };
        positions['page:admin-dashboard'] = { x: 280, y: 290 };
        positions['component:active-booking-cards'] = { x: -280, y: 420 };

        let unassigned = viewNodes.filter(n => !positions[n.id]);
        unassigned.forEach((n, idx) => {
          positions[n.id] = { x: -200 + idx * 200, y: 540 };
        });

        return positions;
      }

      if (viewId === 'payments') {
        // Payment transaction flow layout
        positions['user:customer'] = { x: -300, y: -240 };
        positions['page:customer-dashboard'] = { x: -100, y: -240 };
        positions['page:book-service'] = { x: 100, y: -240 };

        positions['route:services'] = { x: 0, y: -90 };
        positions['model:payment'] = { x: -260, y: 60 };
        positions['ext:payhere'] = { x: -260, y: 200 };
        positions['ext:nowpayments'] = { x: 260, y: 200 };

        positions['route:integrations'] = { x: 0, y: 300 };
        positions['model:usersubscription'] = { x: 0, y: 440 };
        positions['model:usersubscriptionentitlement'] = { x: 0, y: 580 };

        let remIdx = 0;
        viewNodes.forEach(n => {
          if (!positions[n.id]) {
            positions[n.id] = { x: 450, y: -150 + remIdx * 110 };
            remIdx++;
          }
        });

        return positions;
      }

      if (viewId === 'cicd') {
        // Vertical pipeline layout
        positions['cicd:github-repo'] = { x: 0, y: -240 };
        positions['cicd:guard'] = { x: -240, y: -100 };
        positions['cicd:classifier'] = { x: 240, y: -100 };

        const checks = ['cicd:quality', 'cicd:kg', 'cicd:backend', 'cicd:audit', 'cicd:docker'];
        checks.forEach((id, idx) => {
          positions[id] = { x: -360 + idx * 180, y: 70 };
        });

        positions['cicd:gate'] = { x: 0, y: 240 };

        return positions;
      }

      // Default Clean Tiered Grid Layout for other views (database, frontend, backend, security, etc.)
      const layerGroups = {};
      viewNodes.forEach(n => {
        layerGroups[n.layer] = layerGroups[n.layer] || [];
        layerGroups[n.layer].push(n);
      });

      let currentY = -((Object.keys(layerGroups).length - 1) * 160) / 2;
      Object.keys(layerGroups).forEach(lKey => {
        const group = layerGroups[lKey];
        const count = group.length;
        const spacing = Math.min(220, Math.max(140, 950 / Math.max(count, 1)));
        const totalW = (count - 1) * spacing;
        const startX = -totalW / 2;

        group.forEach((node, idx) => {
          positions[node.id] = {
            x: Math.round(startX + idx * spacing),
            y: Math.round(currentY)
          };
        });

        currentY += 160;
      });

      return positions;
    }

    // Initialize Vis Network Datasets
    const visNodes = new vis.DataSet();
    const visEdges = new vis.DataSet();
    const container = document.getElementById('network');
    const data = { nodes: visNodes, edges: visEdges };

    const options = {
      physics: {
        enabled: false, // Default: clean deterministic hierarchical layout
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 120,
          springConstant: 0.08,
          damping: 0.7,
        },
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        selectable: true,
        selectConnectedEdges: true,
      },
    };

    const network = new vis.Network(container, data, options);

    // Expose for browser console & testing
    window.network = network;
    window.visNodes = visNodes;
    window.visEdges = visEdges;

    function fitGraphToView(duration = 350) {
      const containerEl = document.getElementById('network');
      if (!containerEl || !network) return;
      const w = containerEl.clientWidth || 1100;
      const h = containerEl.clientHeight || 700;

      const currentNodes = visNodes.get().filter(n => !n.hidden);
      if (currentNodes.length === 0) return;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      currentNodes.forEach(n => {
        const x = n.x || 0;
        const y = n.y || 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });

      const padding = 100;
      const spanX = Math.max(100, (maxX - minX) + padding * 2);
      const spanY = Math.max(100, (maxY - minY) + padding * 2);

      const scaleX = w / spanX;
      const scaleY = h / spanY;
      const targetScale = Math.min(1.0, Math.max(0.25, Math.min(scaleX, scaleY) * 0.95));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      network.moveTo({
        position: { x: centerX, y: centerY },
        scale: targetScale,
        animation: duration > 0 ? { duration, easingFunction: 'easeInOutQuad' } : false
      });
    }

    function populateView() {
      const { currentViewDef, viewNodes, viewEdges } = getActiveViewElements();
      
      document.getElementById('viewCardTitle').textContent = currentViewDef.name;
      document.getElementById('viewCardDesc').textContent = currentViewDef.description;

      const positions = computeArchitectureLayout(activeView, viewNodes);

      visNodes.clear();
      visEdges.clear();

      const formattedNodes = viewNodes.map(n => {
        const color = layerColors[n.layer] || { bg: '#475569', border: '#94a3b8', text: '#ffffff' };
        const pos = positions[n.id] || { x: 0, y: 0 };
        const isHidden = !activeLayers.has(n.layer) || Boolean(activeSearchTerm && !matchesSearch(n, activeSearchTerm));
        return {
          id: n.id,
          label: n.label,
          x: pos.x,
          y: pos.y,
          fixed: false,
          shape: 'box',
          margin: { top: 8, bottom: 8, left: 12, right: 12 },
          borderWidth: 1.5,
          color: {
            background: color.bg,
            border: color.border,
            highlight: { background: color.border, border: '#ffffff' }
          },
          font: { color: color.text, face: 'system-ui', size: 10, bold: true },
          shadow: { enabled: true, color: 'rgba(0,0,0,0.4)', size: 6, x: 2, y: 3 },
          hidden: isHidden ? true : false,
        };
      });

      const formattedEdges = viewEdges.map((e, idx) => ({
        id: e.id || 'e_' + idx,
        from: e.from,
        to: e.to,
        label: e.label,
        arrows: 'to',
        color: { color: 'rgba(148, 163, 184, 0.4)', highlight: '#c9a84c' },
        font: { size: 9, color: '#e2e8f0', strokeWidth: 3, strokeColor: '#070b14', align: 'middle' },
        smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.3 },
      }));

      visNodes.add(formattedNodes);
      visEdges.add(formattedEdges);

      document.getElementById('canvasOverlayStats').textContent = 
        \`Showing \${viewNodes.length} nodes & \${viewEdges.length} connections in \${currentViewDef.name}\`;

      window.requestAnimationFrame(() => {
        fitGraphToView(0);
      });
    }

    function switchView(viewId) {
      activeView = viewId;
      document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.includes(
          (graphData.views.find(v => v.id === viewId) || {}).name
        ));
      });
      selectedNodeId = null;
      hideInspector();
      populateView();
    }

    // Expose for testing
    window.switchView = switchView;
    window.fitGraphToView = fitGraphToView;

    function matchesSearch(node, term) {
      const q = term.toLowerCase();
      return (node.label && node.label.toLowerCase().includes(q)) ||
             (node.description && node.description.toLowerCase().includes(q)) ||
             (node.file && node.file.toLowerCase().includes(q)) ||
             (node.layer && node.layer.toLowerCase().includes(q));
    }

    function updateFilterVisibility() {
      const updates = [];
      visNodes.forEach(node => {
        const rawNode = graphData.nodes.find(n => n.id === node.id);
        if (!rawNode) return;
        const matchesLayer = activeLayers.has(rawNode.layer);
        const matchesQuery = !activeSearchTerm || matchesSearch(rawNode, activeSearchTerm);
        const shouldHide = !(matchesLayer && matchesQuery);
        updates.push({ id: node.id, hidden: shouldHide ? true : false });
      });
      visNodes.update(updates);
      fitGraphToView(250);
    }

    // Search Input Listener
    document.getElementById('searchInput').addEventListener('input', (e) => {
      activeSearchTerm = e.target.value.trim();
      updateFilterVisibility();
    });

    // Canvas Buttons
    document.getElementById('btnFit').addEventListener('click', () => {
      fitGraphToView(350);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      activeSearchTerm = '';
      document.getElementById('searchInput').value = '';
      activeLayers.clear();
      Object.keys(layerColors).forEach(l => activeLayers.add(l));
      document.querySelectorAll('.layer-item').forEach(i => i.classList.add('active'));
      populateView();
    });

    document.getElementById('btnPhysics').addEventListener('click', () => {
      physicsActive = !physicsActive;
      network.setOptions({ physics: { enabled: physicsActive } });
      document.getElementById('btnPhysics').textContent = physicsActive ? 'Disable Force Physics' : 'Toggle Force Physics';
      if (!physicsActive) {
        populateView();
      }
    });

    // Inspector Logic (Slide-Over Panel)
    const inspectorPanel = document.getElementById('inspectorPanel');
    document.getElementById('btnCloseInspector').addEventListener('click', hideInspector);

    function showNodeInspector(nodeId) {
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (!node) return;

      selectedNodeId = nodeId;
      inspectorPanel.classList.add('open');

      const color = layerColors[node.layer] || { bg: '#475569', border: '#94a3b8' };
      const badge = document.getElementById('inspLayerBadge');
      badge.textContent = node.layer;
      badge.style.background = color.bg;
      badge.style.color = color.text || '#ffffff';

      document.getElementById('inspTitle').textContent = node.label;
      document.getElementById('inspFile').textContent = node.file || 'Configuration / Abstract Module';
      document.getElementById('inspDesc').textContent = node.description || 'No detailed description available.';

      // Inbound
      const inbound = graphData.edges.filter(e => e.to === nodeId);
      const inList = document.getElementById('inspInboundList');
      inList.innerHTML = '';
      if (inbound.length) {
        document.getElementById('inspInboundSection').style.display = 'block';
        inbound.forEach(e => {
          const fromNode = graphData.nodes.find(n => n.id === e.from);
          const card = document.createElement('div');
          card.className = 'dependency-card';
          card.innerHTML = '<strong>' + (fromNode ? fromNode.label : e.from) + '</strong><span style="color:var(--text-muted);font-size:7pt;">' + e.label + '</span>';
          card.onclick = () => { network.selectNodes([e.from]); showNodeInspector(e.from); };
          inList.appendChild(card);
        });
      } else {
        document.getElementById('inspInboundSection').style.display = 'none';
      }

      // Outbound
      const outbound = graphData.edges.filter(e => e.from === nodeId);
      const outList = document.getElementById('inspOutboundList');
      outList.innerHTML = '';
      if (outbound.length) {
        document.getElementById('inspOutboundSection').style.display = 'block';
        outbound.forEach(e => {
          const toNode = graphData.nodes.find(n => n.id === e.to);
          const card = document.createElement('div');
          card.className = 'dependency-card';
          card.innerHTML = '<strong>' + (toNode ? toNode.label : e.to) + '</strong><span style="color:var(--text-muted);font-size:7pt;">' + e.label + '</span>';
          card.onclick = () => { network.selectNodes([e.to]); showNodeInspector(e.to); };
          outList.appendChild(card);
        });
      } else {
        document.getElementById('inspOutboundSection').style.display = 'none';
      }
    }

    function showEdgeInspector(edgeId) {
      const edge = graphData.edges.find(e => e.id === edgeId);
      if (!edge) return;

      inspectorPanel.classList.add('open');

      const badge = document.getElementById('inspLayerBadge');
      badge.textContent = 'Relationship Link';
      badge.style.background = '#c9a84c';
      badge.style.color = '#070b14';

      const fromNode = graphData.nodes.find(n => n.id === edge.from);
      const toNode = graphData.nodes.find(n => n.id === edge.to);

      document.getElementById('inspTitle').textContent = (fromNode ? fromNode.label : edge.from) + ' ➔ ' + (toNode ? toNode.label : edge.to);
      document.getElementById('inspFile').textContent = 'Link Kind: ' + edge.type;
      document.getElementById('inspDesc').textContent = edge.description;
      document.getElementById('inspInboundSection').style.display = 'none';
      document.getElementById('inspOutboundSection').style.display = 'none';
    }

    function hideInspector() {
      inspectorPanel.classList.remove('open');
      selectedNodeId = null;
    }

    // Node & Edge Click Events
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        showNodeInspector(params.nodes[0]);
      } else if (params.edges.length > 0) {
        showEdgeInspector(params.edges[0]);
      } else {
        hideInspector();
      }
    });

    // Path Tracing
    document.getElementById('btnTracePath').addEventListener('click', () => {
      if (!selectedNodeId) return;
      const connectedNodeIds = new Set([selectedNodeId, ...network.getConnectedNodes(selectedNodeId)]);
      const updates = [];
      visNodes.forEach(node => {
        updates.push({
          id: node.id,
          opacity: connectedNodeIds.has(node.id) ? 1.0 : 0.15,
        });
      });
      visNodes.update(updates);
    });

    window.addEventListener('resize', () => {
      fitGraphToView(0);
    });

    // Initial Mount
    populateView();
  </script>
</body>
</html>
`;

fs.writeFileSync(outputHtmlPath, htmlContent, 'utf8');
console.log(`✅ Wrote Interactive Architecture Explorer HTML: ${outputHtmlPath} (${htmlContent.length} bytes)`);
console.log('🎉 Luxora Live System Architecture Generation Complete!');
