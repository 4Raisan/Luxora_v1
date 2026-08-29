/**
 * Validates the generated Luxora Knowledge Graph before it is published.
 * The validator only reads repository files and never loads environment values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphDir = path.join(rootDir, 'Knowladge-Graph');
const graphPath = path.join(graphDir, 'knowledge-graph.json');
const explorerPath = path.join(graphDir, 'index.html');
const rendererPath = path.join(graphDir, 'vis-network.min.js');
const failures = [];

function fail(message) { failures.push(message); }
function isRepositoryPath(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.includes('..') && !/^[A-Za-z]:[\\/]/.test(value);
}
function checkSourcePath(value, context) {
  if (!value) return;
  if (!isRepositoryPath(value)) return fail(`${context} has a non-repository source path: ${value}`);
  if (!fs.existsSync(path.resolve(rootDir, value))) fail(`${context} references a missing source file: ${value}`);
}

if (!fs.existsSync(graphPath)) fail('knowledge-graph.json is missing');
if (!fs.existsSync(explorerPath)) fail('index.html is missing');
if (!fs.existsSync(rendererPath)) fail('bundled graph renderer is missing');

let graph;
try {
  graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
} catch (error) {
  fail(`knowledge-graph.json is not valid JSON: ${error.message}`);
}

if (graph) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) fail('graph must contain nodes and edges arrays');
  const nodeIds = new Set();
  const edgeIds = new Set();
  for (const node of graph.nodes || []) {
    if (!node?.id) fail('a node is missing a stable id');
    else if (nodeIds.has(node.id)) fail(`duplicate node id: ${node.id}`);
    else nodeIds.add(node.id);
    checkSourcePath(node?.file, `node ${node?.id || '<unknown>'}`);
    checkSourcePath(node?.source?.path, `node ${node?.id || '<unknown>'}`);
  }
  for (const edge of graph.edges || []) {
    if (!edge?.id) fail('an edge is missing a stable id');
    else if (edgeIds.has(edge.id)) fail(`duplicate edge id: ${edge.id}`);
    else edgeIds.add(edge.id);
    if (!nodeIds.has(edge?.from) || !nodeIds.has(edge?.to)) fail(`edge ${edge?.id || '<unknown>'} has a broken node reference`);
    checkSourcePath(edge?.evidence?.path, `edge ${edge?.id || '<unknown>'}`);
  }
  if (graph.stats?.totalNodes !== graph.nodes?.length) fail('stats.totalNodes does not match the node list');
  if (graph.stats?.totalEdges !== graph.edges?.length) fail('stats.totalEdges does not match the edge list');
  if ('generatedAt' in graph) fail('graph must not contain a non-deterministic generatedAt timestamp');

  const staleFeaturePattern = /(sms|telegram|whatsapp.*otp|phone[_ -]?otp)/i;
  const staleNodes = (graph.nodes || []).filter((node) => staleFeaturePattern.test(JSON.stringify(node)));
  if (staleNodes.length) fail(`graph contains removed OTP or messaging functionality: ${staleNodes.map((node) => node.id).join(', ')}`);

  const serialized = JSON.stringify(graph);
  const secretValuePattern = /(postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,})/i;
  if (secretValuePattern.test(serialized)) fail('generated graph appears to contain a secret value');
}

if (fs.existsSync(explorerPath)) {
  const explorer = fs.readFileSync(explorerPath, 'utf8');
  if (!explorer.includes("fetch('./knowledge-graph.json'")) fail('explorer must load graph JSON via a GitHub Pages-safe relative path');
  if (!explorer.includes('src="./vis-network.min.js"')) fail('explorer must load the bundled graph renderer via a relative path');
  if (/unpkg\.com|cdn\./i.test(explorer)) fail('explorer must not depend on an external graph-renderer CDN');
  if (/C:\\Users\\|file:\/\//i.test(explorer)) fail('explorer contains a local filesystem path');
  if (!explorer.includes('github.com/')) fail('explorer does not provide GitHub source links');
}

if (failures.length) {
  console.error('Knowledge Graph validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Knowledge Graph validation passed (${graph.nodes.length} nodes, ${graph.edges.length} edges).`);
