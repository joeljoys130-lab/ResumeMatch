import { queryRAGAssistant, seedKnowledgeBase } from '../services/ragService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const queryKnowledge = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { query, conversationId } = req.body;

  const result = await queryRAGAssistant(query, userId, conversationId);
  return sendSuccess(res, result, 200);
});

export const streamKnowledge = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const query = req.query.query || 'How do I optimize my resume?';

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ status: 'connecting', message: 'Analyzing knowledge base...' })}\n\n`);

  try {
    const result = await queryRAGAssistant(query, userId);
    const words = result.answer.split(' ');

    res.write(`data: ${JSON.stringify({ status: 'streaming', citations: result.citations })}\n\n`);

    // Stream tokens chunk by chunk
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + ' ';
      res.write(`data: ${JSON.stringify({ status: 'streaming', token: chunk })}\n\n`);
      await new Promise((r) => setTimeout(r, 40)); // Simulate progressive token emission
    }

    res.write(`data: ${JSON.stringify({ status: 'complete', conversationId: result.conversationId })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ status: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

export const seedKnowledge = asyncHandler(async (req, res) => {
  const count = await seedKnowledgeBase();
  return sendSuccess(res, { chunksIngested: count }, 200, 'Knowledge base seeded and vectorized successfully.');
});
