// One-time production incident remediation for historical public seed accounts.
// This disables accounts rather than deleting them so that existing records
// retain their foreign-key and audit history.
import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const confirmationValue = 'DISABLE_EXPOSED_PUBLIC_SEED_ACCOUNTS';
const seedAccountEmails = ['customer@luxora.lk', 'provider@luxora.lk', 'admin@luxora.lk'];

export async function disablePublicSeedAccounts(client = prisma) {
  const accounts = await client.user.findMany({
    where: { email: { in: seedAccountEmails }, active: true },
    select: { id: true, role: true },
  });
  if (!accounts.length) return { disabled: 0, providersTakenOffline: 0, adminHeld: [] };

  const accountIds = accounts.map((account) => account.id);
  // Safety: never disable the last remaining active admin. Seed admin rows
  // are fixtures, but production must keep at least one working admin, so a
  // seed admin is held back (left fully active) unless another active admin
  // already exists. The operator must provision a replacement admin first;
  // main() fails loudly in that case instead of silently leaving access open.
  const adminSeedIds = accounts.filter((account) => account.role === 'ADMIN').map((account) => account.id);
  let heldAdminIds = [];
  if (adminSeedIds.length) {
    const otherActiveAdmins = await client.user.count({
      where: { role: 'ADMIN', active: true, id: { notIn: accountIds } },
    });
    if (otherActiveAdmins === 0) heldAdminIds = adminSeedIds;
  }
  const disableIds = accountIds.filter((id) => !heldAdminIds.includes(id));

  // Replacement values are random, independent, and never persisted outside
  // the password hashes or written to any output.
  const replacements = await Promise.all(disableIds.map(() => bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12)));
  const providerUserIds = accounts.filter((account) => account.role === 'PROVIDER' && disableIds.includes(account.id)).map((account) => account.id);

  const result = await client.$transaction(async (tx) => {
    await Promise.all(disableIds.map((id, index) => tx.user.update({
      where: { id },
      data: { active: false, passwordHash: replacements[index], tokenVersion: { increment: 1 } },
    })));
    await tx.passwordResetToken.updateMany({
      where: { userId: { in: disableIds }, usedAt: null },
      data: { usedAt: new Date() },
    });
    const providers = await tx.provider.updateMany({
      where: { userId: { in: providerUserIds } },
      data: { availabilityStatus: 'offline' },
    });
    return { disabled: disableIds.length, providersTakenOffline: providers.count };
  });
  if (heldAdminIds.length) {
    throw new Error(
      'Seed admin account(s) held back: no other active admin exists. ' +
      'Provision a replacement admin first, then re-run remediation to finish.',
    );
  }
  return { ...result, adminHeld: [] };
}

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Refusing to run outside NODE_ENV=production. Use an isolated database to test this script.');
  }
  if (process.env.CONFIRM_PRODUCTION_SEED_ACCOUNT_REMEDIATION !== confirmationValue) {
    throw new Error('Refusing to change production accounts without the required incident-remediation confirmation.');
  }
  const result = await disablePublicSeedAccounts();
  console.log(`Public seed-account remediation complete: ${result.disabled} accounts disabled; ${result.providersTakenOffline} providers taken offline.`);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main()
    .catch((error) => { console.error(`Public seed-account remediation failed: ${error.message}`); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect(); });
}
