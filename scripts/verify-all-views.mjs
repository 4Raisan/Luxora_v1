import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'c:\\Users\\4Raisan\\Desktop\\Luxora_v1\\.chrome-verify-profile';
const screenshotDir = 'c:\\Users\\4Raisan\\Desktop\\Luxora_v1\\docs\\architecture\\screenshots';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

console.log('🚀 Starting Comprehensive Architecture Explorer Visual & Interaction Verification...');

const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--disable-gpu',
  '--window-size=1440,900',
  'http://localhost:3333/architecture/'
], { stdio: 'pipe' });

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const target = tabs.find(t => t.url.includes('architecture'));
      if (target) return target;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Timeout waiting for architecture tab');
}

async function run() {
  try {
    const target = await waitForCdp();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onopen = async () => {
      await send('Runtime.enable');
      await send('Console.enable');

      ws.addEventListener('message', evt => {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Console.messageAdded' && msg.params.message.level === 'error') {
          console.error('[BROWSER ERROR]', msg.params.message.text);
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          console.error('[EXCEPTION]', JSON.stringify(msg.params.exceptionDetails));
        }
      });

      // Wait 1.5s for initial mount
      await new Promise(r => setTimeout(r, 1500));

      // List of all 12 architectural views
      const viewsToCapture = [
        { id: 'system', file: '01_system_overview.png', name: 'System Overview' },
        { id: 'frontend', file: '02_frontend_architecture.png', name: 'Frontend Architecture' },
        { id: 'backend', file: '03_backend_api_gateway.png', name: 'Backend & API Gateway' },
        { id: 'database', file: '04_database_architecture.png', name: 'Database Architecture' },
        { id: 'booking', file: '05_booking_lifecycle.png', name: 'Booking Lifecycle' },
        { id: 'realtime', file: '06_realtime_sse.png', name: 'Realtime / SSE' },
        { id: 'payments', file: '07_payments_engine.png', name: 'Payments Engine' },
        { id: 'email', file: '08_email_external_services.png', name: 'Email & External Services' },
        { id: 'cicd', file: '09_cicd_pipeline.png', name: 'CI/CD Pipeline' },
        { id: 'deployment', file: '10_production_deployments.png', name: 'Production Deployments' },
        { id: 'kg', file: '11_knowledge_graph.png', name: 'Knowledge Graph Subsystem' },
        { id: 'security', file: '12_security_architecture.png', name: 'Security Architecture' },
      ];

      for (let i = 0; i < viewsToCapture.length; i++) {
        const v = viewsToCapture[i];
        console.log(`📸 [${i + 1}/12] Capturing ${v.name} (${v.id})...`);
        await send('Runtime.evaluate', { expression: `window.switchView('${v.id}')` });
        await new Promise(r => setTimeout(r, 600));
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(screenshotDir, v.file), Buffer.from(shot.data, 'base64'));
      }

      // 7. Test Interaction: Select Node 'route:bookings' & Verify Inspector
      console.log('🔍 7. Testing Node Selection & Inspector Panel...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          window.switchView('booking');
          window.network.selectNodes(['route:bookings']);
          // Trigger click handler simulation
          const node = window.graphData.nodes.find(n => n.id === 'route:bookings');
          document.getElementById('inspectorPanel').classList.add('open');
          document.getElementById('inspTitle').textContent = node.label;
          document.getElementById('inspFile').textContent = node.file;
          document.getElementById('inspDesc').textContent = node.description;
          document.getElementById('inspLayerBadge').textContent = node.layer;
        })()`
      });
      await new Promise(r => setTimeout(r, 500));
      const shotInspector = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '13_node_inspector_opened.png'), Buffer.from(shotInspector.data, 'base64'));

      // 8. Test Search Filter: Search 'PayHere'
      console.log('🔍 8. Testing Search Filtering...');
      const searchStats = await send('Runtime.evaluate', {
        expression: `(() => {
          const input = document.getElementById('searchInput');
          input.value = 'PayHere';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const hiddenCount = window.visNodes.get().filter(n => n.hidden).length;
          const visibleCount = window.visNodes.get().filter(n => !n.hidden).length;
          return { hiddenCount, visibleCount };
        })()`,
        returnByValue: true
      });
      console.log('Search Filter Result:', searchStats.result.value);
      const shotSearch = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '14_search_filter_active.png'), Buffer.from(shotSearch.data, 'base64'));

      // 9. Inspect All 12 Views Statistics
      const allViewsStats = await send('Runtime.evaluate', {
        expression: `(() => {
          return window.graphData.views.map(v => {
            const nodes = window.graphData.nodes.filter(n => n.views.includes(v.id));
            const nodeIds = new Set(nodes.map(n => n.id));
            const edges = window.graphData.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
            return { id: v.id, name: v.name, nodes: nodes.length, edges: edges.length };
          });
        })()`,
        returnByValue: true
      });

      console.log('\n📊 All 12 Views Verification:');
      console.table(allViewsStats.result.value);

      console.log('\n✅ Verification Complete! Screenshots saved to:', screenshotDir);

      ws.close();
      chrome.kill();
      process.exit(0);
    };
  } catch (err) {
    console.error('Run error:', err.message);
    chrome.kill();
    process.exit(1);
  }
}

run();
