import crypto from 'crypto';

/**
 * Generates a deterministic SHA-256 cache key from normalized resume and job description text.
 */
export function generateAnalysisCacheKey(resumeText, jobDescriptionText) {
  const normalizedResume = (resumeText || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedJD = (jobDescriptionText || '').toLowerCase().replace(/\s+/g, ' ').trim();
  
  const concatenated = `resume:${normalizedResume}|jd:${normalizedJD}`;
  return 'analysis:' + crypto.createHash('sha256').update(concatenated).digest('hex');
}

/**
 * Calculates estimated cost for Anthropic Claude tokens.
 * Pricing (Claude 3.5 Sonnet): $3.00 / 1M input, $15.00 / 1M output
 */
export function calculateLLMCost(inputTokens = 0, outputTokens = 0, model = 'claude-3-5-sonnet-20241022') {
  const inputCostPerToken = 3.00 / 1000000;
  const outputCostPerToken = 15.00 / 1000000;

  const cost = (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
  return Number(cost.toFixed(6));
}
