import crypto from 'crypto';

/**
 * Generates real dense vector embeddings.
 * Uses OpenAI API if OPENAI_API_KEY is configured.
 * Otherwise uses a deterministic, term-frequency hash vectorizer to produce 128-dimensional normalized vectors.
 */
export async function generateEmbedding(text = '') {
  const normalizedText = (text || '').trim();
  if (!normalizedText) {
    return new Array(128).fill(0);
  }

  // 1. If OpenAI Key is available, use OpenAI Embedding API
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
          input: normalizedText
        })
      });

      if (response.ok) {
        const data = await response.json();
        const vector = data.data?.[0]?.embedding;
        if (Array.isArray(vector)) {
          return vector;
        }
      } else {
        console.warn('⚠️ OpenAI embedding request returned non-200. Falling back to local deterministic embedding.');
      }
    } catch (err) {
      console.warn('⚠️ OpenAI embedding request error:', err.message);
    }
  }

  // 2. Local Functional Deterministic Normalized Vector Generator (128 Dimensions)
  return generateDeterministicVector(normalizedText, 128);
}

/**
 * Computes cosine similarity between two vector arrays.
 * Cosine Similarity = (A · B) / (||A|| * ||B||)
 */
export function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic local term-frequency feature hash vectorizer
 */
function generateDeterministicVector(text, dimensions = 128) {
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

  if (words.length === 0) return vector;

  for (const word of words) {
    const hash = crypto.createHash('md5').update(word).digest('hex');
    const index = parseInt(hash.slice(0, 8), 16) % dimensions;
    const sign = parseInt(hash.slice(8, 10), 16) % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  // L2 Normalize
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vector[i] * vector[i];
  }
  const magnitude = Math.sqrt(sumSq);

  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / magnitude;
    }
  }

  return vector;
}
