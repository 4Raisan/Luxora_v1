// One-time, idempotent compatibility migration for databases created before
// Provider.serviceTowns replaced the old `towns` column.
import { prisma } from '../src/config/prisma.js';

try {
  const columns = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'providers'
  `;
  const names = new Set(columns.map((column) => column.column_name));

  if (names.has('towns') && !names.has('serviceTowns')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "providers" RENAME COLUMN "towns" TO "serviceTowns"');
    console.log('Migrated providers.towns to providers.serviceTowns.');
  } else {
    console.log('Provider towns schema is already current.');
  }
} finally {
  await prisma.$disconnect();
}
