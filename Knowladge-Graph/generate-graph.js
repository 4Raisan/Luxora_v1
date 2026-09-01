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
  const normalized = {
    ...node,
    ...(node.file && !node.source ? { source: { path: node.file } } : {}),
  };
  if (!nodeMap.has(node.id)) {
    nodeMap.set(node.id, normalized);
    nodes.push(normalized);
  } else {
    const existing = nodeMap.get(node.id);
    Object.assign(existing, { ...normalized, metadata: { ...existing.metadata, ...normalized.metadata } });
  }
}

function addEdge(from, to, type, label = '', evidence = {}) {
  if (!from || !to) return;
  const edgeKey = `${from}->${to}:${type}`;
  if (!edges.some(e => `${e.from}->${e.to}:${e.type}` === edgeKey)) {
    const sourcePath = nodeMap.get(from)?.file;
    edges.push({
      id: edgeKey,
      from,
      to,
      type,
      label,
      source: from,
      target: to,
      kind: type,
      evidence: {
        ...(sourcePath ? { path: sourcePath } : {}),
        extractor: 'generate-graph.js:static-analysis',
        ...evidence,
      },
    });
  }
}

function sortGraphFacts() {
  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  for (const node of nodes) {
    if (Array.isArray(node.metadata?.fields)) node.metadata.fields.sort((left, right) => left.name.localeCompare(right.name));
    if (Array.isArray(node.metadata?.values)) node.metadata.values.sort((left, right) => left.localeCompare(right));
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
  const enumNames = new Set([...schemaContent.matchAll(/^enum\s+([A-Za-z0-9_]+)\s*\{/gm)].map((match) => match[1]));

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
            // References another model or a Prisma enum.
            const targetId = enumNames.has(fieldType) ? `enum:${fieldType}` : `model:${fieldType}`;
            addEdge(`model:${currentModel}`, targetId, 'DB_RELATION', fieldName);
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

  function scanDirectory(dir, groupName, typeName, relativeDir = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scanDirectory(path.join(dir, entry.name), groupName, typeName, path.join(relativeDir, entry.name));
        continue;
      }
      const file = entry.name;
      if (!file.endsWith('.jsx') && !file.endsWith('.js')) continue;
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.posix.join('frontend', 'src', groupName, relativeDir.split(path.sep).join('/'), file);
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
  const rendererSourcePath = path.join(rootDir, 'node_modules', 'vis-network', 'standalone', 'umd', 'vis-network.min.js');
  const rendererOutputPath = path.join(outputDir, 'vis-network.min.js');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  sortGraphFacts();

  // 1. JSON Graph. This output intentionally has no timestamp or random data,
  // so an identical repository state always produces identical graph files.
  const jsonPath = path.join(outputDir, 'knowledge-graph.json');
  const repository = process.env.GITHUB_REPOSITORY || '4Raisan/Luxora_v1';
  const branch = process.env.GITHUB_REF_NAME || 'main';
  const graphFacts = {
    name: 'Luxora Living Codebase Knowledge Graph',
    version: '1.1.0',
    sourceRepository: { repository, branch },
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

  fs.writeFileSync(jsonPath, JSON.stringify(graphFacts, null, 2) + '\n', 'utf-8');
  console.log(`💾 Saved Knowledge Graph JSON: ${jsonPath}`);

  if (fs.existsSync(rendererSourcePath)) {
    fs.copyFileSync(rendererSourcePath, rendererOutputPath);
    console.log(`🕸️ Saved bundled graph renderer: ${rendererOutputPath}`);
  } else if (!fs.existsSync(rendererOutputPath)) {
    throw new Error('vis-network is missing. Run npm ci before generating the Knowledge Graph.');
  }

  // 2. Interactive HTML Viewer (Vis.js Network)
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luxora Codebase Knowledge Graph</title>
  <script type="text/javascript" src="./vis-network.min.js"></script>
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
    #graph-container { flex: 1; height: 100vh; position: relative; overflow: hidden; isolation: isolate; }
    #network { position: absolute; inset: 0; z-index: 0; }
    .header { padding: 18px 20px; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.25); }
    .header h1 { font-size: 1.15rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .header p { font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }
    .search-box { padding: 12px 20px; border-bottom: 1px solid var(--border-color); position: relative; }
    .search-box input { width: 100%; padding: 10px 32px 10px 14px; background: #0b0f19; border: 1px solid var(--border-color); border-radius: 6px; color: #fff; outline: none; font-size: 0.85rem; }
    .search-box input:focus { border-color: var(--accent); }
    .search-clear { position: absolute; right: 28px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem; padding: 4px; display: none; line-height: 1; }
    .search-clear:hover { color: #cbd5e1; }
    .controls { padding: 12px 20px; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 6px; }
    .filter-btn { padding: 5px 11px; font-size: 0.75rem; border-radius: 14px; border: 1px solid var(--border-color); background: #0b0f19; color: #cbd5e1; cursor: pointer; transition: 0.2s; }
    .filter-btn.active { background: var(--accent); color: #0b0f19; font-weight: bold; border-color: var(--accent); }
    #details-panel { flex: 1; padding: 20px; overflow-y: auto; font-size: 0.85rem; }
    .sidebar-status { padding: 12px 20px; border-top: 1px solid var(--border-color); background: rgba(15, 23, 42, 0.5); color: #94a3b8; font-size: 0.72rem; line-height: 1.45; }
    .stat-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: bold; margin-right: 4px; }
    .legend { position: absolute; bottom: 20px; right: 280px; width: 250px; background: rgba(21, 29, 48, 0.96); backdrop-filter: blur(12px); padding: 16px 18px; border-radius: 8px; border: 1px solid #334155; font-size: 0.78rem; z-index: 20; cursor: grab; touch-action: none; user-select: none; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
    .legend.dragging { cursor: grabbing; box-shadow: 0 12px 40px rgba(0,0,0,0.7); }
    .legend-item { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
    .legend-color { width: 14px; height: 14px; border-radius: 50%; flex: 0 0 14px; }
    .settings-dock { position: absolute; top: 20px; right: 20px; width: 248px; max-height: calc(100vh - 40px); z-index: 21; background: rgba(21, 29, 48, 0.96); backdrop-filter: blur(12px); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); overflow-y: auto; overscroll-behavior: contain; }
    .settings-dock::-webkit-scrollbar { width: 4px; }
    .settings-dock::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    .settings-dock summary { padding: 12px 14px; color: #fff; font-size: 0.82rem; font-weight: 700; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: #151d30; z-index: 2; }
    .settings-dock summary::-webkit-details-marker { display: none; }
    .settings-dock summary::after { content: '+'; color: #94a3b8; font-size: 1rem; }
    .settings-dock[open] summary::after { content: '-'; }
    .settings-content { border-top: 1px solid var(--border-color); padding: 12px 14px 14px; }
    .settings-section { margin-top: 12px; }
    .settings-section:first-child { margin-top: 0; }
    .settings-label { color: #94a3b8; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 7px; }
    .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #cbd5e1; font-size: 0.74rem; margin-top: 8px; }
    .settings-row input[type='range'] { width: 112px; accent-color: var(--accent); }
    .settings-row input[type='checkbox'] { accent-color: var(--accent); cursor: pointer; }
    .settings-row input[type='color'] { width: 32px; height: 24px; padding: 1px; border: 1px solid var(--border-color); border-radius: 4px; background: transparent; cursor: pointer; }
    .settings-row select { width: 112px; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px; background: #0b0f19; color: #cbd5e1; font-size: 0.72rem; }
    .settings-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 14px; }
    .settings-action { min-height: 31px; border: 1px solid var(--border-color); border-radius: 5px; background: #0b0f19; color: #cbd5e1; cursor: pointer; font-size: 0.72rem; transition: border-color 0.15s, color 0.15s; }
    .settings-action:hover, .settings-action:focus-visible { border-color: var(--accent); color: #fff; outline: none; }
    .sidebar-toggle { position: absolute; top: 14px; left: 14px; z-index: 22; min-height: 32px; padding: 0 10px; border: 1px solid var(--border-color); border-radius: 5px; background: #151d30; color: #cbd5e1; cursor: pointer; font-size: 0.72rem; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
    .sidebar-toggle:hover, .sidebar-toggle:focus-visible { border-color: var(--accent); color: #fff; outline: none; }
    .more-settings { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); }
    .more-settings summary { display: flex; align-items: center; justify-content: space-between; cursor: pointer; color: #cbd5e1; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; list-style: none; }
    .more-settings summary::-webkit-details-marker { display: none; }
    .more-settings summary::after { content: '+'; color: #38bdf8; font-size: 1rem; }
    .more-settings[open] summary::after { content: '−'; }
    .more-settings .settings-section { margin-top: 12px; }
    .code-tag { display: inline-block; background: #0b0f19; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 0.78rem; color: #38bdf8; word-break: break-all; border: 1px solid #1e293b; text-decoration: none; }
    .code-tag:hover { border-color: var(--accent); text-decoration: underline; }
    .badge-count { background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: auto; }
    .conn-list { background: #0b0f19; border-radius: 6px; border: 1px solid #1e293b; padding: 4px; max-height: 180px; overflow-y: auto; }
    .conn-item { padding: 5px 8px; border-bottom: 1px solid #162032; font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-radius: 4px; transition: background 0.15s ease; }
    .conn-item:hover { background: #1e293b; }
    .conn-item:last-child { border-bottom: none; }
    .clickable-node { color: #38bdf8; text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.15s ease; }
    .conn-item:hover .clickable-node { text-decoration-color: #38bdf8; }
    @media (max-width: 760px) {
      #sidebar { width: min(320px, 80vw); min-width: 0; position: absolute; top: 0; bottom: 0; left: 0; z-index: 30; }
      .settings-dock { top: 12px; right: 12px; width: 218px; max-height: calc(100vh - 24px); }
      .legend { bottom: 12px; right: 12px; max-width: calc(100vw - 24px); }
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
      <input type="text" id="searchInput" placeholder="Search node, file, route, model (Enter to focus)..." />
      <button class="search-clear" id="searchClear" type="button" aria-label="Clear search">✕</button>
    </div>
    <div class="controls" id="filterControls">
      <button class="filter-btn active" data-group="all">All</button>
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
    <div class="sidebar-status" id="graphStatus" aria-live="polite"></div>
  </div>

  <div id="graph-container">
    <div id="network" style="width: 100%; height: 100%;"></div>
    <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-controls="sidebar" aria-expanded="true">Hide panel</button>
    <details class="settings-dock" open>
      <summary>Graph Settings</summary>
      <div class="settings-content">
        <div class="settings-section">
          <div class="settings-label">Physics & Orbit</div>
          <label class="settings-row"><span>Live physics & orbit</span><input id="motionToggle" type="checkbox" checked></label>
          <label class="settings-row"><span>Edge labels</span><select id="edgeLabelMode"><option value="always">Always</option><option value="selected">Selected node</option><option value="light" selected>Light</option><option value="none">Off</option></select></label>
        </div>
        <div class="settings-section">
          <div class="settings-label">Scale & Contrast</div>
          <label class="settings-row"><span>Node size <output id="nodeScaleValue">100%</output></span><input id="nodeScale" type="range" min="70" max="160" value="100"></label>
          <label class="settings-row"><span>Label size <output id="labelScaleValue">100%</output></span><input id="labelScale" type="range" min="70" max="160" value="100"></label>
          <label class="settings-row"><span>Edge opacity <output id="edgeOpacityValue">18%</output></span><input id="edgeOpacity" type="range" min="5" max="80" value="18"></label>
        </div>
        <div class="settings-section">
          <div class="settings-label">Concentric Layout & Spacing</div>
          <label class="settings-row"><span>Ring spacing <output id="innerSpacingValue">120 px</output></span><input id="innerSpacing" type="range" min="60" max="240" value="120"></label>
          <label class="settings-row"><span>Outer shell <output id="outerPullValue">0</output></span><input id="outerPull" type="range" min="-100" max="200" value="0"></label>
          <label class="settings-row"><span>Physics spring <output id="physicsStrengthValue">100%</output></span><input id="physicsStrength" type="range" min="25" max="175" value="100"></label>
          <label class="settings-row"><span>Orbit speed <output id="rotationSpeedValue">100%</output></span><input id="rotationSpeed" type="range" min="0" max="200" value="100"></label>
        </div>
        <div class="settings-actions" style="grid-template-columns: 1fr;">
          <button class="settings-action" id="fitGraph" type="button">Fit graph</button>
        </div>
        <div class="settings-actions" style="grid-template-columns: 1fr; margin-top: 7px;">
          <button class="settings-action" id="exportGraph" type="button">Download full diagram PNG</button>
        </div>
        <details class="more-settings">
          <summary>More settings</summary>
          <div class="settings-section">
            <label class="settings-row"><span>Diagram background</span><input id="backgroundColor" type="color" value="#0b0f19"></label>
            <label class="settings-row"><span>Horizontal vibe <output id="horizontalVibeValue">0%</output></span><input id="horizontalVibe" type="range" min="0" max="50" value="0" aria-label="Horizontal vibe control"></label>
          </div>
          <div class="settings-actions" style="grid-template-columns: 1fr;">
            <button class="settings-action" id="resetGraph" type="button">Reset view</button>
          </div>
        </details>
      </div>
    </details>
    <div class="legend">
      <div style="font-weight: bold; margin-bottom: 12px; color: #fff;">System Legend</div>
      <div class="legend-item"><div class="legend-color" style="background:#38bdf8"></div>Frontend UI / Components</div>
      <div class="legend-item"><div class="legend-color" style="background:#818cf8"></div>Route Handlers</div>
      <div class="legend-item"><div class="legend-color" style="background:#34d399"></div>API Endpoints</div>
      <div class="legend-item"><div class="legend-color" style="background:#fb923c"></div>Services / Business Logic</div>
      <div class="legend-item"><div class="legend-color" style="background:#f472b6"></div>Middleware / RBAC Auth</div>
      <div class="legend-item"><div class="legend-color" style="background:#facc15"></div>Prisma Database Models</div>
      <div class="legend-item"><div class="legend-color" style="background:#ef4444"></div>Unlinked Source Evidence</div>
    </div>
  </div>

  <script type="module">
    let graphData;
    try {
      const response = await fetch('./knowledge-graph.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      graphData = await response.json();
    } catch (error) {
      document.body.innerHTML = '<main style="padding:2rem;color:#fff;background:#0b0f19;font-family:system-ui"><h1>Knowledge Graph unavailable</h1><p>The generated graph JSON could not be loaded.</p></main>';
      throw error;
    }

    const colorMap = {
      frontend: '#38bdf8',
      routes: '#818cf8',
      api: '#34d399',
      service: '#fb923c',
      middleware: '#f472b6',
      database: '#facc15'
    };
    const unlinkedColor = '#ef4444';

    // Populate filter button counts dynamically from graph data
    const counts = { all: graphData.nodes.length };
    graphData.nodes.forEach(n => {
      counts[n.group] = (counts[n.group] || 0) + 1;
    });
    const labelMap = {
      all: 'All',
      frontend: 'Frontend',
      routes: 'Routes',
      api: 'Endpoints',
      service: 'Services',
      database: 'Database',
      middleware: 'Auth/MW'
    };
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const g = btn.dataset.group;
      const baseName = labelMap[g] || g;
      const count = counts[g] || 0;
      btn.textContent = \`\${baseName} (\${count})\`;
    });

    const degreeById = new Map(graphData.nodes.map(node => [node.id, 0]));
    graphData.edges.forEach(edge => {
      degreeById.set(edge.from, (degreeById.get(edge.from) || 0) + 1);
      degreeById.set(edge.to, (degreeById.get(edge.to) || 0) + 1);
    });

    const nodeOrbitInfo = new Map();

    // Compute multi-track concentric circular layout so database cylinders and API boxes never overlap
    function computeConcentricLayout(nodes, edges, spacingMultiplier = 1, outerShellBonus = 0, horizontalVibePct = 0) {
      const rings = {
        0: [], // Center Core Hubs (Middleware)
        1: [], // Inner Database Core (Top connected DB models)
        2: [], // Secondary Database Ring (Remaining DB models)
        3: [], // Core Business Services
        4: [], // Route Controllers
        5: [], // API Endpoints Track 1
        6: [], // API Endpoints Track 2
        7: [], // API Endpoints Track 3
        8: [], // Frontend UI Pages & Components
        9: []  // Outermost Shell (Unlinked Evidence)
      };

      const dbNodes = nodes.filter(n => n.group === 'database' && (degreeById.get(n.id) || 0) > 0);
      dbNodes.sort((a, b) => (degreeById.get(b.id) || 0) - (degreeById.get(a.id) || 0));
      const dbCoreSet = new Set(dbNodes.slice(0, 12).map(n => n.id));

      const apiNodes = nodes.filter(n => n.group === 'api' && (degreeById.get(n.id) || 0) > 0);
      apiNodes.sort((a, b) => a.label.localeCompare(b.label));
      const apiTrackMap = new Map();
      apiNodes.forEach((n, idx) => {
        apiTrackMap.set(n.id, 5 + (idx % 3)); // Stagger across rings 5, 6, 7
      });

      nodes.forEach(node => {
        const deg = degreeById.get(node.id) || 0;
        if (deg === 0) {
          rings[9].push(node); // Ring 9: Outermost Unlinked Evidence
        } else if (node.group === 'middleware') {
          rings[0].push(node); // Ring 0: Center Hubs
        } else if (node.group === 'database') {
          if (dbCoreSet.has(node.id)) rings[1].push(node); // Ring 1: Primary Database Core
          else rings[2].push(node); // Ring 2: Secondary Database
        } else if (node.group === 'service') {
          rings[3].push(node); // Ring 3: Services
        } else if (node.group === 'routes') {
          rings[4].push(node); // Ring 4: Route Handlers
        } else if (node.group === 'api') {
          const track = apiTrackMap.get(node.id) || 5;
          rings[track].push(node); // Rings 5, 6, 7: Interleaved API Endpoints
        } else if (node.group === 'frontend') {
          rings[8].push(node); // Ring 8: Frontend UI Pages & Components
        } else {
          rings[9].push(node);
        }
      });

      const baseRadii = {
        0: 90 * spacingMultiplier,
        1: 240 * spacingMultiplier,
        2: 400 * spacingMultiplier,
        3: 540 * spacingMultiplier,
        4: 680 * spacingMultiplier,
        5: 840 * spacingMultiplier,
        6: 980 * spacingMultiplier,
        7: 1120 * spacingMultiplier,
        8: 1300 * spacingMultiplier + outerShellBonus * 1.5,
        9: 1480 * spacingMultiplier + outerShellBonus * 3.0
      };

      // Harmonious orbital velocities (rad/sec)
      const ringSpeeds = {
        0: 0.020,
        1: -0.030,
        2: 0.035,
        3: -0.040,
        4: 0.045,
        5: -0.050,
        6: 0.055,
        7: -0.060,
        8: 0.065,
        9: -0.080  // Outer cycle rotates visibly and smoothly
      };

      const positions = {};
      const stretch = 1 + (horizontalVibePct / 100) * 3;

      Object.entries(rings).forEach(([ringKey, ringNodes]) => {
        const ringLevel = Number(ringKey);
        const r = baseRadii[ringLevel] || 500;
        const count = ringNodes.length;
        if (count === 0) return;

        ringNodes.sort((a, b) => (degreeById.get(b.id) || 0) - (degreeById.get(a.id) || 0) || a.id.localeCompare(b.id));
        const startAngle = (ringLevel * Math.PI) / 6;

        ringNodes.forEach((node, idx) => {
          const angle = startAngle + (idx / count) * 2 * Math.PI;
          const actualR = r;

          positions[node.id] = {
            x: Math.round(actualR * stretch * Math.cos(angle)),
            y: Math.round(actualR * Math.sin(angle))
          };

          nodeOrbitInfo.set(node.id, {
            ring: ringLevel,
            baseAngle: angle,
            radius: actualR,
            speedMultiplier: ringSpeeds[ringLevel] || 0.05
          });
        });
      });

      return positions;
    }

    const initialPositions = computeConcentricLayout(graphData.nodes, graphData.edges, 1, 0, 0);

    const visNodes = new vis.DataSet(graphData.nodes.map(n => {
      const degree = degreeById.get(n.id) || 0;
      const isHub = degree >= 8;
      const isUnlinked = degree === 0;
      const isDb = n.group === 'database';
      const isApi = n.group === 'api';
      const baseSize = isDb ? 18 : (isApi ? 11 : 14);
      const baseLabel = isDb ? ('🗄️ ' + n.label) : n.label;
      const baseFontColor = isUnlinked ? '#fecaca' : (isDb ? '#0f172a' : '#ffffff');
      const baseFontSize = isDb ? (isHub ? 11 : 10) : (isHub ? 11 : (isApi ? 8.5 : (degree <= 1 ? 8.5 : 10)));
      const pos = initialPositions[n.id] || { x: 0, y: 0 };
      return {
        id: n.id,
        x: pos.x,
        y: pos.y,
        fixed: false,
        label: baseLabel,
        baseLabel: baseLabel,
        title: n.label + ' — ' + degree + ' connection' + (degree === 1 ? '' : 's'),
        color: {
          background: isUnlinked ? unlinkedColor : (isDb ? '#facc15' : (colorMap[n.group] || '#94a3b8')),
          border: isDb ? '#fef08a' : (isHub ? '#ffffff' : (isUnlinked ? '#fecaca' : '#ffffff')),
          highlight: { background: isDb ? '#fef08a' : '#ffffff', border: colorMap[n.group] || '#38bdf8' }
        },
        font: {
          color: baseFontColor,
          size: baseFontSize,
          face: 'system-ui',
          strokeWidth: isDb ? 0 : 2,
          strokeColor: '#020617',
          align: (isApi || isDb) ? 'center' : 'horizontal'
        },
        margin: isDb ? { top: 4, bottom: 4, left: 8, right: 8 } : (isApi ? { top: 3, bottom: 3, left: 6, right: 6 } : undefined),
        widthConstraint: isApi ? { maximum: 115 } : false,
        shape: (isDb || isApi) ? 'box' : 'dot',
        borderRadius: isDb ? 6 : 4,
        size: baseSize + (isHub ? 4 : 0),
        baseSize: baseSize + (isHub ? 4 : 0),
        baseFontSize: baseFontSize,
        baseFontColor
      };
    }));

    const visEdges = new vis.DataSet(graphData.edges.map((e, idx) => ({
      id: 'e_' + idx,
      from: e.from,
      to: e.to,
      label: e.label || '',
      baseLabel: e.label || '',
      arrows: 'to',
      color: { color: 'rgba(148, 163, 184, 0.18)', highlight: '#38bdf8' },
      font: { color: 'rgba(226, 232, 240, 0.35)', size: 8, align: 'middle' },
      smooth: { type: 'curvedCW', roundness: 0.12 }
    })));

    const container = document.getElementById('network');
    const data = { nodes: visNodes, edges: visEdges };
    const options = {
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -40,
          centralGravity: 0.003,
          springLength: 120,
          springConstant: 0.05,
          damping: 0.88,
          avoidOverlap: 0.95
        },
        maxVelocity: 40,
        minVelocity: 0.1,
        stabilization: {
          enabled: true,
          iterations: 120,
          updateInterval: 25,
          onlyDynamicEdges: false,
          fit: true
        }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        tooltipDelay: 100,
        selectable: true,
        selectConnectedEdges: true
      }
    };

    const network = new window.vis.Network(container, data, options);
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    function setSidebarCollapsed(collapsed) {
      sidebar.classList.toggle('collapsed', collapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      sidebarToggle.textContent = collapsed ? 'Show panel' : 'Hide panel';
      window.requestAnimationFrame(() => {
        network.redraw();
        fitGraph();
      });
    }

    sidebarToggle.addEventListener('click', () => {
      setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
    });

    const uiState = {
      group: 'all',
      term: '',
      nodeScale: 1,
      labelScale: 1,
      selectedNodeId: null,
      edgeOpacity: 0.18,
      edgeLabelMode: 'light',
      innerSpacing: 120,
      outerPull: 0,
      physicsStrength: 1,
      rotationSpeed: 1,
      horizontalVibe: 0,
      motionEnabled: true,
      backgroundColor: '#0b0f19'
    };

    let orbitTime = 0;
    let orbitAnimFrame;
    let activeDragNodeId = null;
    let lastAnimTime = performance.now();
    const legend = document.querySelector('.legend');
    let legendDrag;

    function startLegendDrag(event) {
      if (event.button !== undefined && event.button !== 0) return;
      const legendBox = legend.getBoundingClientRect();
      const containerBox = document.getElementById('graph-container').getBoundingClientRect();
      legendDrag = { offsetX: event.clientX - legendBox.left, offsetY: event.clientY - legendBox.top };
      legend.style.left = (legendBox.left - containerBox.left) + 'px';
      legend.style.top = (legendBox.top - containerBox.top) + 'px';
      legend.style.right = 'auto';
      legend.style.bottom = 'auto';
      legend.classList.add('dragging');
      if (legend.setPointerCapture) {
        try { legend.setPointerCapture(event.pointerId); } catch {}
      }
      event.preventDefault();
    }

    function moveLegendDrag(event) {
      if (!legendDrag) return;
      const containerBox = document.getElementById('graph-container').getBoundingClientRect();
      const maxLeft = Math.max(0, containerBox.width - legend.offsetWidth);
      const maxTop = Math.max(0, containerBox.height - legend.offsetHeight);
      const left = Math.min(maxLeft, Math.max(0, event.clientX - containerBox.left - legendDrag.offsetX));
      const top = Math.min(maxTop, Math.max(0, event.clientY - containerBox.top - legendDrag.offsetY));
      legend.style.left = left + 'px';
      legend.style.top = top + 'px';
    }

    function endLegendDrag(event) {
      if (!legendDrag) return;
      if (legend.releasePointerCapture && event?.pointerId) {
        try { legend.releasePointerCapture(event.pointerId); } catch {}
      }
      legendDrag = undefined;
      legend.classList.remove('dragging');
    }

    legend.addEventListener('pointerdown', startLegendDrag);
    window.addEventListener('pointermove', moveLegendDrag);
    window.addEventListener('pointerup', endLegendDrag);
    window.addEventListener('pointercancel', endLegendDrag);

    // Track user drag on nodes so dragged node is responsive and smoothly resumes orbit from its dropped coordinate
    network.on('dragStart', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        activeDragNodeId = params.nodes[0];
      }
    });

    network.on('dragEnd', (params) => {
      if (activeDragNodeId) {
        const pos = network.getPosition(activeDragNodeId);
        const info = nodeOrbitInfo.get(activeDragNodeId);
        if (info && pos) {
          const angleNow = Math.atan2(pos.y, pos.x);
          info.baseAngle = angleNow - (orbitTime * info.speedMultiplier);
          info.radius = Math.hypot(pos.x, pos.y);
        }
        activeDragNodeId = null;
      }
    });

    function startCosmicOrbit() {
      if (orbitAnimFrame) window.cancelAnimationFrame(orbitAnimFrame);
      lastAnimTime = performance.now();
      const orbitLoop = (now) => {
        const dt = Math.min(0.1, (now - lastAnimTime) / 1000);
        lastAnimTime = now;
        if (uiState.motionEnabled && uiState.rotationSpeed > 0 && !uiState.selectedNodeId) {
          orbitTime += dt * uiState.rotationSpeed;
          const stretch = 1 + (uiState.horizontalVibe / 100) * 3;
          nodeOrbitInfo.forEach((info, id) => {
            if (id === activeDragNodeId) return;
            const currentAngle = info.baseAngle + orbitTime * info.speedMultiplier;
            const r = info.radius;
            const x = Math.round(r * stretch * Math.cos(currentAngle));
            const y = Math.round(r * Math.sin(currentAngle));
            network.moveNode(id, x, y);
          });
        }
        orbitAnimFrame = window.requestAnimationFrame(orbitLoop);
      };
      orbitAnimFrame = window.requestAnimationFrame(orbitLoop);
    }

    startCosmicOrbit();

    function applyConcentricLayout(repositionAll = true) {
      const spacingMultiplier = uiState.innerSpacing / 120;
      computeConcentricLayout(
        graphData.nodes,
        graphData.edges,
        spacingMultiplier,
        uiState.outerPull,
        uiState.horizontalVibe
      );

      if (repositionAll) {
        const stretch = 1 + (uiState.horizontalVibe / 100) * 3;
        nodeOrbitInfo.forEach((info, id) => {
          const currentAngle = info.baseAngle + orbitTime * info.speedMultiplier;
          const x = Math.round(info.radius * stretch * Math.cos(currentAngle));
          const y = Math.round(info.radius * Math.sin(currentAngle));
          network.moveNode(id, x, y);
        });
      }
    }

    function matchingNodeIds() {
      return new Set(graphData.nodes.filter(node => {
        const matchesGroup = uiState.group === 'all' || node.group === uiState.group;
        const searchableText = [node.label, node.id, node.file, node.type].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = !uiState.term || searchableText.includes(uiState.term);
        return matchesGroup && matchesSearch;
      }).map(node => node.id));
    }

    function updateGraphVisibility() {
      const visibleNodeIds = matchingNodeIds();
      visNodes.forEach(node => visNodes.update({ id: node.id, hidden: !visibleNodeIds.has(node.id) }));
      visEdges.forEach(edge => visEdges.update({
        id: edge.id,
        hidden: !visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)
      }));
      updateLabelVisibility();
      const visibleLinkedNodes = [...visibleNodeIds].filter(id => (degreeById.get(id) || 0) > 0).length;
      document.getElementById('graphStatus').textContent = 'Showing ' + visibleNodeIds.size + ' of ' + graphData.nodes.length + ' nodes • ' + visibleLinkedNodes + ' linked • ' + (visibleNodeIds.size - visibleLinkedNodes) + ' unlinked evidence';
    }

    function updateNodeScale() {
      visNodes.forEach(node => visNodes.update({ id: node.id, size: Math.round(node.baseSize * uiState.nodeScale) }));
    }

    function updateLabelScale() {
      visNodes.forEach(node => visNodes.update({
        id: node.id,
        font: { ...node.font, size: Math.round(node.baseFontSize * uiState.labelScale) }
      }));
    }

    function updateLabelVisibility() {
      visNodes.forEach(node => {
        visNodes.update({
          id: node.id,
          label: node.baseLabel,
          font: { ...node.font, color: node.baseFontColor, size: Math.round(node.baseFontSize * uiState.labelScale) }
        });
      });
    }

    function setDiagramBackground(color) {
      uiState.backgroundColor = color;
      document.documentElement.style.setProperty('--bg-color', color);
      document.getElementById('graph-container').style.backgroundColor = color;
      container.style.backgroundColor = color;
      updateEdgeAppearance();
    }

    async function exportFullDiagram() {
      const exportButton = document.getElementById('exportGraph');
      const view = { position: network.getViewPosition(), scale: network.getScale() };
      exportButton.disabled = true;
      exportButton.textContent = 'Preparing PNG…';
      let exportNetwork;
      let exportHost;
      try {
        const visibleNodes = visNodes.get().filter(node => !node.hidden);
        const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
        const visibleEdges = visEdges.get().filter(edge => !edge.hidden && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));
        const bounds = visibleNodes.map(node => network.getBoundingBox(node.id)).reduce((total, box) => ({
          left: Math.min(total.left, box.left),
          right: Math.max(total.right, box.right),
          top: Math.min(total.top, box.top),
          bottom: Math.max(total.bottom, box.bottom)
        }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
        const graphWidth = Math.max(100, bounds.right - bounds.left);
        const graphHeight = Math.max(100, bounds.bottom - bounds.top);
        const padding = 96;
        const maximumDimension = 4096;
        const currentZoomAtDoubleResolution = Math.max(0.5, view.scale * 2);
        const scaleCap = Math.min(
          (maximumDimension - padding * 2) / graphWidth,
          (maximumDimension - padding * 2) / graphHeight
        );
        const exportScale = Math.min(currentZoomAtDoubleResolution, scaleCap);
        const exportWidth = Math.ceil(graphWidth * exportScale + padding * 2);
        const exportHeight = Math.ceil(graphHeight * exportScale + padding * 2);
        const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
        const positions = network.getPositions(visibleNodes.map(node => node.id));

        exportHost = document.createElement('div');
        exportHost.style.cssText = 'position:fixed;left:-100000px;top:0;width:' + exportWidth + 'px;height:' + exportHeight + 'px;background:' + uiState.backgroundColor + ';';
        document.body.appendChild(exportHost);
        const exportNodes = new window.vis.DataSet(visibleNodes.map((node) => ({
          ...node,
          x: positions[node.id]?.x || 0,
          y: positions[node.id]?.y || 0,
          fixed: { x: true, y: true }
        })));
        const exportEdges = new window.vis.DataSet(visibleEdges);
        exportNetwork = new window.vis.Network(exportHost, { nodes: exportNodes, edges: exportEdges }, {
          physics: false,
          interaction: { hover: false, zoomView: false, dragView: false }
        });
        exportNetwork.moveTo({ position: center, scale: exportScale, animation: false });
        await new Promise(resolve => {
          let frames = 0;
          const waitDraw = () => {
            frames++;
            if (frames > 3) resolve();
            else window.requestAnimationFrame(waitDraw);
          };
          window.requestAnimationFrame(waitDraw);
        });

        const sourceCanvas = exportHost.querySelector('canvas');
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = sourceCanvas.width;
        exportCanvas.height = sourceCanvas.height;
        const context = exportCanvas.getContext('2d');
        context.fillStyle = uiState.backgroundColor;
        context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        context.drawImage(sourceCanvas, 0, 0);
        const imageBlob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'));
        const download = document.createElement('a');
        const objectUrl = URL.createObjectURL(imageBlob);
        download.href = objectUrl;
        download.download = 'luxora-knowledge-graph-full.png';
        download.style.display = 'none';
        document.body.appendChild(download);
        download.click();
        download.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } finally {
        exportNetwork?.destroy();
        exportHost?.remove();
        exportButton.disabled = false;
        exportButton.textContent = 'Download full diagram PNG';
      }
    }

    function updateEdgeAppearance() {
      visEdges.forEach(edge => {
        const isSelectedEdge = uiState.selectedNodeId && (edge.from === uiState.selectedNodeId || edge.to === uiState.selectedNodeId);
        const labelColor = uiState.edgeLabelMode === 'always'
          ? '#e2e8f0'
          : (uiState.edgeLabelMode === 'selected' && isSelectedEdge
            ? '#e2e8f0'
            : (uiState.edgeLabelMode === 'light' ? 'rgba(226, 232, 240, 0.38)' : 'rgba(148, 163, 184, 0)'));
        const labelsOff = uiState.edgeLabelMode === 'none';
        visEdges.update({
          id: edge.id,
          label: labelsOff ? '' : edge.baseLabel,
          color: { color: 'rgba(148, 163, 184, ' + uiState.edgeOpacity + ')', highlight: '#38bdf8' },
          font: { color: labelColor, size: 8, align: 'middle', strokeWidth: labelsOff ? 0 : 2, strokeColor: labelsOff ? 'rgba(0,0,0,0)' : uiState.backgroundColor }
        });
      });
    }

    function fitGraph() {
      const isMobile = window.innerWidth <= 760;
      const isCollapsed = sidebar.classList.contains('collapsed');
      const offsetX = isMobile ? 0 : (isCollapsed ? -50 : -90);
      network.fit({
        animation: { duration: 350, easingFunction: 'easeInOutQuad' },
        offset: { x: offsetX, y: 0 }
      });
    }

    function selectAndFocusNode(nodeId) {
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (!node) return;
      uiState.selectedNodeId = nodeId;
      network.selectNodes([nodeId]);
      network.focus(nodeId, {
        scale: 1.3,
        animation: { duration: 400, easingFunction: 'easeInOutQuad' }
      });
      renderNodeDetails(node);
      updateLabelVisibility();
      updateEdgeAppearance();
    }

    function renderNodeDetails(node) {
      const inbound = graphData.edges.filter(e => e.to === node.id);
      const outbound = graphData.edges.filter(e => e.from === node.id);

      let html = \`
        <h2 style="color: #fff; font-size: 1.05rem; margin-bottom: 8px; word-break: break-word;">\${node.label}</h2>
        <div style="margin-bottom: 12px;">
          <span class="stat-badge" style="background: \${colorMap[node.group] || '#64748b'}; color: #000;">\${node.type}</span>
          <span class="stat-badge" style="background: #1e293b; color: #94a3b8;">\${node.group}</span>
          <span class="stat-badge" style="background: #0f172a; color: #cbd5e1;">\${degreeById.get(node.id) || 0} connections</span>
        </div>
        
        <div style="margin-bottom: 14px;">
          <div style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">File Location</div>
          \${node.file && graphData.sourceRepository ? '<a class="code-tag" target="_blank" rel="noopener noreferrer" href="https://github.com/' + graphData.sourceRepository.repository + '/blob/' + graphData.sourceRepository.branch + '/' + encodeURIComponent(node.file).replace(/%2F/g, '/') + '">' + node.file + '</a>' : '<div class="code-tag">' + (node.file || 'Dynamic / In-Memory') + '</div>'}
        </div>

        <div style="margin-bottom: 14px;">
          <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; display:flex; align-items:center;">
            💥 Upstream Callers (\${inbound.length})
          </div>
          \${inbound.length === 0 ? '<p style="color:#64748b; font-size:0.78rem;">None (Root Entry)</p>' : \`
            <div class="conn-list">
              \${inbound.map(e => \`
                <div class="conn-item" data-node-id="\${e.from}" title="Click to inspect caller">
                  <span class="clickable-node" style="max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${e.from}</span>
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
                <div class="conn-item" data-node-id="\${e.to}" title="Click to inspect target">
                  <span class="clickable-node" style="color:#34d399; max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${e.to}</span>
                  <span style="color:#64748b; font-size:0.7rem;">\${e.type}</span>
                </div>
              \`).join('')}
            </div>
          \`}
        </div>
      \`;

      const detailsPanel = document.getElementById('details-panel');
      detailsPanel.innerHTML = html;
      detailsPanel.querySelectorAll('.conn-item').forEach(item => {
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const targetId = item.dataset.nodeId;
          if (targetId) selectAndFocusNode(targetId);
        });
      });
    }

    function resetNodeInspector() {
      uiState.selectedNodeId = null;
      document.getElementById('details-panel').innerHTML = \`
        <h3 style="color: #94a3b8; font-size: 0.88rem; margin-bottom: 10px;">🔍 Node Inspector</h3>
        <p style="color: #64748b; line-height: 1.5;">Click on any node in the interactive graph to analyze its file path, API routes, database models, and impact blast radius.</p>
      \`;
      updateLabelVisibility();
      updateEdgeAppearance();
    }

    function resetGraph() {
      uiState.group = 'all';
      uiState.term = '';
      uiState.nodeScale = 1;
      uiState.labelScale = 1;
      uiState.selectedNodeId = null;
      uiState.edgeOpacity = 0.5;
      uiState.edgeLabelMode = 'light';
      uiState.innerSpacing = 120;
      uiState.outerPull = 0;
      uiState.physicsStrength = 1;
      uiState.rotationSpeed = 1;
      uiState.horizontalVibe = 0;
      uiState.motionEnabled = true;
      orbitAngle = 0;
      setDiagramBackground('#0b0f19');
      legend.style.left = '';
      legend.style.top = '';
      legend.style.right = '';
      legend.style.bottom = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('searchClear').style.display = 'none';
      document.getElementById('nodeScale').value = '100';
      document.getElementById('nodeScaleValue').textContent = '100%';
      document.getElementById('labelScale').value = '100';
      document.getElementById('labelScaleValue').textContent = '100%';
      document.getElementById('edgeOpacity').value = '50';
      document.getElementById('edgeOpacityValue').textContent = '50%';
      document.getElementById('innerSpacing').value = '120';
      document.getElementById('innerSpacingValue').textContent = '120 px';
      document.getElementById('outerPull').value = '0';
      document.getElementById('outerPullValue').textContent = '0';
      document.getElementById('physicsStrength').value = '100';
      document.getElementById('physicsStrengthValue').textContent = '100%';
      document.getElementById('rotationSpeed').value = '100';
      document.getElementById('rotationSpeedValue').textContent = '100%';
      document.getElementById('horizontalVibe').value = '0';
      document.getElementById('horizontalVibeValue').textContent = '0%';
      document.getElementById('edgeLabelMode').value = 'light';
      document.getElementById('motionToggle').checked = true;
      document.getElementById('backgroundColor').value = '#0b0f19';
      document.querySelectorAll('.filter-btn').forEach(button => button.classList.toggle('active', button.dataset.group === 'all'));
      resetNodeInspector();
      updateGraphVisibility();
      updateNodeScale();
      updateLabelScale();
      updateLabelVisibility();
      updateEdgeAppearance();
      applyConcentricLayout(true);
      fitGraph();
    }

    // Node Selection & Detailed Inspector
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (!node) return;
        uiState.selectedNodeId = nodeId;
        renderNodeDetails(node);
        updateLabelVisibility();
        updateEdgeAppearance();
      } else if (uiState.selectedNodeId) {
        resetNodeInspector();
      }
    });

    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        selectAndFocusNode(params.nodes[0]);
      } else {
        fitGraph();
      }
    });

    // Search filter
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    function applySearch() {
      uiState.term = searchInput.value.toLowerCase().trim();
      searchClear.style.display = uiState.term ? 'block' : 'none';
      updateGraphVisibility();
    }

    searchInput.addEventListener('input', applySearch);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const visibleIds = [...matchingNodeIds()];
        if (visibleIds.length > 0) {
          selectAndFocusNode(visibleIds[0]);
        }
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        applySearch();
      }
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      applySearch();
      searchInput.focus();
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

    document.getElementById('motionToggle').addEventListener('change', (event) => {
      uiState.motionEnabled = event.target.checked;
      network.setOptions({ physics: { enabled: event.target.checked } });
    });

    document.getElementById('edgeLabelMode').addEventListener('change', (event) => {
      uiState.edgeLabelMode = event.target.value;
      updateLabelVisibility();
      updateEdgeAppearance();
    });

    document.getElementById('nodeScale').addEventListener('input', (event) => {
      uiState.nodeScale = Number(event.target.value) / 100;
      document.getElementById('nodeScaleValue').textContent = event.target.value + '%';
      updateNodeScale();
    });

    document.getElementById('labelScale').addEventListener('input', (event) => {
      uiState.labelScale = Number(event.target.value) / 100;
      document.getElementById('labelScaleValue').textContent = event.target.value + '%';
      updateLabelScale();
    });

    document.getElementById('edgeOpacity').addEventListener('input', (event) => {
      uiState.edgeOpacity = Number(event.target.value) / 100;
      document.getElementById('edgeOpacityValue').textContent = event.target.value + '%';
      updateEdgeAppearance();
    });

    document.getElementById('innerSpacing').addEventListener('input', (event) => {
      uiState.innerSpacing = Number(event.target.value);
      document.getElementById('innerSpacingValue').textContent = event.target.value + ' px';
      applyConcentricLayout(false);
    });

    document.getElementById('outerPull').addEventListener('input', (event) => {
      uiState.outerPull = Number(event.target.value);
      document.getElementById('outerPullValue').textContent = String(uiState.outerPull);
      applyConcentricLayout(false);
    });

    document.getElementById('physicsStrength').addEventListener('input', (event) => {
      uiState.physicsStrength = Number(event.target.value) / 100;
      document.getElementById('physicsStrengthValue').textContent = event.target.value + '%';
      applyConcentricLayout(false);
    });

    document.getElementById('rotationSpeed').addEventListener('input', (event) => {
      uiState.rotationSpeed = Number(event.target.value) / 100;
      document.getElementById('rotationSpeedValue').textContent = event.target.value + '%';
    });

    document.getElementById('horizontalVibe').addEventListener('input', (event) => {
      uiState.horizontalVibe = Number(event.target.value);
      document.getElementById('horizontalVibeValue').textContent = uiState.horizontalVibe + '%';
      applyConcentricLayout(true);
    });

    document.getElementById('backgroundColor').addEventListener('input', (event) => {
      setDiagramBackground(event.target.value);
    });

    document.getElementById('fitGraph').addEventListener('click', fitGraph);
    document.getElementById('resetGraph').addEventListener('click', resetGraph);
    document.getElementById('exportGraph').addEventListener('click', exportFullDiagram);

    updateGraphVisibility();
    updateEdgeAppearance();
    updateLabelVisibility();
    setDiagramBackground(uiState.backgroundColor);
    fitGraph();
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
