import dotenv from 'dotenv';
dotenv.config({ override: true });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

export default prisma;