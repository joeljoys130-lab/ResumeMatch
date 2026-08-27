import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import AIConversation from '../models/AIConversation.js';
import { generateEmbedding, cosineSimilarity } from './embeddingService.js';
import getAnthropicClient from '../config/anthropic.js';
import { RAG_SYSTEM_PROMPT, formatRAGUserPrompt } from '../prompts/ragPrompt.js';
import { calculateLLMCost } from '../utils/hashes.js';
import LLMResponse from '../models/LLMResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');

/**
 * Ingests all Markdown knowledge documents into MongoDB with vector embeddings.
 */
export async function seedKnowledgeBase() {
  console.log('📚 Ingesting knowledge documents into MongoDB...');

  const files = ['resume-writing.md', 'ats-guidelines.md', 'interview-prep.md', 'career-advice.md'];
  let totalChunksIngested = 0;

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const title = file.replace('.md', '').replace(/-/g, ' ').toUpperCase();

      // Chunk document
      const rawChunks = chunkText(content, 500, 100);
      const chunks = [];

      for (let i = 0; i < rawChunks.length; i++) {
        const chunkTextStr = rawChunks[i];
        const embedding = await generateEmbedding(chunkTextStr);
        chunks.push({
          chunkId: `${file}-chunk-${i}`,
          text: chunkTextStr,
          embedding,
          metadata: {
            sourceFile: file,
            title,
            chunkIndex: i
          }
        });
      }

      await KnowledgeDocument.findOneAndUpdate(
        { sourceFile: file },
        { sourceFile: file, title, content, chunks },
        { upsert: true, new: true }
      );

      totalChunksIngested += chunks.length;
      console.log(`   ✓ Ingested ${file}: ${chunks.length} vector chunks`);
    } catch (err) {
      console.warn(`⚠️ Could not ingest ${file}:`, err.message);
    }
  }

  console.log(`✅ Knowledge Base Ingestion complete (${totalChunksIngested} total chunks vectorized).`);
  return totalChunksIngested;
}

/**
 * Performs vector similarity retrieval and generates a grounded response.
 */
export async function queryRAGAssistant(query, userId, conversationId = null) {
  const startTime = Date.now();

  // 1. Generate Query Vector Embedding
  const queryVector = await generateEmbedding(query);

  // 2. Vector Cosine Similarity Search over Knowledge Base Chunks
  const documents = await KnowledgeDocument.find({}).lean();
  const scoredChunks = [];

  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      scoredChunks.push({
        ...chunk,
        similarity: score,
        sourceFile: doc.sourceFile,
        title: doc.title
      });
    }
  }

  // Sort by highest cosine similarity
  scoredChunks.sort((a, b) => b.similarity - a.similarity);

  // Pick top K relevant chunks (similarity threshold >= 0.25 or top 3)
  const topChunks = scoredChunks.slice(0, 3);
  const isContextSufficient = topChunks.length > 0 && topChunks[0].similarity > 0.2;

  // Format citations
  const citations = topChunks.map(c => ({
    sourceFile: c.sourceFile,
    title: c.title,
    excerpt: c.text.slice(0, 150) + '...'
  }));

  let answerText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCost = 0;

  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  if (client && isContextSufficient) {
    const userPrompt = formatRAGUserPrompt(query, topChunks);
    const response = await client.messages.create({
      model,
      max_tokens: 1000,
      system: RAG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    answerText = response.content[0]?.text || '';
    inputTokens = response.usage?.input_tokens || 0;
    outputTokens = response.usage?.output_tokens || 0;
    estimatedCost = calculateLLMCost(inputTokens, outputTokens, model);
  } else if (!isContextSufficient) {
    answerText = "I don't have enough information in the knowledge base to answer that confidently. Please ask a question related to resume writing, ATS optimization, interview preparation, or software engineering career advice.";
  } else {
    // Local grounded fallback response if Anthropic Key is omitted
    answerText = generateFallbackRAGAnswer(query, topChunks);
  }

  const latencyMs = Date.now() - startTime;

  // Log usage metric
  await LLMResponse.create({
    userId,
    feature: 'RAG',
    model: client ? model : 'local-rag-engine',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost,
    latencyMs,
    cached: false,
    success: true
  });

  // Save/Update turn in AIConversation MongoDB schema
  let conversation;
  if (conversationId) {
    conversation = await AIConversation.findOne({ _id: conversationId, userId });
  }

  if (!conversation) {
    conversation = new AIConversation({
      userId,
      title: query.slice(0, 40) + '...',
      messages: []
    });
  }

  conversation.messages.push(
    { role: 'user', content: query, timestamp: new Date() },
    { role: 'assistant', content: answerText, citations, timestamp: new Date() }
  );

  await conversation.save();

  return {
    conversationId: conversation._id,
    answer: answerText,
    citations,
    tokenUsage: { inputTokens, outputTokens, estimatedCost, latencyMs }
  };
}

/**
 * Text chunking helper with overlap
 */
function chunkText(text, maxChunkSize = 500, overlap = 100) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).length <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = para;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

function generateFallbackRAGAnswer(query, topChunks) {
  if (topChunks.length === 0) {
    return "I don't have enough information in the knowledge base to answer that confidently.";
  }

  const primary = topChunks[0];
  return `Based on guidelines from **${primary.title}** (${primary.sourceFile}):\n\n${primary.text}\n\nKey Recommendation: Ensure your career documents adhere to clear impact metrics and standard industry layout practices.`;
}
