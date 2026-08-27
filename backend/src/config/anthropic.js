import Anthropic from '@anthropic-ai/sdk';

let anthropicClient = null;

export function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes('dummy')) {
    return null;
  }

  try {
    anthropicClient = new Anthropic({ apiKey });
    return anthropicClient;
  } catch (err) {
    console.warn('⚠️ Anthropic SDK initialization error:', err.message);
    return null;
  }
}

export default getAnthropicClient;
