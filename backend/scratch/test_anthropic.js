import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

async function testClaude() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  if (!apiKey || apiKey.includes('dummy')) {
    console.log(JSON.stringify({
      auth: 'FAILED (Missing or dummy key)',
      modelAvailability: 'FAILED',
      response: 'FAILED',
      tokenUsage: 'FAILED'
    }));
    return;
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say hello in 1 word.' }]
    });

    const hasContent = Boolean(res.content && res.content[0] && res.content[0].text);
    const hasTokenUsage = Boolean(res.usage && typeof res.usage.input_tokens === 'number' && typeof res.usage.output_tokens === 'number');

    console.log(JSON.stringify({
      auth: 'PASSED',
      modelAvailability: 'PASSED',
      response: hasContent ? 'PASSED' : 'FAILED',
      tokenUsage: hasTokenUsage ? 'PASSED' : 'FAILED',
      usage: res.usage
    }));
  } catch (err) {
    console.log(JSON.stringify({
      auth: err.status === 401 ? 'FAILED (Unauthorized)' : 'PASSED',
      modelAvailability: err.status === 404 ? 'FAILED (Model not found)' : 'UNKNOWN',
      response: 'FAILED',
      tokenUsage: 'FAILED',
      error: err.message
    }));
  }
}

testClaude();
