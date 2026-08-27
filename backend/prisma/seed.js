import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Prisma Database Seed...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@resumematch.ai';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
  const defaultPasswordHash = await bcrypt.hash('Password123!', 12);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  // 1. Seed Admin Account
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', passwordHash: adminPasswordHash },
    create: {
      name: 'System Admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN'
    }
  });

  // 2. Seed Standard Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@resumematch.ai' },
    update: {},
    create: {
      name: 'Alex Johnson',
      email: 'demo@resumematch.ai',
      passwordHash: defaultPasswordHash,
      role: 'USER'
    }
  });

  // 3. Seed Sample Job Description
  const sampleJD = await prisma.jobDescription.create({
    data: {
      userId: demoUser.id,
      title: 'Senior Full Stack Engineer',
      company: 'TechCorp Solutions',
      content: 'We are seeking a Senior Full Stack Engineer proficient in React, Node.js, Express, PostgreSQL, MongoDB, and Redis. Experience with Cloud platforms and Docker is strongly preferred.'
    }
  });

  // 4. Seed Sample Application with Status History in a transaction
  const sampleApp = await prisma.application.create({
    data: {
      userId: demoUser.id,
      jobDescriptionId: sampleJD.id,
      company: 'TechCorp Solutions',
      jobTitle: 'Senior Full Stack Engineer',
      jobUrl: 'https://example.com/careers/fullstack',
      currentStatus: 'APPLIED',
      appliedAt: new Date(),
      notes: 'Applied via company site with customized resume.',
      statusHistory: {
        create: [
          { status: 'SAVED', notes: 'Saved job posting' },
          { status: 'APPLIED', notes: 'Submitted application' }
        ]
      }
    }
  });

  console.log('✅ Seed completed successfully!');
  console.log(`   - Admin Account: ${adminUser.email} (Password: ${adminPassword})`);
  console.log(`   - Demo User Account: ${demoUser.email} (Password: Password123!)`);
  console.log(`   - Sample Application ID: ${sampleApp.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
