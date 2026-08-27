import cron from 'node-cron';
import prisma from '../config/prisma.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';

/**
 * SCHEDULED CRON JOBS MODULE
 * Uses node-cron to execute non-blocking background scheduled tasks.
 */

export function initScheduledJobs() {
  console.log('⏰ Initializing scheduled background cron jobs...');

  // 1. Weekly Career Summary Aggregator (Runs every Sunday at 00:00)
  cron.schedule('0 0 * * 0', async () => {
    console.log('🔄 Executing scheduled task: Weekly Career Summary Aggregator...');
    try {
      await generateWeeklyCareerSummaries();
    } catch (err) {
      console.error('❌ Error executing Weekly Career Summary job:', err.message);
    }
  });

  // 2. Application Follow-up Reminder Scanner (Runs daily at 09:00 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('🔄 Executing scheduled task: Application Follow-up Reminder Scanner...');
    try {
      await scanStaleApplicationReminders();
    } catch (err) {
      console.error('❌ Error executing Stale Application Reminder job:', err.message);
    }
  });
}

export async function generateWeeklyCareerSummaries() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });

  for (const user of users) {
    const appsCount = await prisma.application.count({ where: { userId: user.id } });
    const latestAnalysis = await ResumeAnalysis.findOne({ userId: user.id }).sort({ createdAt: -1 });

    const summary = {
      timestamp: new Date(),
      userId: user.id,
      email: user.email,
      totalApplications: appsCount,
      latestMatchScore: latestAnalysis?.result?.matchScore || 0,
      topMissingSkills: latestAnalysis?.result?.missingSkills || []
    };

    console.log(`   [Weekly Summary Generated] User: ${user.email} | Apps: ${appsCount} | Score: ${summary.latestMatchScore}`);
  }
}

export async function scanStaleApplicationReminders() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const staleApps = await prisma.application.findMany({
    where: {
      currentStatus: 'APPLIED',
      updatedAt: { lte: sevenDaysAgo }
    },
    include: { user: { select: { email: true } } }
  });

  console.log(`   🔍 Scanned ${staleApps.length} stale applications pending follow-up.`);
  return staleApps;
}
