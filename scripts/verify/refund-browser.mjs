// V2 Slice 4 — real-browser render verification via Chrome DevTools Protocol.
// Launches headless Chrome, logs the seeded customer in through the real login
// API from within the SPA, opens the dashboard Subscription Plans tab (where
// the refund UI lives), and verifies: history rows, status badges, request
// modal prefill, cancel action, and the previously-crashing refundsLoading path.
//
// Required environment (values must match the locally seeded database —
// no defaults are provided, and real credentials never belong in source):
//   LUXORA_TEST_CUSTOMER_EMAIL / LUXORA_TEST_CUSTOMER_PASSWORD
// Optional: LUXORA_CHROME (Chrome executable path)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error('Set LUXORA_TEST_CUSTOMER_EMAIL and LUXORA_TEST_CUSTOMER_PASSWORD to the local seed account values.');
    process.exit(1);
  }
  return value;
};
const TEST_CUSTOMER_EMAIL = requiredEnv('LUXORA_TEST_CUSTOMER_EMAIL');
const TEST_CUSTOMER_PASSWORD = requiredEnv('LUXORA_TEST_CUSTOMER_PASSWORD');

const CHROME = process.env.LUXORA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND = 'http://localhost:3000';
const API = 'http://localhost:5000/api';
const PORT = 9223;
const OUT = join(tmpdir(), 'luxora-verify-shots');
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'luxora-cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getDebuggerUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome devtools endpoint did not come up');
}

const wsUrl = await getDebuggerUrl();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const res = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(res.exceptionDetails).slice(0, 400));
  return res.result?.value;
};

const shot = async (name) => {
  const res = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(res.data, 'base64'));
  console.log(`screenshot: ${name}`);
};

const nav = async (url) => {
  await cdp('Page.navigate', { url });
  await sleep(2500); // SPA + data fetch settle
};

const waitForText = async (text, tries = 30) => {
  const needle = text.toLowerCase();
  for (let i = 0; i < tries; i += 1) {
    const found = await evaluate(`document.body ? document.body.innerText.toLowerCase().includes(${JSON.stringify(needle)}) : false`);
    if (found) return true;
    await sleep(500);
  }
  return false;
};

const clickByText = async (selector, text) => evaluate(`
  (() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((n) => n.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return false;
    el.click();
    return true;
  })()
`);

await cdp('Page.enable');
await cdp('Runtime.enable');

// 1. Login through the real API from the SPA origin, store the session.
await nav(`${FRONTEND}/login`);
const loggedIn = await evaluate(`
  (async () => {
    const res = await fetch('${API}/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ${JSON.stringify(TEST_CUSTOMER_EMAIL)}, password: ${JSON.stringify(TEST_CUSTOMER_PASSWORD)} }),
    });
    const data = await res.json();
    if (!data.token) return { ok: false, status: res.status };
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    return { ok: true, name: data.user.name, role: data.user.role };
  })()
`);
console.log('login via API in page:', JSON.stringify(loggedIn));
if (!loggedIn.ok) throw new Error('in-page login failed');

// 2. Dashboard as an authenticated customer.
await nav(`${FRONTEND}/customer-dashboard`);
if (!await waitForText('ACTIVE PACKAGES')) {
  const diag = await evaluate(`JSON.stringify({ path: location.pathname, body: document.body ? document.body.innerText.slice(0, 300) : 'NO BODY' })`);
  console.log('diagnostics:', diag);
  throw new Error('dashboard did not render');
}
console.log('dashboard rendered');

// 3. Refunds live on the "Subscription Plans" tab (payments table + My Refunds).
await clickByText('button', 'Subscription Plans');
await sleep(1200);
if (!await waitForText('My Refunds', 20)) throw new Error('My Refunds section did not render — refundsLoading crash?');
console.log('My Refunds section rendered (refundsLoading fix confirmed)');

const refundPanel = await evaluate(`
  (() => {
    const text = document.body.innerText;
    const lower = text.toLowerCase();
    const badges = [...document.querySelectorAll('.cd-status-tag')].map((n) => n.textContent.trim());
    const lowerBadges = badges.map((b) => b.toLowerCase());
    const cancelButtons = [...document.querySelectorAll('button')].filter((n) => n.textContent.trim().toLowerCase() === 'cancel request').length;
    const requestButtons = [...document.querySelectorAll('button')].filter((n) => n.textContent.trim().toLowerCase().includes('request refund')).length;
    return { hasRefundsHeading: lower.includes('my refunds'), badges, lowerBadges, cancelButtons, requestButtons,
      hasCompletedBadge: lowerBadges.includes('refund completed'),
      hasApprovedBadge: lowerBadges.includes('approved'),
      showsRequestedDate: /requested \\w{3} \\d{1,2}, \\d{4}/i.test(text),
      showsUpdatedDate: /updated \\w{3} \\d{1,2}, \\d{4}/i.test(text) };
  })()
`);
console.log('refund panel state:', JSON.stringify(refundPanel, null, 2));
if (!refundPanel.hasRefundsHeading) throw new Error('My Refunds heading missing');
if (!refundPanel.hasCompletedBadge) throw new Error('completed refund badge missing');
if (!refundPanel.showsRequestedDate) throw new Error('requested date missing');
if (!refundPanel.showsUpdatedDate) throw new Error('last-updated date missing');
// Per-row: cancel may appear only on requested/under_review rows, never on
// approved/processing/terminal rows (backend cancels only those two states).
const rowStates = await evaluate(`
  (() => {
    const cards = [...document.querySelectorAll('.cd-status-tag')]
      .filter((n) => n.closest('div[style*="border-radius: 12px"]') || n.parentElement.parentElement)
      .map((tag) => {
        const card = tag.closest('div[style*="border-radius: 12px"]') || tag.parentElement.parentElement;
        return {
          status: tag.textContent.trim().toLowerCase(),
          hasCancel: [...card.querySelectorAll('button')].some((b) => b.textContent.trim().toLowerCase() === 'cancel request'),
        };
      });
    return cards;
  })()
`);
console.log('per-row state:', JSON.stringify(rowStates));
// Display labels shown for the two backend-cancellable states (REQUESTED, UNDER_REVIEW).
const cancellableLabels = ['request received', 'being reviewed'];
for (const row of rowStates) {
  if (row.hasCancel && !cancellableLabels.includes(row.status)) {
    throw new Error(`cancel offered on a ${row.status} refund — backend only allows cancelling REQUESTED/UNDER_REVIEW`);
  }
}
const approvedRow = rowStates.find((r) => r.status === 'approved');
if (approvedRow && approvedRow.hasCancel) throw new Error('approved row must not offer cancel');
// A completed refund keeps no cancel action; a payment with an open request shows the table tag instead of a button.
const tableTag = await evaluate(`document.body.innerText.toLowerCase().includes('refund requested')`);
console.log('payments table marks the open-request payment:', tableTag);

// 4. Open the request modal and verify the prefill + currency label.
const modalOpener = await evaluate(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((n) => n.textContent.trim().toLowerCase().includes('request refund'));
    if (!btn) return false;
    btn.click();
    return true;
  })()
`);
if (!modalOpener) throw new Error('Request refund button not found to open modal');
await sleep(700);
const modal = await evaluate(`
  (() => {
    const inputs = [...document.querySelectorAll('.cd-address-modal input')];
    const labels = [...document.querySelectorAll('.cd-address-modal label')].map((n) => n.textContent.trim());
    const amount = inputs.find((n) => n.type === 'number');
    const reason = [...document.querySelectorAll('.cd-address-modal textarea')];
    return {
      open: Boolean(document.querySelector('.cd-address-overlay')),
      labels,
      amountValue: amount ? amount.value : null,
      reasonPlaceholder: reason[0]?.placeholder || null,
      submitLabel: [...document.querySelectorAll('.cd-address-modal button')].map((n) => n.textContent.trim()).find((t) => t.includes('SUBMIT')),
    };
  })()
`);
console.log('request modal state:', JSON.stringify(modal, null, 2));
if (!modal.open || modal.amountValue === null) throw new Error('refund modal did not open');
if (!modal.labels.some((l) => l.startsWith('REFUND AMOUNT (LKR)'))) throw new Error('currency label missing');
if (!modal.reasonPlaceholder) throw new Error('reason textarea missing');
await shot('refund-modal.png');

// 5. Validation error path: clear the reason, submit, expect inline error.
await evaluate(`
  (() => {
    const ta = document.querySelector('.cd-address-modal textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'ab');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await clickByText('.cd-address-modal button', 'SUBMIT REQUEST');
await sleep(500);
const validation = await evaluate(`(() => {
  const err = [...document.querySelectorAll('.cd-address-modal p')].map((n) => n.textContent.trim());
  return { stillOpen: Boolean(document.querySelector('.cd-address-overlay')), error: err.find((t) => t.toLowerCase().includes('reason')) || null };
})()`);
console.log('validation state:', JSON.stringify(validation));
if (!validation.error) throw new Error('inline validation error missing');

// 6. Submit a real refund through the UI and watch history update.
await evaluate(`
  (() => {
    const ta = document.querySelector('.cd-address-modal textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'Browser verification refund');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await clickByText('.cd-address-modal button', 'SUBMIT REQUEST');
await sleep(2500);
const afterSubmit = await evaluate(`
  (() => {
    const lower = document.body.innerText.toLowerCase();
    const badges = [...document.querySelectorAll('.cd-status-tag')].map((n) => n.textContent.trim());
    const lowerBadges = badges.map((b) => b.toLowerCase());
    const cancelButtons = [...document.querySelectorAll('button')].filter((n) => n.textContent.trim().toLowerCase() === 'cancel request').length;
    return { successBanner: lower.includes('refund request submitted'), lowerBadges, newBadgeRequested: lowerBadges.filter((b) => b === 'request received').length, cancelButtons, paymentsTagShowsRefundRequested: lower.includes('refund requested') };
  })()
`);
console.log('after submit:', JSON.stringify(afterSubmit, null, 2));
const modalClosed = await evaluate(`!document.querySelector('.cd-address-overlay')`);
if (!modalClosed) throw new Error('modal did not close after submit');
if (!afterSubmit.newBadgeRequested) throw new Error('history did not show the new request');
if (!afterSubmit.cancelButtons) throw new Error('cancel button missing on the new open request');
if (!afterSubmit.paymentsTagShowsRefundRequested) throw new Error('payments table did not mark the payment as refund requested');
// The success toast follows the existing convention of rendering on the overview tab.
await clickByText('button', 'Booking');
await sleep(800);
const toastVisible = await evaluate(`document.body.innerText.toLowerCase().includes('refund request submitted')`);
console.log('success toast on overview tab:', toastVisible);
if (!toastVisible) throw new Error('success toast missing on overview tab');
await clickByText('button', 'Subscription Plans');
await sleep(800);
await shot('refund-history-after-submit.png');

// 7. Cancel it from the UI (confirm modal → confirm).
await clickByText('button', 'Cancel request');
await sleep(600);
const confirmOpen = await evaluate(`(() => {
  const lower = document.body.innerText.toLowerCase();
  return { open: lower.includes('cancel refund request'), copy: lower.includes('you can submit a new request later') };
})()`);
console.log('cancel confirm modal:', JSON.stringify(confirmOpen));
if (!confirmOpen.open) throw new Error('cancel confirmation modal missing');
await clickByText('button', 'Yes, Cancel Request');
await sleep(2500);
const afterCancel = await evaluate(`
  (() => {
    const lower = document.body.innerText.toLowerCase();
    const lowerBadges = [...document.querySelectorAll('.cd-status-tag')].map((n) => n.textContent.trim().toLowerCase());
    return { cancelledBadge: lowerBadges.filter((b) => b === 'cancelled').length,
      banner: lower.includes('refund request cancelled'),
      cancelButtonsLeft: [...document.querySelectorAll('button')].filter((n) => n.textContent.trim().toLowerCase() === 'cancel request').length };
  })()
`);
console.log('after cancel:', JSON.stringify(afterCancel));
if (!afterCancel.cancelledBadge || afterCancel.cancelledBadge < 1) throw new Error('cancelled badge missing after cancel');
if (afterCancel.banner === false && afterCancel.cancelledBadge === 0) throw new Error('cancel confirmation missing');
if (afterCancel.cancelButtonsLeft !== afterSubmit.cancelButtons - 1) throw new Error('cancelled refund still offers cancel (count did not decrease by one)');
await shot('refund-history-after-cancel.png');

// 8. Empty-history view for a fresh customer (customer B from the API run).
await evaluate(`
  (async () => {
    const res = await fetch('${API}/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Empty Hist Customer', email: 'empty.hist.${Date.now()}@test.luxora', password: 'EmptyH#12345', phone: '0770000999' }),
    });
    const data = await res.json();
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    return res.status;
  })()
`);
await nav(`${FRONTEND}/customer-dashboard`);
if (!await waitForText('ACTIVE PACKAGES', 30)) throw new Error('dashboard did not render for fresh customer');
await clickByText('button', 'Subscription Plans');
if (!await waitForText('My Refunds', 30)) throw new Error('My Refunds missing for fresh customer');
await sleep(1000);
const emptyState = await evaluate(`(() => {
  const lower = document.body.innerText.toLowerCase();
  return { emptyMessage: lower.includes('no refund requests'), refundsHeading: lower.includes('my refunds') };
})()`);
console.log('empty history state:', JSON.stringify(emptyState));
if (!emptyState.emptyMessage) throw new Error('empty-history message missing');
await shot('refund-history-empty.png');

console.log('\nBROWSER VERIFICATION: ALL CHECKS PASSED');
ws.close();
chrome.kill();
process.exit(0);
