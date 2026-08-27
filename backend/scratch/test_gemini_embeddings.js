import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testEmbeddings() {
  const apiKey = process.env.GEMINI_API_KEY;
  const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

  if (!apiKey || apiKey.trim() === '') {
    console.log(JSON.stringify({ status: 'FAILED', reason: 'GEMINI_API_KEY missing in backend/.env' }));
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: embeddingModel,
      contents: 'Resume optimization guide and ATS formatting guidelines.'
    });

    const embedding = response.embedding?.values || (response.embeddings && response.embeddings[0]?.values) || [];

    if (!embedding || embedding.length === 0) {
      console.log(JSON.stringify({ status: 'FAILED', reason: 'Empty embedding values array returned' }));
      process.exit(1);
    }

    console.log(JSON.stringify({
      status: 'PASS',
      model: embeddingModel,
      dimensions: embedding.length,
      sampleVector: embedding.slice(0, 5)
    }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'FAILED', model: embeddingModel, error: err.message }));
    process.exit(1);
  }
}

testEmbeddings();
