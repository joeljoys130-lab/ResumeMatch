import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  keySkills: z.array(z.string())
});

async function testStructuredOutput() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.trim() === '') {
    console.log(JSON.stringify({ status: 'FAILED', reason: 'GEMINI_API_KEY missing in backend/.env' }));
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Evaluate candidate skill match for a Node.js developer role. 
Return ONLY valid JSON matching this schema:
{
  "score": number (0-100),
  "feedback": "string",
  "keySkills": ["string"]
}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || '';
    const parsedJson = JSON.parse(rawText);
    const validated = testSchema.parse(parsedJson);

    console.log(JSON.stringify({
      status: 'PASS',
      zodValidated: true,
      data: validated
    }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    process.exit(1);
  }
}

testStructuredOutput();
