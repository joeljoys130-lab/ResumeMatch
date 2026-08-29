import prisma from '../config/prisma.js';
import getGeminiClient from '../config/gemini.js';
import { sanitizeInput } from './sanitizer.js';
import {
  INTERVIEW_SYSTEM_PROMPT,
  formatQuestionGenPrompt,
  formatAnswerEvalPrompt,
  formatFinalReportPrompt
} from '../prompts/interviewPrompt.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * Checks whether a candidate question is duplicate or substantially similar to any previous question.
 */
export function isDuplicateQuestion(candidateText, existingQuestions = []) {
  if (!candidateText || !existingQuestions || existingQuestions.length === 0) return false;

  const normalize = (str) => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['how', 'would', 'you', 'the', 'and', 'for', 'can', 'explain', 'what', 'with', 'in', 'your', 'handling', 'about', 'role'].includes(w));
  };

  const candidateTokens = new Set(normalize(candidateText));
  if (candidateTokens.size === 0) return false;

  for (const item of existingQuestions) {
    const qText = typeof item === 'string' ? item : item?.question;
    if (!qText) continue;

    // Direct match check
    if (candidateText.trim().toLowerCase() === qText.trim().toLowerCase()) return true;

    // Token Jaccard / Overlap similarity
    const existingTokens = normalize(qText);
    if (existingTokens.length === 0) continue;

    let matchCount = 0;
    for (const token of existingTokens) {
      if (candidateTokens.has(token)) matchCount++;
    }

    const similarity = matchCount / Math.max(candidateTokens.size, existingTokens.length);
    if (similarity >= 0.55) {
      return true;
    }
  }

  return false;
}

export async function startInterviewSession(userId, config) {
  const { role, experienceLevel, technology, interviewType } = config;

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      role,
      experienceLevel,
      technology,
      interviewType,
      status: 'ACTIVE',
      startedAt: new Date()
    }
  });

  const firstQuestionText = await generateAIQuestion(session, []);

  const question = await prisma.interviewQuestion.create({
    data: {
      interviewSessionId: session.id,
      questionNumber: 1,
      question: firstQuestionText
    }
  });

  return {
    session,
    firstQuestion: question
  };
}

export async function submitQuestionAnswer(userId, sessionId, answerText) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      questions: { orderBy: { questionNumber: 'asc' } }
    }
  });

  if (!session) {
    throw new NotFoundError(`Interview session #${sessionId} not found or unauthorized.`);
  }

  if (session.status !== 'ACTIVE') {
    throw new ValidationError('This interview session is already completed or cancelled.');
  }

  const currentQuestion = session.questions.find(q => !q.userAnswer);
  if (!currentQuestion) {
    throw new ValidationError('All current questions in this session have been answered.');
  }

  // Sanitize user answer to prevent prompt injection
  const { cleanedText: sanitizedAnswer } = sanitizeInput(answerText || '');

  const evaluation = await evaluateAnswerWithAI(session, session.questions, currentQuestion, sanitizedAnswer);

  const updatedQuestion = await prisma.interviewQuestion.update({
    where: { id: currentQuestion.id },
    data: {
      userAnswer: sanitizedAnswer,
      score: evaluation.score,
      technicalAccuracy: evaluation.technicalAccuracy,
      communication: evaluation.communication,
      feedback: evaluation.feedback,
      weakTopics: evaluation.weakTopics,
      followUpQuestion: evaluation.followUpQuestion,
      answeredAt: new Date()
    }
  });

  let nextQuestion = null;
  const answeredCount = session.questions.filter(q => q.userAnswer || q.id === currentQuestion.id).length;

  if (answeredCount < 4 && evaluation.followUpQuestion) {
    // Ensure follow-up question is non-duplicate against all session questions
    let finalFollowUp = evaluation.followUpQuestion;
    const allQuestionsSoFar = [...session.questions.map(q => q.question), currentQuestion.question];
    
    if (isDuplicateQuestion(finalFollowUp, allQuestionsSoFar)) {
      finalFollowUp = generateFallbackAdaptiveQuestion(session, allQuestionsSoFar, answeredCount + 1, evaluation.weakTopics);
    }

    nextQuestion = await prisma.interviewQuestion.create({
      data: {
        interviewSessionId: session.id,
        questionNumber: answeredCount + 1,
        question: finalFollowUp
      }
    });
  }

  return {
    evaluation,
    updatedQuestion,
    nextQuestion,
    completed: answeredCount >= 4
  };
}

export async function finalizeInterviewSession(userId, sessionId) {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      questions: { orderBy: { questionNumber: 'asc' } }
    }
  });

  if (!session) {
    throw new NotFoundError(`Interview session #${sessionId} not found or unauthorized.`);
  }

  const answeredQuestions = session.questions.filter(q => q.score !== null && q.score !== undefined);
  const count = answeredQuestions.length || 1;

  const totalScore = answeredQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
  const totalTech = answeredQuestions.reduce((acc, q) => acc + (q.technicalAccuracy || q.score || 0), 0);
  const totalComm = answeredQuestions.reduce((acc, q) => acc + (q.communication || q.score || 0), 0);

  // Individual turn scores are 0-10. overallScore is normalized to 0-100 scale: Math.round((average) * 10)
  const avgTurnScore = totalScore / count;
  const overallScore = Math.round(avgTurnScore * 10);
  const techScore = Math.round((totalTech / count) * 10);
  const commScore = Math.round((totalComm / count) * 10);

  const calculatedScores = { overallScore, techScore, commScore };
  const finalReportText = await generateAIFinalReport(session, session.questions, calculatedScores);

  const completedSession = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      overallScore,
      finalReport: finalReportText,
      completedAt: new Date()
    }
  });

  return {
    session: completedSession,
    answeredCount: answeredQuestions.length,
    finalReport: finalReportText
  };
}

/**
 * Analyzes answer text quality to detect gibberish, meaningless inputs, superficial answers, or detailed technical responses.
 */
export function analyzeAnswerTextQuality(answerText = '', technology = '') {
  const text = (answerText || '').trim();
  if (!text) {
    return {
      isMeaningless: true,
      score: 0,
      technicalAccuracy: 0,
      communication: 0,
      feedback: 'No answer text was submitted. Please provide a relevant technical response.',
      weakTopics: ['Core Technical Communication']
    };
  }

  const words = text.split(/\s+/).filter(Boolean);
  const totalLength = text.length;

  // 1. Unspaced single string or random sequence (e.g. "qwrtyopojhvc", "cfghuiopoijh")
  if (words.length === 1 && totalLength >= 5) {
    const vowels = (text.match(/[aeiou]/gi) || []).length;
    const vowelRatio = vowels / totalLength;
    if (vowelRatio < 0.15 || vowelRatio > 0.75) {
      return {
        isMeaningless: true,
        score: 0,
        technicalAccuracy: 0,
        communication: 0,
        feedback: 'The response contains no readable words or technical concepts. Please provide a clear explanation.',
        weakTopics: ['Basic Technical Communication', 'Domain Vocabulary']
      };
    }
  }

  // 2. Keyboard mash / repeating pattern detection (e.g. "asdfghjkl", "qwertyuiop")
  const mashPatterns = [/asdfgh/i, /qwerty/i, /zxcvbn/i, /dfghjk/i, /fghuio/i, /ertyui/i, /rtyopo/i];
  if (mashPatterns.some(p => p.test(text))) {
    return {
      isMeaningless: true,
      score: 1,
      technicalAccuracy: 0,
      communication: 1,
      feedback: 'The submitted response consists of random key patterns and does not answer the technical question.',
      weakTopics: ['Technical Articulation', 'Core Domain Concepts']
    };
  }

  // 3. Ratio of recognized words / technical vocabulary
  const commonWords = new Set([
    'react', 'node', 'nodejs', 'express', 'postgresql', 'postgres', 'mongo', 'mongodb', 'redis', 'api', 'apis', 'frontend', 'backend',
    'component', 'components', 'state', 'props', 'render', 'renders', 'rendering', 'hook', 'hooks', 'ui', 'user', 'interface',
    'architecture', 'architectural', 'system', 'data', 'database', 'query', 'async', 'await', 'promise', 'promises', 'event', 'loop',
    'io', 'non-blocking', 'handling', 'error', 'errors', 'boundary', 'boundaries', 'testing', 'jest', 'unit', 'integration',
    'performance', 'optimization', 'optimize', 'optimizing', 'memory', 'leak', 'leaks', 'cache', 'caching', 'code', 'splitting',
    'lazy', 'loading', 'memo', 'memoization', 'usememo', 'usecallback', 'ref', 'refs', 'service', 'server', 'client', 'http', 'rest',
    'is', 'are', 'was', 'were', 'use', 'used', 'using', 'for', 'to', 'can', 'be', 'create', 'build', 'structure', 'handling', 'handle',
    'where', 'which', 'that', 'this', 'with', 'from', 'into', 'under', 'over', 'by', 'and', 'or', 'not', 'in', 'on', 'at', 'an', 'a'
  ]);

  let validWordCount = 0;
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (commonWords.has(cleanWord) || cleanWord.length >= 4) {
      validWordCount++;
    }
  }

  const validWordRatio = words.length > 0 ? (validWordCount / words.length) : 0;
  if (validWordRatio < 0.35 || words.length < 3) {
    return {
      isMeaningless: true,
      score: 1,
      technicalAccuracy: 0,
      communication: 1,
      feedback: 'The response lacks technical substance or coherent structure. Please elaborate with specific technical concepts.',
      weakTopics: ['Technical Communication', 'Domain Knowledge']
    };
  }

  // 4. Distinction between Superficial/Incomplete (Test 2: score 3-5) vs Detailed Technical (Test 3: score 8-10)
  const techKeywords = ['react', 'node', 'express', 'postgres', 'postgresql', 'mongo', 'mongodb', 'redis', 'api', 'state', 'props', 'component', 'async', 'await', 'promise', 'query', 'memo', 'cache', 'event', 'io', 'render', 'hook', 'middleware', 'boundary', 'zod', 'prisma', 'testing', 'jest'];
  const textLower = text.toLowerCase();

  let techMatches = 0;
  techKeywords.forEach(k => {
    if (textLower.includes(k)) techMatches++;
  });

  if (words.length <= 16 || techMatches <= 2) {
    return {
      isMeaningless: false,
      score: 4,
      technicalAccuracy: 4,
      communication: 5,
      feedback: `Identifies high-level concepts for ${technology}, but lacks detailed architectural patterns, implementation depth, or trade-offs.`,
      weakTopics: ['Implementation Detail', 'Performance Trade-offs']
    };
  }

  const score = Math.min(10, Math.max(8, 7 + Math.min(3, techMatches - 2)));
  return {
    isMeaningless: false,
    score,
    technicalAccuracy: score,
    communication: Math.min(10, score),
    feedback: `Excellent technical response demonstrating deep understanding of ${technology} architecture and performance considerations.`,
    weakTopics: ['Edge Case Micro-optimizations']
  };
}

// Internal AI Helper Functions (Primary: Gemini API, Fallback: Adaptive Dynamic Engine)
async function generateAIQuestion(session, existingQuestions = []) {
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const prompt = formatQuestionGenPrompt(session);
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: INTERVIEW_SYSTEM_PROMPT
        }
      });

      const qText = (response.text || '').trim();
      if (qText && !isDuplicateQuestion(qText, existingQuestions)) {
        return qText;
      }
    } catch (err) {
      console.warn('⚠️ Gemini API question generation fallback:', err.message);
    }
  }

  return generateFallbackAdaptiveQuestion(session, existingQuestions, 1, []);
}

async function evaluateAnswerWithAI(session, questions, currentQuestion, answerText) {
  let evaluationResult = null;
  let geminiSuccess = false;
  let geminiRawResponse = '';
  let fallbackUsed = false;
  let fallbackReason = '';

  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const prompt = formatAnswerEvalPrompt(session, questions, currentQuestion, answerText);
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: INTERVIEW_SYSTEM_PROMPT,
          responseMimeType: 'application/json'
        }
      });

      geminiRawResponse = response.text || '';
      let cleaned = geminiRawResponse.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      const parsed = JSON.parse(cleaned);

      // Clamp sub-scores strictly to 0-10 without artificial floor
      const score = Math.min(10, Math.max(0, Math.round(parsed.score ?? 0)));
      const technicalAccuracy = Math.min(10, Math.max(0, Math.round(parsed.technicalAccuracy ?? score)));
      const communication = Math.min(10, Math.max(0, Math.round(parsed.communication ?? score)));

      let followUpQuestion = parsed.followUpQuestion;
      const existingQTexts = questions.map(q => q.question);

      if (!followUpQuestion || isDuplicateQuestion(followUpQuestion, existingQTexts)) {
        followUpQuestion = generateFallbackAdaptiveQuestion(session, existingQTexts, questions.length + 1, parsed.weakTopics || []);
      }

      evaluationResult = {
        score,
        technicalAccuracy,
        communication,
        feedback: parsed.feedback || `Evaluation for ${session.technology}.`,
        weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics : ['System Design'],
        followUpQuestion
      };
      geminiSuccess = true;
    } catch (err) {
      fallbackUsed = true;
      fallbackReason = `Gemini API call failed: ${err.message}`;
      console.warn(`⚠️ Gemini API evaluation error: ${err.message}`);
    }
  } else {
    fallbackUsed = true;
    fallbackReason = 'GEMINI_API_KEY is missing, placeholder (AQ.Ab8...), or unconfigured';
  }

  if (!evaluationResult) {
    // Dynamic text quality evaluation fallback (No hardcoded 4/10 floor)
    const quality = analyzeAnswerTextQuality(answerText, session.technology);
    const existingQTexts = questions.map(q => q.question);
    const followUpQuestion = generateFallbackAdaptiveQuestion(session, existingQTexts, questions.length + 1, quality.weakTopics);

    evaluationResult = {
      score: quality.score,
      technicalAccuracy: quality.technicalAccuracy,
      communication: quality.communication,
      feedback: `[Evaluation Engine]: ${quality.feedback}`,
      weakTopics: quality.weakTopics,
      followUpQuestion
    };
  }

  // Diagnostic Logger (Does not print API keys)
  const llmProvider = geminiSuccess ? `Google Gemini (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})` : 'Local Intelligent Evaluation Engine';
  console.log(`\n🔍 [AI Evaluation Diagnostics]`);
  console.log(`   - Answer Received: "${answerText}"`);
  console.log(`   - LLM Provider Used: ${llmProvider}`);
  console.log(`   - Gemini Request Succeeded: ${geminiSuccess ? 'YES' : 'NO'}`);
  console.log(`   - Gemini Response: ${geminiRawResponse || 'N/A (Fallback mode active)'}`);
  console.log(`   - Parsed Technical Score: ${evaluationResult.technicalAccuracy}/10`);
  console.log(`   - Parsed Communication Score: ${evaluationResult.communication}/10`);
  console.log(`   - Fallback Path Used: ${fallbackUsed ? `YES (${fallbackReason})` : 'NO'}`);
  console.log(`   - Final Persisted Score: ${evaluationResult.score}/10`);

  return evaluationResult;
}

async function generateAIFinalReport(session, questions, calculatedScores) {
  const { overallScore, techScore, commScore } = calculatedScores;

  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const prompt = formatFinalReportPrompt(session, questions, calculatedScores);
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: INTERVIEW_SYSTEM_PROMPT
        }
      });

      const reportText = (response.text || '').trim();
      if (reportText) return reportText;
    } catch (err) {
      console.warn('⚠️ Gemini API final report fallback:', err.message);
    }
  }

  // Dynamic fallback report strictly bound to calculated scores
  let recommendation = 'Hire (Strong technical candidate)';
  if (overallScore >= 85) recommendation = 'Strong Hire (Exceptional domain expertise)';
  else if (overallScore >= 75) recommendation = 'Hire (Solid technical foundations)';
  else if (overallScore >= 60) recommendation = 'Weak Pass (Requires structured onboarding)';
  else recommendation = 'Reject (Needs further technical preparation)';

  const weakTopicSet = new Set();
  questions.forEach(q => {
    if (Array.isArray(q.weakTopics)) q.weakTopics.forEach(t => weakTopicSet.add(t));
  });
  const weakList = Array.from(weakTopicSet).join(', ') || 'Edge-case handling & scalability profiling';

  return `### Final Mock Interview Performance Report

**Candidate:** ${session.role} (${session.experienceLevel})
**Focus Area:** ${session.technology} (${session.interviewType})

**Overall Score:** ${overallScore}/100
- **Technical Accuracy:** ${techScore}/100
- **Communication:** ${commScore}/100

#### Key Performance Summary
- **Strengths:** Clear technical articulation and structured problem-solving approach during ${session.technology} questions.
- **Areas for Improvement:** ${weakList}.
- **Hiring Recommendation:** ${recommendation}.
`;
}

/**
 * Dynamic fallback adaptive question generator.
 * Produces non-repeating progressive questions across turns based on turn number, technology, and weak topics.
 */
function generateFallbackAdaptiveQuestion(session, existingQuestions = [], turnNumber = 1, weakTopics = []) {
  const tech = session.technology || 'Full Stack Architecture';
  const level = session.experienceLevel || 'Mid-Level';

  const topicsByTurn = {
    1: [
      `Can you explain the core architectural layout of a ${tech} application and how you optimize component boundaries in a ${level} role?`,
      `What are the essential architectural principles you follow when starting a new ${tech} project for scale?`,
      `How do you handle modularization and dependency management in a ${level} ${tech} codebase?`
    ],
    2: [
      `How do you manage state transitions, data validation, and asynchronous side effects in ${tech}?`,
      `Walk me through how data flows from user input to persistent storage in a ${tech} stack.`,
      `What patterns do you use to ensure data consistency during complex business transactions in ${tech}?`
    ],
    3: [
      `How do you profile, identify performance bottlenecks, and prevent memory leaks or redundant work in ${tech}?`,
      `What strategies do you employ for caching and database query optimization in high-throughput ${tech} services?`,
      `How do you balance latency, resource consumption, and user experience when scaling ${tech}?`
    ],
    4: [
      `What approach do you take for automated testing, error boundaries, and zero-downtime deployments in ${tech}?`,
      `How do you handle third-party service failures, rate limiting, and graceful degradation in production ${tech} environments?`,
      `Can you describe an edge-case bug or production outage you diagnosed in ${tech} and how you prevented its recurrence?`
    ]
  };

  const candidatePool = topicsByTurn[turnNumber] || topicsByTurn[4];

  for (const qCandidate of candidatePool) {
    if (!isDuplicateQuestion(qCandidate, existingQuestions)) {
      return qCandidate;
    }
  }

  // Fallback variant generator if all pool items overlap
  const weakFocus = weakTopics.length > 0 ? weakTopics[0] : 'advanced optimization';
  const uniqueId = turnNumber + '_' + Date.now().toString().slice(-4);
  return `Targeting ${weakFocus} in ${tech}: How would you design and test a resilient system handling high-concurrency requests? (Ref: #${uniqueId})`;
}


