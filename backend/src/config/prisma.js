import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the whole backend.
export const prisma = new PrismaClient();
