import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testInterviewAgent() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.trim() === '') {
    console.log(JSON.stringify({ status: 'FAILED', reason: 'GEMINI_API_KEY missing in backend/.env' }));
    process.exit(1);
  }

  const systemInstruction = `You are an expert technical interviewer conducting a mock interview for a Senior Full Stack Developer role.
Evaluate candidate answers, assign a turn score (0-100), provide feedback, and ask a relevant adaptive follow-up question.
Return JSON ONLY matching:
{
  "turnScore": number,
  "feedback": "string",
  "nextQuestion": "string"
}`;

  const prompt = `Candidate Response: "I handle async operations using async/await and Promises in Express.js. For database transactions, I use Prisma $transaction to ensure atomicity."`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (typeof parsed.turnScore !== 'number' || !parsed.nextQuestion) {
      console.log(JSON.stringify({ status: 'FAILED', reason: 'Invalid interview agent output format', raw: response.text }));
      process.exit(1);
    }

    console.log(JSON.stringify({
      status: 'PASS',
      turnScore: parsed.turnScore,
      feedbackSnippet: parsed.feedback.substring(0, 80),
      adaptiveNextQuestion: parsed.nextQuestion
    }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    process.exit(1);
  }
}

testInterviewAgent();
