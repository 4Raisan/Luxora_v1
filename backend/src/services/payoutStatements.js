// Slice 10 — payout statement builder. Single authoritative data model for
// admin statements and exports: the route JSON view and the CSV serializer
// both consume this structure, so payout business logic exists exactly once.
// A payout statement is derived purely from stored ProviderPayout rows —
// Luxora stores no fee fields, so amounts are gross and net-identical.
import { prisma } from '../config/prisma.js';
import { decryptAccountNumber, maskAccountNumber } from './bankingCrypto.js';

export const STATEMENT_EXPORT_MAX_ROWS = 1000;
// Payouts are provider earnings for configured services, denominated in LKR
// by business rule; no per-payout currency is stored.
export const PAYOUT_CURRENCY = 'LKR';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Validates the optional from/to period window (YYYY-MM, inclusive, bounded).
// Returns { from, to } with nulls for open bounds, or { error }.
export function parsePeriodRange(query, { maxMonths = 24 } = {}) {
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;
  if ((from && !PERIOD_RE.test(from)) || (to && !PERIOD_RE.test(to))) {
    return { error: 'from and to must be period months formatted YYYY-MM' };
  }
  if (from && to && to < from) return { error: 'to must not be earlier than from' };
  if (from && to) {
    const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
    if (months > maxMonths) return { error: `Period range is limited to ${maxMonths} months; narrow the range` };
  }
  return { from, to };
}

function statementWhere({ from, to, status, providerId }) {
  return {
    ...(from || to ? { period: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(status ? { status } : {}),
    ...(providerId ? { providerId } : {}),
  };
}

// Builds the statement model. `skip`/`take` bound the line query; summary and
// total always cover the full filtered range so pagination stays consistent.
export async function buildPayoutStatement({ from = null, to = null, status = null, providerId = null, skip = 0, take = STATEMENT_EXPORT_MAX_ROWS } = {}) {
  const where = statementWhere({ from, to, status, providerId });
  const [total, byStatus, rows] = await Promise.all([
    prisma.providerPayout.count({ where }),
    prisma.providerPayout.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { amount: true } }),
    prisma.providerPayout.findMany({
      where,
      include: {
        provider: { include: { user: { select: { name: true, email: true } } } },
        bankAccount: { select: { bankName: true, accountHolder: true, accountNumber: true, branch: true } },
      },
      orderBy: [{ period: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
  ]);

  // Zero-initialized status buckets keep the summary contract stable even when
  // a status has no rows in the filtered range.
  const summary = {
    total, currency: PAYOUT_CURRENCY, itemCount: 0,
    paidCount: 0, paidTotal: 0, pendingCount: 0, pendingTotal: 0, failedCount: 0, failedTotal: 0,
  };
  for (const bucket of byStatus) {
    const key = bucket.status.toLowerCase();
    summary[`${key}Count`] = bucket._count._all;
    summary[`${key}Total`] = Number(bucket._sum.amount ?? 0);
    summary.itemCount += bucket._count._all;
  }

  const lines = rows.map((payout) => {
    // Snapshots preserve the bank details used at queue time; the live account
    // row only fills fields a legacy snapshot never stored. Account numbers
    // are decrypted solely to produce a masked reference — never returned whole.
    const encrypted = payout.accountNumberSnapshot || payout.bankAccount?.accountNumber || '';
    let accountMasked = '';
    try { accountMasked = maskAccountNumber(decryptAccountNumber(encrypted)); }
    catch { accountMasked = maskAccountNumber(encrypted); }
    return {
      id: payout.id,
      period: payout.period,
      kind: payout.kind.toLowerCase(),
      status: payout.status.toLowerCase(),
      amount: Number(payout.amount),
      currency: PAYOUT_CURRENCY,
      provider: { id: payout.providerId, name: payout.provider.user.name, email: payout.provider.user.email },
      bank: {
        name: payout.bankNameSnapshot || payout.bankAccount?.bankName || '',
        holder: payout.accountHolderSnapshot || payout.bankAccount?.accountHolder || '',
        account_masked: accountMasked,
        branch: payout.branchSnapshot || payout.bankAccount?.branch || '',
      },
      reference: payout.idempotencyKey,
      requested_at: payout.createdAt,
      paid_at: payout.paidAt,
    };
  });

  return { period: { from, to }, total, summary, lines };
}

// Pure CSV serialization: consumes statement lines only, contains no queries
// and no business rules, so any future format can reuse buildPayoutStatement.
export function toStatementCsv(lines) {
  const header = ['Payout ID', 'Period', 'Kind', 'Status', 'Amount', 'Currency', 'Provider ID', 'Provider Name', 'Provider Email', 'Bank', 'Account Holder', 'Account (Masked)', 'Branch', 'Requested At', 'Paid At', 'Reference'];
  const escape = (value) => {
    let text = String(value ?? '');
    // CSV formula-injection guard (OWASP): untrusted text may not begin with
    // characters spreadsheet apps interpret as formulas. Prefix with an
    // apostrophe so '=HYPERLINK(...)-style cells open inert.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows = lines.map((line) => [
    line.id, line.period, line.kind, line.status, line.amount.toFixed(2), line.currency,
    line.provider.id, line.provider.name, line.provider.email,
    line.bank.name, line.bank.holder, line.bank.account_masked, line.bank.branch,
    line.requested_at ? new Date(line.requested_at).toISOString() : '',
    line.paid_at ? new Date(line.paid_at).toISOString() : '',
    line.reference,
  ].map(escape).join(','));
  return [header.join(','), ...rows].join('\r\n');
}
