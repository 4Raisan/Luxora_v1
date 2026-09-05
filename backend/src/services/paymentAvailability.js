const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

export function demoPaymentsEnabled(env = process.env) {
  if (env.DEMO_PAYMENTS_ENABLED !== undefined) {
    return TRUE_VALUES.has(String(env.DEMO_PAYMENTS_ENABLED).trim().toLowerCase());
  }

  // Backward compatibility for deployments that previously enabled the demo
  // checkout with PAYMENT_MODE=demo. Demo is no longer an exclusive mode:
  // configured PayHere and NOWPayments gateways remain available alongside it.
  return String(env.PAYMENT_MODE || '').trim().toLowerCase() === 'demo';
}
