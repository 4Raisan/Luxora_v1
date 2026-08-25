/**
 * Knowledge Graph Generator for Luxora Codebase
 * 
 * Scans Frontend, Backend, Services, Middleware, and Prisma Database Schema
 * to construct a living, queryable Knowledge Graph of files, APIs, models, and dependencies.
 * 
 * Outputs:
 * - Knowladge-Graph/knowledge-graph.json (Machine-readable for Coding Agents)
 * - Knowladge-Graph/index.html (Interactive Visual Explorer for Developers & Agents)
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

console.log('🔍 Starting Luxora Codebase Knowledge Graph Extraction...');

const nodes = [];
const edges = [];
const nodeMap = new Map();

function addNode(node) {
  if (!nodeMap.has(node.id)) {
    nodeMap.set(node.id, node);
    nodes.push(node);
  } else {
    const existing = nodeMap.get(node.id);
    Object.assign(existing, { ...node, metadata: { ...existing.metadata, ...node.metadata } });
  }
}

function addEdge(from, to, type, label = '') {
  if (!from || !to) return;
  const edgeKey = `${from}->${to}:${type}`;
  if (!edges.some(e => `${e.from}->${e.to}:${e.type}` === edgeKey)) {
    edges.push({ from, to, type, label });
  }
}

// ==========================================
// 1. PARSE PRISMA SCHEMA (Database Layer)
// ==========================================
function parsePrismaSchema() {
  if (!fs.existsSync(prismaSchemaPath)) {
    console.warn('⚠️ schema.prisma not found at:', prismaSchemaPath);
    return;
  }

  const schemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');
  const lines = schemaContent.split('\n');

  let currentModel = null;
  let currentEnum = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Detect Models
    const modelMatch = trimmed.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      addNode({
        id: `model:${currentModel}`,
        label: currentModel,
        type: 'DatabaseModel',
        group: 'database',
        file: 'backend/prisma/schema.prisma',
        metadata: {
          fields: [],
          relations: []
        }
      });
      continue;
    }

    // Detect Enums
    const enumMatch = trimmed.match(/^enum\s+([A-Za-z0-9_]+)\s*\{/);
    if (enumMatch) {
      currentEnum = enumMatch[1];
      addNode({
        id: `enum:${currentEnum}`,
        label: currentEnum,
        type: 'Enum',
        group: 'database',
        file: 'backend/prisma/schema.prisma',
        metadata: { values: [] }
      });
      continue;
    }

    if (trimmed === '}') {
      currentModel = null;
      currentEnum = null;
      continue;
    }

    // Model fields & relations
    if (currentModel) {
      const fieldParts = trimmed.split(/\s+/);
      const fieldName = fieldParts[0];
      const fieldType = fieldParts[1]?.replace(/[[\]?]/g, '');

      const modelNode = nodeMap.get(`model:${currentModel}`);
      if (modelNode && fieldName && fieldType) {
        modelNode.metadata.fields.push({ name: fieldName, type: fieldParts[1] });

        // Relation detection
        if (line.includes('@relation') || /^[A-Z]/.test(fieldType)) {
          if (['Int', 'String', 'Boolean', 'DateTime', 'Decimal', 'Float', 'Json'].includes(fieldType)) {
            // Primitive
          } else {
            // References another Model or Enum
            addEdge(`model:${currentModel}`, `model:${fieldType}`, 'DB_RELATION', fieldName);
          }
        }
      }
    }

    // Enum values
    if (currentEnum) {
      const enumVal = trimmed.split(/\s+/)[0];
      if (enumVal && !enumVal.startsWith('@')) {
        const enumNode = nodeMap.get(`enum:${currentEnum}`);
        if (enumNode) enumNode.metadata.values.push(enumVal);
      }
    }
  }
  console.log('✅ Parsed Prisma Database Schema (Models & Enums)');
}

// ==========================================
// 2. PARSE BACKEND SERVICES & MIDDLEWARE
// ==========================================
function parseBackendModules() {
  const middlewareDir = path.join(backendDir, 'src', 'middleware');
  const servicesDir = path.join(backendDir, 'src', 'services');

  // Middleware
  if (fs.existsSync(middlewareDir)) {
    for (const file of fs.readdirSync(middlewareDir)) {
      if (!file.endsWith('.js')) continue;
      const relPath = `backend/src/middleware/${file}`;
      const id = `middleware:${file.replace('.js', '')}`;

      addNode({
        id,
        label: file,
        type: 'Middleware',
        group: 'middleware',
        file: relPath,
        metadata: {
          description: `Backend middleware in ${file}`
        }
      });
    }
  }

  // Services
  if (fs.existsSync(servicesDir)) {
    for (const file of fs.readdirSync(servicesDir)) {
      if (!file.endsWith('.js')) continue;
      const filePath = path.join(servicesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = `backend/src/services/${file}`;
      const id = `service:${file.replace('.js', '')}`;

      // Find prisma models touched
      const prismaMatches = [...content.matchAll(/prisma\.([a-zA-Z0-9_]+)\./g)].map(m => m[1]);
      const uniquePrisma = [...new Set(prismaMatches)];

      addNode({
        id,
        label: file,
        type: 'Service',
        group: 'service',
        file: relPath,
        metadata: {
          modelsAccessed: uniquePrisma
        }
      });

      for (const model of uniquePrisma) {
        const capModel = model.charAt(0).toUpperCase() + model.slice(1);
        addEdge(id, `model:${capModel}`, 'QUERIES_DB', 'prisma.' + model);
      }
    }
  }
  console.log('✅ Parsed Backend Middleware & Services');
}

// ==========================================
// 3. PARSE BACKEND ROUTES & API ENDPOINTS
// ==========================================
function parseBackendRoutes() {
  const routesDir = path.join(backendDir, 'src', 'routes');
  if (!fs.existsSync(routesDir)) return;

  const routeMounts = {
    'auth.js': '/api/auth',
    'services.js': '/api',
    'bookings.js': '/api/bookings',
    'reviews.js': '/api/reviews',
    'complaints.js': '/api/complaints',
    'admin.js': '/api/admin',
    'customer.js': '/api/customer',
    'uploads.js': '/api',
    'provider.js': '/api/provider',
    'promotions.js': '/api/promotions',
    'notifications.js': '/api/notifications',
    'integrations.js': '/api',
    'profile.js': '/api/profile',
    'support.js': '/api/support',
    'refunds.js': '/api',
    'docs.js': '/api'
  };

  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = `backend/src/routes/${file}`;
    const routeFileId = `routefile:${file.replace('.js', '')}`;
    const baseMount = routeMounts[file] || '/api';

    addNode({
      id: routeFileId,
      label: file,
      type: 'RouteModule',
      group: 'routes',
      file: relPath,
      metadata: { baseMount }
    });

    if (content.includes('authenticateToken')) addEdge(routeFileId, 'middleware:auth', 'USES_AUTH', 'authenticateToken');
    if (content.includes('requireRole') || content.includes('authorizeRole')) addEdge(routeFileId, 'middleware:auth', 'USES_RBAC', 'requireRole');
    if (content.includes('rateLimit')) addEdge(routeFileId, 'middleware:rateLimit', 'USES_RATE_LIMIT');
    if (content.includes('validators')) addEdge(routeFileId, 'middleware:validators', 'USES_VALIDATION');

    if (content.includes('entitlements.js')) addEdge(routeFileId, 'service:entitlements', 'CALLS_SERVICE');
    if (content.includes('scheduling.js')) addEdge(routeFileId, 'service:scheduling', 'CALLS_SERVICE');
    if (content.includes('notify.js')) addEdge(routeFileId, 'service:notify', 'CALLS_SERVICE');
    if (content.includes('paymentContracts.js')) addEdge(routeFileId, 'service:paymentContracts', 'CALLS_SERVICE');
    if (content.includes('integrations.js')) addEdge(routeFileId, 'service:integrations', 'CALLS_SERVICE');

    const prismaMatches = [...content.matchAll(/prisma\.([a-zA-Z0-9_]+)\./g)].map(m => m[1]);
    for (const model of new Set(prismaMatches)) {
      const capModel = model.charAt(0).toUpperCase() + model.slice(1);
      addEdge(routeFileId, `model:${capModel}`, 'QUERIES_DB', 'prisma.' + model);
    }

    const routeRegex = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      let subPath = match[2];
      if (subPath === '/') subPath = '';
      const fullPath = (baseMount === '/api' && subPath.startsWith('/')) ? `/api${subPath}` : `${baseMount}${subPath}`;
      const endpointId = `endpoint:${method}_${fullPath}`;

      addNode({
        id: endpointId,
        label: `${method} ${fullPath}`,
        type: 'ApiEndpoint',
        group: 'api',
        file: relPath,
        metadata: {
          method,
          path: fullPath,
          routeFile: file
        }
      });

      addEdge(routeFileId, endpointId, 'EXPOSES_ENDPOINT', method);
    }
  }
  console.log('✅ Parsed Backend Routes & API Endpoints');
}

// ==========================================
// 4. PARSE FRONTEND (Pages, Components, API Calls)
// ==========================================
function parseFrontend() {
  const pagesDir = path.join(frontendDir, 'src', 'pages');
  const componentsDir = path.join(frontendDir, 'src', 'components');

  addNode({
    id: 'frontend:api_client',
    label: 'api.js (Frontend Client)',
    type: 'FrontendService',
    group: 'frontend',
    file: 'frontend/src/services/api.js',
    metadata: { description: 'Axios/Fetch wrapper for /api calls with JWT auto-attach' }
  });

  function scanDirectory(dir, groupName, typeName) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.jsx') && !file.endsWith('.js')) continue;
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = `frontend/src/${groupName}/${file}`;
      const componentId = `frontend:${file.replace(/\.(jsx|js)$/, '')}`;

      addNode({
        id: componentId,
        label: file,
        type: typeName,
        group: 'frontend',
        file: relPath,
        metadata: {}
      });

      // Find API URLs referenced. Frontend apiRequest() calls are relative to
      // API_BASE, so normalize `/provider/...` to the mounted `/api/provider/...`
      // route before matching backend endpoint nodes.
      const apiPathRegex = /(?:apiRequest|fetch)\(\s*['"`](\/[^'"`?]+)['"`]/g;
      const explicitApiPathRegex = /['"`](\/api\/[a-zA-Z0-9_\-/${}:]+)['"`]/g;
      let pathMatch;
      const apiMatches = [];
      while ((pathMatch = apiPathRegex.exec(content)) !== null) apiMatches.push(pathMatch[1]);
      while ((pathMatch = explicitApiPathRegex.exec(content)) !== null) apiMatches.push(pathMatch[1]);
      for (const rawPath of apiMatches) {
        let endpointPath = rawPath.split('?')[0].replace(/[$][{][^}]+}/g, ':id');
        if (!endpointPath.startsWith('/api/')) endpointPath = `/api${endpointPath}`;
        addEdge(componentId, 'frontend:api_client', 'USES_CLIENT');

        // Link with matching backend endpoint nodes
        for (const [nodeId, node] of nodeMap.entries()) {
          if (node.type === 'ApiEndpoint') {
            const epPath = node.metadata.path;
            if (epPath === endpointPath || epPath.replace(/:[a-zA-Z0-9_]+/g, ':id') === endpointPath) {
              addEdge(componentId, nodeId, 'FETCHES_API', node.metadata.method);
            }
          }
        }
      }

      // Check component imports
      const importRegex = /import\s+.*?from\s+['"`]\.\.?\/(?:components\/|pages\/)?([A-Za-z0-9_]+)(?:\.jsx?)?['"`]/g;
      let impMatch;
      while ((impMatch = importRegex.exec(content)) !== null) {
        const importedName = impMatch[1];
        const targetId = `frontend:${importedName}`;
        addEdge(componentId, targetId, 'RENDERS_COMPONENT');
      }
    }
  }

  scanDirectory(pagesDir, 'pages', 'FrontendPage');
  scanDirectory(componentsDir, 'components', 'FrontendComponent');
  console.log('✅ Parsed Frontend Pages, Components & API Links');
}

// ==========================================
// 5. GENERATE OUTPUT FILES
// ==========================================
function generateOutput() {
  const outputDir = path.join(rootDir, 'Knowladge-Graph');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. JSON Graph
  const graphData = {
    name: 'Luxora Living Codebase Knowledge Graph',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByGroup: nodes.reduce((acc, n) => {
        acc[n.group] = (acc[n.group] || 0) + 1;
        return acc;
      }, {})
    },
    nodes,
    edges
  };

  const jsonPath = path.join(outputDir, 'knowledge-graph.json');
  fs.writeFileSync(jsonPath, JSON.stringify(graphData, null, 2), 'utf-8');
  console.log(`💾 Saved Knowledge Graph JSON: ${jsonPath}`);

  // 2. Interactive HTML Viewer (Vis.js Network)
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luxora Codebase Knowledge Graph</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style>
    :root {
      --bg-color: #0b0f19;
      --card-bg: #151d30;
      --text-color: #e2e8f0;
      --accent: #38bdf8;
      --border-color: #1e293b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg-color); color: var(--text-color); height: 100vh; display: flex; overflow: hidden; }
    #sidebar { width: 380px; min-width: 380px; background: var(--card-bg); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; z-index: 10; transition: width 0.22s ease, min-width 0.22s ease, opacity 0.22s ease; }
    #sidebar.collapsed { width: 0; min-width: 0; opacity: 0; overflow: hidden; border-right: 0; }
    #graph-container { flex: 1; height: 100vh; position: relative; }
    .header { padding: 18px 20px; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.25); }
    .header h1 { font-size: 1.15rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .header p { font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }
    .search-box { padding: 12px 20px; border-bottom: 1px solid var(--border-color); }
    .search-box input { width: 100%; padding: 10px 14px; background: #0b0f19; border: 1px solid var(--border-color); border-radius: 6px; color: #fff; outline: none; font-size: 0.85rem; }
    .search-box input:focus { border-color: var(--accent); }
    .controls { padding: 12px 20px; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 6px; }
    .filter-btn { padding: 5px 11px; font-size: 0.75rem; border-radius: 14px; border: 1px solid var(--border-color); background: #0b0f19; color: #cbd5e1; cursor: pointer; transition: 0.2s; }
    .filter-btn.active { background: var(--accent); color: #0b0f19; font-weight: bold; border-color: var(--accent); }
    #details-panel { flex: 1; padding: 20px; overflow-y: auto; font-size: 0.85rem; }
    .stat-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: bold; margin-right: 4px; }
    .legend { position: absolute; bottom: 20px; right: 20px; background: rgba(21, 29, 48, 0.95); padding: 14px 18px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.75rem; z-index: 5; pointer-events: none; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .legend-color { width: 12px; height: 12px; border-radius: 50%; }
    .settings-dock { position: absolute; top: 20px; right: 20px; width: 238px; z-index: 6; background: rgba(21, 29, 48, 0.96); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); overflow: hidden; }
    .settings-dock summary { padding: 12px 14px; color: #fff; font-size: 0.82rem; font-weight: 700; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
    .settings-dock summary::-webkit-details-marker { display: none; }
    .settings-dock summary::after { content: '+'; color: #94a3b8; font-size: 1rem; }
    .settings-dock[open] summary::after { content: '-'; }
    .settings-content { border-top: 1px solid var(--border-color); padding: 12px 14px 14px; }
    .settings-section { margin-top: 12px; }
    .settings-section:first-child { margin-top: 0; }
    .settings-label { color: #94a3b8; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 7px; }
    .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #cbd5e1; font-size: 0.74rem; margin-top: 8px; }
    .settings-row input[type='range'] { width: 112px; accent-color: var(--accent); }
    .settings-row input[type='checkbox'] { accent-color: var(--accent); }
    .settings-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 14px; }
    .settings-action { min-height: 31px; border: 1px solid var(--border-color); border-radius: 5px; background: #0b0f19; color: #cbd5e1; cursor: pointer; font-size: 0.72rem; }
    .settings-action:hover, .settings-action:focus-visible { border-color: var(--accent); color: #fff; outline: none; }
    .sidebar-toggle { position: absolute; top: 14px; left: 14px; z-index: 7; min-height: 32px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 5px; background: rgba(21, 29, 48, 0.96); color: #cbd5e1; cursor: pointer; font-size: 0.72rem; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
    .sidebar-toggle:hover, .sidebar-toggle:focus-visible { border-color: var(--accent); color: #fff; outline: none; }
    .graph-status { color: #64748b; font-size: 0.7rem; margin-top: 10px; }
    .code-tag { background: #0b0f19; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 0.78rem; color: #38bdf8; word-break: break-all; border: 1px solid #1e293b; }
    .badge-count { background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: auto; }
    .conn-list { background: #0b0f19; border-radius: 6px; border: 1px solid #1e293b; padding: 8px; max-height: 180px; overflow-y: auto; }
    .conn-item { padding: 4px 0; border-bottom: 1px solid #162032; font-size: 0.78rem; display: flex; justify-content: space-between; }
    .conn-item:last-child { border-bottom: none; }
    @media (max-width: 760px) {
      #sidebar { width: min(320px, 44vw); }
      .settings-dock { top: 12px; right: 12px; width: 218px; }
      .legend { bottom: 12px; right: 12px; }
    }
  </style>
</head>
<body>
  <div id="sidebar">
    <div class="header">
      <h1>🕸️ Luxora Codebase Graph</h1>
      <p>Living Architecture & Dependency Knowledge Graph</p>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search node, file, route, model..." />
    </div>
    <div class="controls">
      <button class="filter-btn active" data-group="all">All (${nodes.length})</button>
      <button class="filter-btn" data-group="frontend">Frontend</button>
      <button class="filter-btn" data-group="routes">Routes</button>
      <button class="filter-btn" data-group="api">Endpoints</button>
      <button class="filter-btn" data-group="service">Services</button>
      <button class="filter-btn" data-group="database">Database</button>
      <button class="filter-btn" data-group="middleware">Auth/MW</button>
    </div>
    <div id="details-panel">
      <h3 style="color: #94a3b8; font-size: 0.88rem; margin-bottom: 10px;">🔍 Node Inspector</h3>
      <p style="color: #64748b; line-height: 1.5;">Click on any node in the interactive graph to analyze its file path, API routes, database models, and impact blast radius.</p>
    </div>
  </div>

  <div id="graph-container">
    <div id="network" style="width: 100%; height: 100%;"></div>
    <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-controls="sidebar" aria-expanded="true">Hide panel</button>
    <details class="settings-dock" open>
      <summary>Graph Settings</summary>
      <div class="settings-content">
        <div class="settings-section">
          <div class="settings-label">Display</div>
          <label class="settings-row"><span>Animate physics</span><input id="physicsToggle" type="checkbox" checked></label>
          <label class="settings-row"><span>Show edge labels</span><input id="edgeLabelToggle" type="checkbox"></label>
        </div>
        <div class="settings-section">
          <div class="settings-label">Scale</div>
          <label class="settings-row"><span>Node size</span><input id="nodeScale" type="range" min="70" max="160" value="100"></label>
          <label class="settings-row"><span>Edge strength</span><input id="edgeOpacity" type="range" min="10" max="90" value="35"></label>
        </div>
        <div class="settings-section">
          <div class="settings-label">Layout spacing</div>
          <label class="settings-row"><span>Connected spacing</span><input id="innerSpacing" type="range" min="45" max="180" value="90"></label>
          <label class="settings-row"><span>Outer pull</span><input id="outerPull" type="range" min="1" max="50" value="5"></label>
        </div>
        <div class="settings-actions">
          <button class="settings-action" id="fitGraph" type="button">Fit graph</button>
          <button class="settings-action" id="resetGraph" type="button">Reset view</button>
        </div>
        <div class="graph-status" id="graphStatus" aria-live="polite"></div>
      </div>
    </details>
    <div class="legend">
      <div style="font-weight: bold; margin-bottom: 8px; color: #fff;">System Legend</div>
      <div class="legend-item"><div class="legend-color" style="background:#38bdf8"></div>Frontend UI / Components</div>
      <div class="legend-item"><div class="legend-color" style="background:#818cf8"></div>Route Handlers</div>
      <div class="legend-item"><div class="legend-color" style="background:#34d399"></div>API Endpoints</div>
      <div class="legend-item"><div class="legend-color" style="background:#fb923c"></div>Services / Business Logic</div>
      <div class="legend-item"><div class="legend-color" style="background:#f472b6"></div>Middleware / RBAC Auth</div>
      <div class="legend-item"><div class="legend-color" style="background:#facc15"></div>Prisma Database Models</div>
    </div>
  </div>

  <script>
    const graphData = ${JSON.stringify(graphData)};

    const colorMap = {
      frontend: '#38bdf8',
      routes: '#818cf8',
      api: '#34d399',
      service: '#fb923c',
      middleware: '#f472b6',
      database: '#facc15'
    };

    const visNodes = new vis.DataSet(graphData.nodes.map(n => ({
      id: n.id,
      label: n.label,
      group: n.group,
      color: {
        background: colorMap[n.group] || '#94a3b8',
        border: '#ffffff',
        highlight: { background: '#ffffff', border: colorMap[n.group] || '#38bdf8' }
      },
      font: { color: '#ffffff', size: 11, face: 'system-ui' },
      shape: n.group === 'database' ? 'database' : (n.group === 'api' ? 'box' : 'dot'),
      size: n.group === 'database' ? 20 : (n.group === 'api' ? 14 : 16),
      baseSize: n.group === 'database' ? 20 : (n.group === 'api' ? 14 : 16)
    })));

    const visEdges = new vis.DataSet(graphData.edges.map((e, idx) => ({
      id: 'e_' + idx,
      from: e.from,
      to: e.to,
      label: e.label || '',
      arrows: 'to',
      color: { color: 'rgba(148, 163, 184, 0.35)', highlight: '#38bdf8' },
      font: { color: '#94a3b8', size: 9, align: 'middle' },
      smooth: { type: 'continuous' }
    })));

    const container = document.getElementById('network');
    const data = { nodes: visNodes, edges: visEdges };
    const options = {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -40,
          centralGravity: 0.005,
          springLength: 90,
          springConstant: 0.15
        },
        maxVelocity: 50,
        stabilization: { iterations: 150 }
      },
      interaction: { hover: true, tooltipDelay: 100, zoomView: true }
    };

    const network = new vis.Network(container, data, options);
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    function setSidebarCollapsed(collapsed) {
      sidebar.classList.toggle('collapsed', collapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      sidebarToggle.textContent = collapsed ? 'Show panel' : 'Hide panel';
      window.requestAnimationFrame(() => network.redraw());
    }

    sidebarToggle.addEventListener('click', () => {
      setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
    });
    const uiState = {
      group: 'all',
      term: '',
      nodeScale: 1,
      edgeOpacity: 0.35,
      showEdgeLabels: false,
      innerSpacing: 90,
      outerPull: 0.005
    };

    function matchingNodeIds() {
      return new Set(graphData.nodes.filter(node => {
        const matchesGroup = uiState.group === 'all' || node.group === uiState.group;
        const searchableText = [node.label, node.id, node.file, node.type].filter(Boolean).join(' ').toLowerCase();
        return matchesGroup && (!uiState.term || searchableText.includes(uiState.term));
      }).map(node => node.id));
    }

    function updateGraphVisibility() {
      const visibleNodeIds = matchingNodeIds();
      visNodes.forEach(node => visNodes.update({ id: node.id, hidden: !visibleNodeIds.has(node.id) }));
      visEdges.forEach(edge => visEdges.update({
        id: edge.id,
        hidden: !visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)
      }));
      document.getElementById('graphStatus').textContent = 'Showing ' + visibleNodeIds.size + ' of ' + graphData.nodes.length + ' nodes';
    }

    function updateNodeScale() {
      visNodes.forEach(node => visNodes.update({ id: node.id, size: Math.round(node.baseSize * uiState.nodeScale) }));
    }

    function updateEdgeAppearance() {
      visEdges.forEach(edge => visEdges.update({
        id: edge.id,
        color: { color: 'rgba(148, 163, 184, ' + uiState.edgeOpacity + ')', highlight: '#38bdf8' },
        font: { color: uiState.showEdgeLabels ? '#94a3b8' : 'rgba(148, 163, 184, 0)', size: 9, align: 'middle' }
      }));
    }

    function fitGraph() {
      network.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } });
    }

    function updateLayoutSpacing() {
      network.setOptions({
        physics: {
          forceAtlas2Based: {
            springLength: uiState.innerSpacing,
            centralGravity: uiState.outerPull
          }
        }
      });
      network.startSimulation();
    }

    function resetGraph() {
      uiState.group = 'all';
      uiState.term = '';
      uiState.nodeScale = 1;
      uiState.edgeOpacity = 0.35;
      uiState.showEdgeLabels = false;
      uiState.innerSpacing = 90;
      uiState.outerPull = 0.005;
      document.getElementById('searchInput').value = '';
      document.getElementById('nodeScale').value = '100';
      document.getElementById('edgeOpacity').value = '35';
      document.getElementById('innerSpacing').value = '90';
      document.getElementById('outerPull').value = '5';
      document.getElementById('edgeLabelToggle').checked = false;
      document.getElementById('physicsToggle').checked = true;
      document.querySelectorAll('.filter-btn').forEach(button => button.classList.toggle('active', button.dataset.group === 'all'));
      visNodes.forEach(node => visNodes.update({ id: node.id, fixed: false, x: null, y: null }));
      updateGraphVisibility();
      updateNodeScale();
      updateEdgeAppearance();
      updateLayoutSpacing();
      network.setOptions({ physics: { enabled: true } });
      fitGraph();
    }

    // Node Selection & Detailed Inspector
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const inbound = graphData.edges.filter(e => e.to === nodeId);
        const outbound = graphData.edges.filter(e => e.from === nodeId);

        let html = \`
          <h2 style="color: #fff; font-size: 1.05rem; margin-bottom: 8px; word-break: break-word;">\${node.label}</h2>
          <div style="margin-bottom: 12px;">
            <span class="stat-badge" style="background: \${colorMap[node.group] || '#64748b'}; color: #000;">\${node.type}</span>
            <span class="stat-badge" style="background: #1e293b; color: #94a3b8;">\${node.group}</span>
          </div>
          
          <div style="margin-bottom: 14px;">
            <div style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">File Location</div>
            <div class="code-tag">\${node.file || 'Dynamic / In-Memory'}</div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; display:flex; align-items:center;">
              💥 Upstream Callers (\${inbound.length})
            </div>
            \${inbound.length === 0 ? '<p style="color:#64748b; font-size:0.78rem;">None (Root Entry)</p>' : \`
              <div class="conn-list">
                \${inbound.map(e => \`
                  <div class="conn-item">
                    <span style="color:#38bdf8; max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${e.from}</span>
                    <span style="color:#64748b; font-size:0.7rem;">\${e.type}</span>
                  </div>
                \`).join('')}
              </div>
            \`}
          </div>

          <div style="margin-bottom: 14px;">
            <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; display:flex; align-items:center;">
              🎯 Downstream Impact (\${outbound.length})
            </div>
            \${outbound.length === 0 ? '<p style="color:#64748b; font-size:0.78rem;">None (Leaf Node)</p>' : \`
              <div class="conn-list">
                \${outbound.map(e => \`
                  <div class="conn-item">
                    <span style="color:#34d399; max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${e.to}</span>
                    <span style="color:#64748b; font-size:0.7rem;">\${e.type}</span>
                  </div>
                \`).join('')}
              </div>
            \`}
          </div>
        \`;

        document.getElementById('details-panel').innerHTML = html;
      }
    });

    // Search filter
    document.getElementById('searchInput').addEventListener('input', (e) => {
      uiState.term = e.target.value.toLowerCase().trim();
      updateGraphVisibility();
    });

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        uiState.group = btn.dataset.group;
        updateGraphVisibility();
      });
    });

    document.getElementById('physicsToggle').addEventListener('change', (event) => {
      network.setOptions({ physics: { enabled: event.target.checked } });
      if (event.target.checked) network.startSimulation();
    });

    document.getElementById('edgeLabelToggle').addEventListener('change', (event) => {
      uiState.showEdgeLabels = event.target.checked;
      updateEdgeAppearance();
    });

    document.getElementById('nodeScale').addEventListener('input', (event) => {
      uiState.nodeScale = Number(event.target.value) / 100;
      updateNodeScale();
    });

    document.getElementById('edgeOpacity').addEventListener('input', (event) => {
      uiState.edgeOpacity = Number(event.target.value) / 100;
      updateEdgeAppearance();
    });

    document.getElementById('innerSpacing').addEventListener('input', (event) => {
      uiState.innerSpacing = Number(event.target.value);
      updateLayoutSpacing();
    });

    document.getElementById('outerPull').addEventListener('input', (event) => {
      uiState.outerPull = Number(event.target.value) / 1000;
      updateLayoutSpacing();
    });

    document.getElementById('fitGraph').addEventListener('click', fitGraph);
    document.getElementById('resetGraph').addEventListener('click', resetGraph);
    updateGraphVisibility();
    updateEdgeAppearance();
  </script>
</body>
</html>`;

  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`🌐 Saved Interactive Graph Explorer HTML: ${htmlPath}`);

  console.log(`\n🎉 Knowledge Graph Generation Complete!`);
  console.log(`   - Nodes: ${nodes.length}`);
  console.log(`   - Edges: ${edges.length}`);
}

// Run scanner
parsePrismaSchema();
parseBackendModules();
parseBackendRoutes();
parseFrontend();
generateOutput();
