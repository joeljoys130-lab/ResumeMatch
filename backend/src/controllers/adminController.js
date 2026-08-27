import { getAdminPlatformAnalytics, getUserPersonalAnalytics } from '../services/analyticsService.js';
import LLMResponse from '../models/LLMResponse.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const analytics = await getAdminPlatformAnalytics();
  return sendSuccess(res, { analytics });
});

export const getLLMUsageMetrics = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const logs = await LLMResponse.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return sendSuccess(res, { logs });
});

export const getUserAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const analytics = await getUserPersonalAnalytics(userId);
  return sendSuccess(res, { analytics });
});
