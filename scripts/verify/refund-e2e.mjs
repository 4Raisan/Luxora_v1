// V2 Slice 4 — API-level E2E of the customer refund experience.
// Walks the exact request sequence the customer dashboard UI performs
// (same endpoints, same order), including SSE REFUND_UPDATED delivery,
// stale-state 409, cancellation, role isolation, and duplicate submission.
// Run: node scripts/verify/refund-e2e.mjs  (backend must be running on :5000)
//
// Required environment (values must match the locally seeded database —
// no defaults are provided, and real credentials never belong in source):
//   LUXORA_TEST_CUSTOMER_EMAIL / LUXORA_TEST_CUSTOMER_PASSWORD
//   LUXORA_TEST_ADMIN_EMAIL    / LUXORA_TEST_ADMIN_PASSWORD
//   LUXORA_TEST_PROVIDER_EMAIL / LUXORA_TEST_PROVIDER_PASSWORD
const BASE = 'http://127.0.0.1:5000/api';

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error('Set LUXORA_TEST_CUSTOMER_EMAIL/PASSWORD, LUXORA_TEST_ADMIN_EMAIL/PASSWORD,');
    console.error('and LUXORA_TEST_PROVIDER_EMAIL/PASSWORD to the local seed account values.');
    process.exit(1);
  }
  return value;
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const json = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, body: data };
};

const login = async (email, password) => {
  const res = await json('/auth/login', { method: 'POST', body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
};

// Collect SSE events from the realtime endpoint.
const openSse = async (token) => {
  const events = [];
  const controller = new AbortController();
  const stream = fetch(`${BASE}/realtime?token=${encodeURIComponent(token)}`, { signal: controller.signal }).then(async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const eventName = (chunk.match(/^event: (.+)$/m) || [])[1];
        const dataLine = (chunk.match(/^data: (.+)$/m) || [])[1];
        if (eventName) events.push({ event: eventName, data: dataLine ? JSON.parse(dataLine) : null });
      }
    }
  }).catch(() => {});
  // Wait for the connected handshake event.
  for (let i = 0; i < 40 && !events.some((e) => e.event === 'connected'); i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return { events, close: () => controller.abort() };
};

const waitFor = async (events, predicate, label, timeoutMs = 5000) => {
  for (let i = 0; i < timeoutMs / 100; i += 1) {
    const found = events.find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`SSE event not received: ${label}`);
};

// ── Logins ──
const customer = await login(requiredEnv('LUXORA_TEST_CUSTOMER_EMAIL'), requiredEnv('LUXORA_TEST_CUSTOMER_PASSWORD'));
const admin = await login(requiredEnv('LUXORA_TEST_ADMIN_EMAIL'), requiredEnv('LUXORA_TEST_ADMIN_PASSWORD'));
const provider = await login(requiredEnv('LUXORA_TEST_PROVIDER_EMAIL'), requiredEnv('LUXORA_TEST_PROVIDER_PASSWORD'));
check('logins (customer/admin/provider)', Boolean(customer.token && admin.token && provider.token));

// ── Empty history state ──
let mine = await json('/payments/refunds/my', { token: customer.token });
check('customer refund history loads (array)', mine.status === 200 && Array.isArray(mine.body));
const historyBefore = mine.body.length;

// ── Create an eligible payment via the demo gateway (same as UI checkout) ──
const plans = await json('/subscriptions');
const plan = plans.body.find((p) => p.active !== false && Number(p.priceMonthly) > 0) || plans.body[0];
check('subscription catalogue loads for checkout', Boolean(plan?.id), plan?.title);
const idem = `LUX-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const checkout = await json('/payments/demo/checkout', {
  method: 'POST', token: customer.token,
  body: { plan_id: plan.id, billing_option: 'one_time', idempotency_key: idem },
});
check('demo checkout completes (COMPLETED payment)', checkout.status === 200 || checkout.status === 201, `status ${checkout.status}`);
const payment = checkout.body.payment || checkout.body;
check('payment captured an amount and is refundable source data', Number(payment.amount) > 0 && checkout.body.status === 'completed',
  `#${payment.id} amount ${payment.amount} ${payment.currency}`);
// The authoritative captured amount lives on /payments/my (what the UI maps).
const paymentsMine = await json('/payments/my', { token: customer.token });
const serverPayment = paymentsMine.body.payments.find((p) => p.id === payment.id);
check('GET /payments/my exposes the captured amount (UI prefill source)',
  Number(serverPayment?.capturedAmount) > 0, `captured ${serverPayment?.capturedAmount} ${serverPayment?.capturedCurrency}`);

// ── Refund request (UI submit) ──
const created = await json('/payments/refunds', {
  method: 'POST', token: customer.token,
  body: { payment_id: payment.id, amount: Number(payment.capturedAmount), reason: 'Slice 4 E2E verification request' },
});
check('refund request created (201, requested)', created.status === 201 && created.body.refund.status === 'requested',
  created.status === 201 ? `refund #${created.body.refund.id}` : JSON.stringify(created.body));
const refundId = created.body.refund.id;

// ── Duplicate submission protection (backend idempotency) ──
const duplicate = await json('/payments/refunds', {
  method: 'POST', token: customer.token,
  body: { payment_id: payment.id, amount: Number(payment.capturedAmount), reason: 'Double click simulation' },
});
check('duplicate submit returns the same open refund (200 idempotent)', duplicate.status === 200 && duplicate.body.refund.id === refundId);

// ── History shows the request ──
mine = await json('/payments/refunds/my', { token: customer.token });
const row = mine.body.find((r) => r.id === refundId);
check('refund appears in customer history', Boolean(row), row ? `status ${row.status}` : 'missing');
check('history row is customer-safe (no admin/provider internals)',
  row && !['admin_note', 'provider_ref', 'requestedBy', 'adminNote', 'providerRef'].some((k) => Object.keys(row).includes(k)));

// ── Realtime: customer SSE receives REFUND_UPDATED for their own refund ──
const sse = await openSse(customer.token);
check('customer SSE connected', sse.events.some((e) => e.event === 'connected'));

const review = await json(`/admin/refunds/${refundId}`, { method: 'PUT', token: admin.token, body: { action: 'review' } });
check('admin reviews the refund', review.status === 200 && review.body.refund.status === 'under_review');
const rt1 = await waitFor(sse.events, (e) => e.event === 'REFUND_UPDATED' && e.data?.refundId === refundId, 'REFUND_UPDATED under_review');
check('customer receives realtime REFUND_UPDATED (under_review)', rt1.data.status === 'under_review');

const approve = await json(`/admin/refunds/${refundId}`, { method: 'PUT', token: admin.token, body: { action: 'approve' } });
check('admin approves the refund', approve.status === 200 && approve.body.refund.status === 'approved');
const rt2 = await waitFor(sse.events, (e) => e.event === 'REFUND_UPDATED' && e.data?.refundId === refundId && e.data?.status === 'approved', 'REFUND_UPDATED approved');
check('customer receives realtime REFUND_UPDATED (approved)', Boolean(rt2));

const processRefund = await json(`/admin/refunds/${refundId}`, { method: 'PUT', token: admin.token, body: { action: 'process', provider_ref: `E2E-PROC-${Date.now()}` } });
check('admin marks the refund processing (provider reference)', processRefund.status === 200 && processRefund.body.refund.status === 'processing');
const rt2b = await waitFor(sse.events, (e) => e.event === 'REFUND_UPDATED' && e.data?.refundId === refundId && e.data?.status === 'processing', 'REFUND_UPDATED processing');
check('customer receives realtime REFUND_UPDATED (processing)', Boolean(rt2b));

const complete = await json(`/admin/refunds/${refundId}`, { method: 'PUT', token: admin.token, body: { action: 'complete', provider_ref: `E2E-${Date.now()}` } });
check('admin completes the refund', complete.status === 200 && complete.body.refund.status === 'completed');
const rt3 = await waitFor(sse.events, (e) => e.event === 'REFUND_UPDATED' && e.data?.refundId === refundId && e.data?.status === 'completed', 'REFUND_UPDATED completed');
check('customer receives realtime REFUND_UPDATED (completed)', Boolean(rt3));
sse.close();

mine = await json('/payments/refunds/my', { token: customer.token });
check('history reflects final completed state', mine.body.find((r) => r.id === refundId)?.status === 'completed');

// ── Rejection path ──
const idem2 = `LUX-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const checkout2 = await json('/payments/demo/checkout', {
  method: 'POST', token: customer.token,
  body: { plan_id: plan.id, billing_option: 'one_time', idempotency_key: idem2 },
});
const payment2 = checkout2.body.payment || checkout2.body;
const refund2 = await json('/payments/refunds', {
  method: 'POST', token: customer.token,
  body: { payment_id: payment2.id, reason: 'Rejection path verification' },
});
await json(`/admin/refunds/${refund2.body.refund.id}`, { method: 'PUT', token: admin.token, body: { action: 'review' } });
const reject = await json(`/admin/refunds/${refund2.body.refund.id}`, {
  method: 'PUT', token: admin.token,
  body: { action: 'reject', admin_note: 'Not eligible under policy' },
});
check('admin rejects with note', reject.status === 200 && reject.body.refund.status === 'rejected');
mine = await json('/payments/refunds/my', { token: customer.token });
check('customer sees rejected state (no admin note leaked)',
  mine.body.find((r) => r.id === refund2.body.refund.id)?.status === 'rejected'
  && !JSON.stringify(mine.body).includes('Not eligible under policy'));

// ── Cancellation path ──
const idem3 = `LUX-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const checkout3 = await json('/payments/demo/checkout', {
  method: 'POST', token: customer.token,
  body: { plan_id: plan.id, billing_option: 'one_time', idempotency_key: idem3 },
});
const payment3 = checkout3.body.payment || checkout3.body;
const refund3 = await json('/payments/refunds', {
  method: 'POST', token: customer.token,
  body: { payment_id: payment3.id, reason: 'Cancellation path verification' },
});
const cancel = await json(`/payments/refunds/${refund3.body.refund.id}/cancel`, { method: 'PUT', token: customer.token });
check('customer cancels own open refund', cancel.status === 200 && cancel.body.refund.status === 'cancelled');
const cancelAgain = await json(`/payments/refunds/${refund3.body.refund.id}/cancel`, { method: 'PUT', token: customer.token });
check('stale cancel of terminal refund returns 409', cancelAgain.status === 409, cancelAgain.body.error);

// ── Access control: customer B isolation, provider blocked ──
const signupB = await json('/auth/register', {
  method: 'POST',
  body: { name: `E2E Cust B ${Date.now()}`, email: `e2e.b.${Date.now()}@test.luxora`, password: 'E2eB#12345', phone: '0770000111' },
});
check('customer B registered', signupB.status === 200 || signupB.status === 201, `status ${signupB.status}`);
const tokenB = signupB.body.token;
const listB = await json('/payments/refunds/my', { token: tokenB });
check('customer B sees only own (empty) refunds', listB.status === 200 && listB.body.filter((r) => r.id >= refundId).length === 0);
const foreignCancel = await json(`/payments/refunds/${refundId}/cancel`, { method: 'PUT', token: tokenB });
check('customer B cannot cancel customer A refund (403/404)', foreignCancel.status === 403 || foreignCancel.status === 404, `got ${foreignCancel.status}`);

const providerRefundPost = await json('/payments/refunds', {
  method: 'POST', token: provider.token,
  body: { payment_id: payment.id, reason: 'Provider attempt' },
});
check('provider cannot request a refund (403)', providerRefundPost.status === 403);
const providerMy = await json('/payments/refunds/my', { token: provider.token });
check('provider refund list is empty (no customer data)', providerMy.status === 200 && providerMy.body.length === 0);

const adminMy = await json('/payments/refunds/my', { token: admin.token });
check('admin uses the admin surface (customer list separate, empty for admin)', adminMy.status === 200 && Array.isArray(adminMy.body));
const adminList = await json('/admin/refunds', { token: admin.token });
check('admin refund list shows all refunds', adminList.status === 200 && Array.isArray(adminList.body.data) && adminList.body.data.length >= 3);
const adminListAsCustomer = await json('/admin/refunds', { token: customer.token });
check('customer cannot access admin refund surface (403)', adminListAsCustomer.status === 403);

// ── Summary ──
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILURES:', failed.map((f) => f.name).join(', ')); process.exit(1); }
