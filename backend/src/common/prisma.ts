// ============================================
// prisma.ts — Shared Prisma Client (singleton)
// Poore app mein ek hi instance use hoga.
// ============================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

export default prisma;