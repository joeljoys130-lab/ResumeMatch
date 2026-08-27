import { GoogleGenAI } from '@google/genai';

let geminiClient = null;

export function getGeminiClient() {
  if (geminiClient) return geminiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('dummy') || apiKey.trim() === '') {
    return null;
  }

  try {
    geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
  } catch (err) {
    console.warn('⚠️ Google Gemini SDK initialization error:', err.message);
    return null;
  }
}

export default getGeminiClient;
