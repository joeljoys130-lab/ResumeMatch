import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testStreaming() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.trim() === '') {
    console.log(JSON.stringify({ status: 'FAILED', reason: 'GEMINI_API_KEY missing in backend/.env' }));
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: 'Count from 1 to 5 with space between numbers.'
    });

    let chunkCount = 0;
    let accumulatedText = '';

    for await (const chunk of responseStream) {
      chunkCount++;
      accumulatedText += chunk.text || '';
    }

    if (chunkCount === 0 || !accumulatedText) {
      console.log(JSON.stringify({ status: 'FAILED', reason: 'No chunks received in stream' }));
      process.exit(1);
    }

    console.log(JSON.stringify({
      status: 'PASS',
      chunksReceived: chunkCount,
      fullText: accumulatedText.trim()
    }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    process.exit(1);
  }
}

testStreaming();
