import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {
  encryptAccountNumber,
  decryptAccountNumber,
  maskAccountNumber,
  hashAccountNumber,
  assertBankingKeyConfigured,
} from '../src/services/bankingCrypto.js';

dotenv.config();

const prisma = new PrismaClient();

export async function migrateBankAccounts(client = prisma) {
  assertBankingKeyConfigured();

  const accounts = await client.providerBankAccount.findMany({
    orderBy: { id: 'asc' },
  });

  let migratedCount = 0;
  let verifiedCount = 0;

  for (const account of accounts) {
    const rawNumber = String(account.accountNumber || '').trim();
    let plainNumber = rawNumber;
    let encryptedNumber = rawNumber;

    if (rawNumber.startsWith('enc:v1:')) {
      // Already encrypted, decrypt to verify and ensure mask/hash are present
      plainNumber = decryptAccountNumber(rawNumber);
    } else {
      // Plaintext legacy number - encrypt it
      encryptedNumber = encryptAccountNumber(plainNumber);
      migratedCount += 1;
    }

    const testDecrypted = decryptAccountNumber(encryptedNumber);
    if (testDecrypted.replace(/\s+/g, '') !== plainNumber.replace(/\s+/g, '')) {
      throw new Error(`Migration verification failed for bank account #${account.id}: decrypted value does not match original plaintext.`);
    }
    verifiedCount += 1;

    const mask = maskAccountNumber(plainNumber);
    const hash = hashAccountNumber(plainNumber);

    await client.providerBankAccount.update({
      where: { id: account.id },
      data: {
        accountNumber: encryptedNumber,
        accountMask: mask,
        accountHash: hash,
      },
    });
  }

  // Normalize selected accounts so each provider has exactly one selected account
  const providerIds = Array.from(new Set(accounts.map((a) => a.providerId)));
  for (const providerId of providerIds) {
    const provAccounts = await client.providerBankAccount.findMany({
      where: { providerId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    if (provAccounts.length === 0) continue;

    const selectedAccounts = provAccounts.filter((a) => a.selected);
    const targetSelectedId = selectedAccounts.length > 0 ? selectedAccounts[0].id : provAccounts[0].id;

    for (const acc of provAccounts) {
      const shouldBeSelected = acc.id === targetSelectedId;
      if (acc.selected !== shouldBeSelected) {
        await client.providerBankAccount.update({
          where: { id: acc.id },
          data: { selected: shouldBeSelected },
        });
      }
    }
  }

  return { total: accounts.length, migrated: migratedCount, verified: verifiedCount };
}

if (process.argv[1] && process.argv[1].endsWith('migrate-bank-accounts.js')) {
  migrateBankAccounts()
    .then((result) => {
      console.log(`Bank account migration successful: ${result.total} total, ${result.migrated} newly encrypted, ${result.verified} verified.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Bank account migration failed:', err);
      process.exit(1);
    });
}
