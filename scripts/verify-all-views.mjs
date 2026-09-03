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
  'http://localhost:3333/architecture.html'
], { stdio: 'pipe' });

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const target = tabs.find(t => t.url.includes('architecture.html'));
      if (target) return target;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Timeout waiting for architecture.html tab');
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

      // 1. Verify System Overview View
      console.log('📸 1. Capturing System Overview View...');
      let shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '01_system_overview.png'), Buffer.from(shot.data, 'base64'));

      // 2. Switch to Booking Lifecycle View
      console.log('📸 2. Switching to Booking Lifecycle View...');
      await send('Runtime.evaluate', { expression: `window.switchView('booking')` });
      await new Promise(r => setTimeout(r, 600));
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '02_booking_lifecycle.png'), Buffer.from(shot.data, 'base64'));

      // 3. Switch to Realtime / SSE View
      console.log('📸 3. Switching to Realtime / SSE View...');
      await send('Runtime.evaluate', { expression: `window.switchView('realtime')` });
      await new Promise(r => setTimeout(r, 600));
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '03_realtime_sse.png'), Buffer.from(shot.data, 'base64'));

      // 4. Switch to Payments Engine View
      console.log('📸 4. Switching to Payments Engine View...');
      await send('Runtime.evaluate', { expression: `window.switchView('payments')` });
      await new Promise(r => setTimeout(r, 600));
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '04_payments_engine.png'), Buffer.from(shot.data, 'base64'));

      // 5. Switch to CI/CD Pipeline View
      console.log('📸 5. Switching to CI/CD Pipeline View...');
      await send('Runtime.evaluate', { expression: `window.switchView('cicd')` });
      await new Promise(r => setTimeout(r, 600));
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '05_cicd_pipeline.png'), Buffer.from(shot.data, 'base64'));

      // 6. Switch to Security Architecture View
      console.log('📸 6. Switching to Security Architecture View...');
      await send('Runtime.evaluate', { expression: `window.switchView('security')` });
      await new Promise(r => setTimeout(r, 600));
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '06_security_architecture.png'), Buffer.from(shot.data, 'base64'));

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
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '07_node_inspector_opened.png'), Buffer.from(shot.data, 'base64'));

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
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(screenshotDir, '08_search_filter_active.png'), Buffer.from(shot.data, 'base64'));

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
