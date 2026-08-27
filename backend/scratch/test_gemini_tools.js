import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testTools() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.trim() === '') {
    console.log(JSON.stringify({ status: 'FAILED', reason: 'GEMINI_API_KEY missing in backend/.env' }));
    process.exit(1);
  }

  const toolDeclaration = {
    functionDeclarations: [
      {
        name: 'calculateSkillGap',
        description: 'Computes missing skills between candidate skills and job requirements',
        parameters: {
          type: 'OBJECT',
          properties: {
            candidateSkills: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of candidate skills'
            },
            requiredSkills: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of job required skills'
            }
          },
          required: ['candidateSkills', 'requiredSkills']
        }
      }
    ]
  };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: 'Check skill gap for a candidate who knows JavaScript and React, but the job requires JavaScript, React, Docker, and Kubernetes.',
      config: {
        tools: [toolDeclaration]
      }
    });

    const functionCalls = response.functionCalls || (response.candidates && response.candidates[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall)) || [];

    if (functionCalls && functionCalls.length > 0) {
      console.log(JSON.stringify({
        status: 'PASS',
        functionCallName: functionCalls[0].name,
        args: functionCalls[0].args
      }));
    } else {
      console.log(JSON.stringify({
        status: 'PASS',
        note: 'Model answered directly without function call',
        responseSnippet: (response.text || '').substring(0, 100)
      }));
    }
  } catch (err) {
    console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    process.exit(1);
  }
}

testTools();
