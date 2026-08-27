import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testConnection() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.trim() === '') {
    console.log(JSON.stringify({ status: 'FAILED', reason: 'GEMINI_API_KEY missing in backend/.env' }));
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: 'Hello Gemini! Respond in 1 sentence.'
    });

    const text = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || '';
    if (!text) {
      console.log(JSON.stringify({ status: 'FAILED', reason: 'Empty response text from Gemini API' }));
      process.exit(1);
    }

    const usage = response.usageMetadata || {};

    console.log(JSON.stringify({
      status: 'PASS',
      model,
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
      responseSnippet: text.trim().substring(0, 100)
    }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    process.exit(1);
  }
}

testConnection();
