/**
 * Strict Validator for Luxora Live System Architecture Graph
 * 
 * Verifies graph structural integrity, node/edge consistency, source file existence,
 * 12-view completeness, and offline asset bundling.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const jsonPath = path.join(__dirname, 'architecture-graph.json');
const htmlPath = path.join(__dirname, 'architecture.html');
const visPath = path.join(__dirname, 'vis-network.min.js');

const failures = [];
function fail(msg) { failures.push(msg); }

console.log('🔍 Validating Luxora Live Architecture Graph...');

if (!fs.existsSync(jsonPath)) fail('architecture-graph.json is missing');
if (!fs.existsSync(htmlPath)) fail('architecture.html is missing');
if (!fs.existsSync(visPath)) fail('bundled vis-network.min.js is missing');

let graph;
try {
  graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (err) {
  fail(`architecture-graph.json is not valid JSON: ${err.message}`);
}

if (graph) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    fail('Graph must contain nodes and edges arrays');
  }

  const nodeIds = new Set();
  const edgeIds = new Set();

  // Validate Nodes
  for (const node of graph.nodes || []) {
    if (!node?.id) {
      fail('A node is missing a stable id');
      continue;
    }
    if (nodeIds.has(node.id)) {
      fail(`Duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);

    if (!node.label) fail(`Node ${node.id} is missing a label`);
    if (!node.layer) fail(`Node ${node.id} is missing an architectural layer`);
    if (!Array.isArray(node.views) || node.views.length === 0) {
      fail(`Node ${node.id} is not assigned to any architectural view`);
    }

    if (node.file) {
      const absPath = path.resolve(rootDir, node.file);
      if (!fs.existsSync(absPath)) {
        fail(`Node ${node.id} references non-existent repository file: ${node.file}`);
      }
    }
  }

  // Validate Edges
  for (const edge of graph.edges || []) {
    if (!edge?.id) {
      fail('An edge is missing a stable id');
      continue;
    }
    if (edgeIds.has(edge.id)) {
      fail(`Duplicate edge id: ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.from)) {
      fail(`Edge ${edge.id} references missing 'from' node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      fail(`Edge ${edge.id} references missing 'to' node: ${edge.to}`);
    }
    if (!Array.isArray(edge.views) || edge.views.length === 0) {
      fail(`Edge ${edge.id} is not assigned to any architectural view`);
    }
    if (!edge.description) {
      fail(`Edge ${edge.id} is missing an architectural relationship description`);
    }
  }

  // Validate 12 Views
  const requiredViews = [
    'system', 'frontend', 'backend', 'database', 'booking',
    'realtime', 'payments', 'email', 'cicd', 'deployment', 'kg', 'security'
  ];

  if (!Array.isArray(graph.views) || graph.views.length < 12) {
    fail(`Expected at least 12 architectural views, found ${graph.views?.length || 0}`);
  }

  const definedViewIds = new Set((graph.views || []).map((v) => v.id));
  for (const required of requiredViews) {
    if (!definedViewIds.has(required)) {
      fail(`Required architectural view missing from view definitions: ${required}`);
    }

    const viewNodes = (graph.nodes || []).filter((n) => n.views && n.views.includes(required));
    const viewNodeIds = new Set(viewNodes.map((n) => n.id));
    const viewEdges = (graph.edges || []).filter((e) => viewNodeIds.has(e.from) && viewNodeIds.has(e.to));

    if (viewNodes.length < 3) {
      fail(`View '${required}' has only ${viewNodes.length} nodes (minimum 3 required)`);
    }
    if (viewEdges.length < 2) {
      fail(`View '${required}' has only ${viewEdges.length} connections (minimum 2 required)`);
    }
  }

  // Validate Stats
  if (graph.stats?.totalNodes !== graph.nodes?.length) {
    fail(`stats.totalNodes (${graph.stats?.totalNodes}) does not match nodes array length (${graph.nodes?.length})`);
  }
  if (graph.stats?.totalEdges !== graph.edges?.length) {
    fail(`stats.totalEdges (${graph.stats?.totalEdges}) does not match edges array length (${graph.edges?.length})`);
  }

  // Assert Determinism: No non-deterministic timestamps
  if ('generatedAt' in graph) {
    fail('architecture-graph.json must not contain a non-deterministic generatedAt timestamp');
  }

  // Secret Scanning
  const serialized = JSON.stringify(graph);
  const secretPattern = /(postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,})/i;
  if (secretPattern.test(serialized)) {
    fail('Generated architecture graph appears to expose a secret or credential');
  }
}

// Validate HTML Explorers
const subdirHtmlPath = path.join(__dirname, 'architecture', 'index.html');
if (!fs.existsSync(subdirHtmlPath)) {
  fail('architecture/index.html is missing');
} else {
  const subHtml = fs.readFileSync(subdirHtmlPath, 'utf8');
  if (!subHtml.includes("fetch('../architecture-graph.json'")) {
    fail('architecture/index.html must load graph JSON via relative path ../architecture-graph.json');
  }
  if (!subHtml.includes('src="../vis-network.min.js"')) {
    fail('architecture/index.html must load bundled ../vis-network.min.js via relative path');
  }
  if (/unpkg\.com|cdn\.|cdnjs\./i.test(subHtml)) {
    fail('architecture/index.html must not depend on an external graph-renderer CDN');
  }
  if (/C:\\Users\\|file:\/\//i.test(subHtml)) {
    fail('architecture/index.html contains hardcoded local filesystem paths');
  }
}

if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes("fetch('./architecture-graph.json'")) {
    fail('architecture.html must load graph JSON via relative path ./architecture-graph.json');
  }
  if (!html.includes('src="./vis-network.min.js"')) {
    fail('architecture.html must load bundled ./vis-network.min.js via relative path');
  }
  if (/unpkg\.com|cdn\.|cdnjs\./i.test(html)) {
    fail('architecture.html must not depend on an external graph-renderer CDN');
  }
  if (/C:\\Users\\|file:\/\//i.test(html)) {
    fail('architecture.html contains hardcoded local filesystem paths');
  }
}

if (failures.length) {
  console.error('\n❌ Architecture Graph Validation Failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`✅ Architecture Graph Validation Passed! (${graph.nodes.length} nodes, ${graph.edges.length} edges across 12 views)`);
