import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

export async function connectPrisma() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully (Prisma ORM)');
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error.message);
    throw error;
  }
}

export default prisma;
