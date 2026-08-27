import ResumeAnalysis from '../models/ResumeAnalysis.js';
import LLMResponse from '../models/LLMResponse.js';
import EvaluationResult from '../models/EvaluationResult.js';
import prisma from '../config/prisma.js';

/**
 * MONGODB AGGREGATION PIPELINE ANALYTICS SERVICE
 * Uses $match, $group, $unwind, $sort, $project for high-performance platform metrics.
 */

export async function getAdminPlatformAnalytics() {
  // 1. Total PostgreSQL Users Count
  const totalUsers = await prisma.user.count();
  const totalApplications = await prisma.application.count();
  const totalInterviews = await prisma.interviewSession.count();

  // 2. MongoDB Resume Analysis Aggregation Pipeline
  const analysisStats = await ResumeAnalysis.aggregate([
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        avgMatchScore: { $avg: '$result.matchScore' },
        bestMatchScore: { $max: '$result.matchScore' },
        avgAtsScore: { $avg: '$result.atsScore' }
      }
    },
    {
      $project: {
        _id: 0,
        totalAnalyses: 1,
        avgMatchScore: { $round: ['$avgMatchScore', 1] },
        bestMatchScore: 1,
        avgAtsScore: { $round: ['$avgAtsScore', 1] }
      }
    }
  ]);

  // 3. Top Missing Skills Aggregation ($unwind -> $group -> $sort -> $limit)
  const topMissingSkills = await ResumeAnalysis.aggregate([
    { $unwind: '$result.missingSkills' },
    {
      $group: {
        _id: '$result.missingSkills',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 8 },
    {
      $project: {
        _id: 0,
        skill: '$_id',
        count: 1
      }
    }
  ]);

  // 4. LLM Token & Cost Usage Aggregation from LLMResponse collection
  const llmUsageStats = await LLMResponse.aggregate([
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalInputTokens: { $sum: '$inputTokens' },
        totalOutputTokens: { $sum: '$outputTokens' },
        totalTokens: { $sum: '$totalTokens' },
        totalEstimatedCost: { $sum: '$estimatedCost' },
        avgLatencyMs: { $avg: '$latencyMs' },
        cachedCount: {
          $sum: { $cond: [{ $eq: ['$cached', true] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalRequests: 1,
        totalInputTokens: 1,
        totalOutputTokens: 1,
        totalTokens: 1,
        totalEstimatedCost: { $round: ['$totalEstimatedCost', 4] },
        avgLatencyMs: { $round: ['$avgLatencyMs', 0] },
        cacheHitRate: {
          $cond: [
            { $gt: ['$totalRequests', 0] },
            { $round: [{ $multiply: [{ $divide: ['$cachedCount', '$totalRequests'] }, 100] }, 1] },
            0
          ]
        }
      }
    }
  ]);

  // 5. Evaluation Suite Pass Rate Aggregation
  const evalStats = await EvaluationResult.aggregate([
    {
      $group: {
        _id: null,
        totalEvaluated: { $sum: 1 },
        totalPassed: { $sum: { $cond: [{ $eq: ['$passed', true] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalEvaluated: 1,
        totalPassed: 1,
        passRate: {
          $cond: [
            { $gt: ['$totalEvaluated', 0] },
            { $round: [{ $multiply: [{ $divide: ['$totalPassed', '$totalEvaluated'] }, 100] }, 1] },
            0
          ]
        }
      }
    }
  ]);

  const overview = analysisStats[0] || { totalAnalyses: 0, avgMatchScore: 0, bestMatchScore: 0, avgAtsScore: 0 };
  const llm = llmUsageStats[0] || {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalEstimatedCost: 0,
    avgLatencyMs: 0,
    cacheHitRate: 0
  };
  const evalData = evalStats[0] || { totalEvaluated: 0, totalPassed: 0, passRate: 0 };

  return {
    users: { totalUsers, totalApplications, totalInterviews },
    analyses: overview,
    topMissingSkills,
    llmUsage: llm,
    evaluation: evalData
  };
}

export async function getUserPersonalAnalytics(userId) {
  const userApps = await prisma.application.groupBy({
    by: ['currentStatus'],
    where: { userId },
    _count: { currentStatus: true }
  });

  const appStatusCounts = {
    SAVED: 0,
    APPLIED: 0,
    SCREENING: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0
  };

  userApps.forEach(item => {
    appStatusCounts[item.currentStatus] = item._count.currentStatus;
  });

  const userAnalyses = await ResumeAnalysis.find({ userId }).sort({ createdAt: -1 }).limit(5);

  const scores = userAnalyses.map(a => a.result.matchScore);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  return {
    statusCounts: appStatusCounts,
    totalApplications: Object.values(appStatusCounts).reduce((a, b) => a + b, 0),
    avgMatchScore: avgScore,
    bestMatchScore: bestScore,
    recentAnalyses: userAnalyses.map(a => ({
      id: a._id,
      fileName: a.resumeFileName,
      matchScore: a.result.matchScore,
      atsScore: a.result.atsScore,
      createdAt: a.createdAt
    }))
  };
}
