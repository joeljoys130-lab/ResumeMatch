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
  const allowedCounts = [5, 10, 15];
  const questionCount = allowedCounts.includes(Number(config.questionCount)) ? Number(config.questionCount) : 5;

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      role,
      experienceLevel,
      technology,
      interviewType,
      questionCount,
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
  const maxQuestions = session.questionCount || 5;

  if (answeredCount < maxQuestions && evaluation.followUpQuestion) {
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
    completed: answeredCount >= maxQuestions
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

  const calculatedScores = { overallScore, techScore, commScore, questionCount: session.questionCount || count };
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
 * Analyzes answer text quality and question relevance to detect gibberish, irrelevant text, buzzword nonsense, or detailed answers.
 */
/**
 * Reusable Question Intent & Dimension Extractor.
 * Dynamically parses ANY question string to extract topic intent and expected explanation dimensions.
 */
export function extractQuestionIntent(questionText = '') {
  const qLower = (questionText || '').toLowerCase();

  // Rule 1: Database Query Optimization & Indexing
  if ((qLower.includes('database') || qLower.includes('db')) && (qLower.includes('optimize') || qLower.includes('query') || qLower.includes('index') || qLower.includes('heavy') || qLower.includes('performance') || qLower.includes('sql') || qLower.includes('mongo'))) {
    return {
      topicIntent: 'Database Query Optimization & Indexing',
      expectedConcepts: [
        'B-Tree / Compound indexing strategy',
        'N+1 query resolution & eager loading',
        'Connection pooling & query profiling'
      ],
      explanationKeywords: ['indexing', 'index', 'indexes', 'b-tree', 'compound index', 'query optimization', 'explain analyze', 'n+1', 'eager loading', 'connection pool', 'connection pooling', 'prisma', 'mongoose', 'join', 'aggregation'],
      passiveMentions: ['postgresql', 'mongodb', 'database', 'table', 'records']
    };
  }

  // Rule 2: File Upload Processing & Streaming
  if (qLower.includes('upload') || qLower.includes('s3') || qLower.includes('file upload') || qLower.includes('files')) {
    return {
      topicIntent: 'File Upload Processing & Stream Management',
      expectedConcepts: [
        'Multipart form parsing (Multer / Busboy)',
        'Cloud storage integration (S3 / Presigned URLs)',
        'Stream processing for large files'
      ],
      explanationKeywords: ['multer', 'busboy', 'multipart', 's3', 'presigned url', 'presigned urls', 'stream', 'streaming', 'pipe', 'blob', 'cloud storage', 'mime', 'size limit'],
      passiveMentions: ['file', 'upload', 'buffer', 'disk']
    };
  }

  // Rule 3: Error Handling, Retries & Resilience
  if (qLower.includes('retry') || qLower.includes('retries') || qLower.includes('circuit breaker') || (qLower.includes('error') && !qLower.includes('boundary'))) {
    return {
      topicIntent: 'Centralized Error Handling & System Resilience',
      expectedConcepts: [
        'Centralized error handling middleware',
        'Custom error classes & HTTP status code mapping',
        'Retry mechanisms & circuit breakers'
      ],
      explanationKeywords: ['centralized error', 'error middleware', 'custom error', 'http status', 'retry', 'retries', 'exponential backoff', 'circuit breaker', 'fallback', 'try/catch', 'jitter'],
      passiveMentions: ['node', 'express', 'api', 'request']
    };
  }

  // Rule 4: Authentication, Authorization & API Security
  if (qLower.includes('auth') || qLower.includes('protect') || qLower.includes('malicious') || qLower.includes('security') || qLower.includes('sanitiz')) {
    return {
      topicIntent: 'Authentication, Authorization & API Security',
      expectedConcepts: [
        'Stateless authentication (JWT / OAuth2 / Cookies)',
        'Role-based access control & token expiration',
        'Input sanitization & defense-in-depth (XSS / SQLi / CSRF)'
      ],
      explanationKeywords: ['jwt', 'oauth', 'bearer', 'token', 'tokens', 'hash', 'bcrypt', 'argon2', 'cookie', 'cookies', 'session', 'sanitize', 'sanitizer', 'helmet', 'rate limit', 'cors', 'xss', 'sqli', 'csrf', 'rbac', 'middleware'],
      passiveMentions: ['api', 'node', 'express', 'react', 'user', 'header']
    };
  }

  // Rule 5: API Versioning & Routing
  if (qLower.includes('version')) {
    return {
      topicIntent: 'API Design & Endpoint Versioning Strategy',
      expectedConcepts: [
        'URI / Header-based API versioning',
        'Backward compatibility & deprecation strategy',
        'RESTful routing standards'
      ],
      explanationKeywords: ['versioning', 'v1', 'header versioning', 'path versioning', 'backward compatibility', 'deprecation', 'semantic versioning', 'router', 'gateway'],
      passiveMentions: ['api', 'node', 'express', 'request', 'response']
    };
  }

  // Rule 6: Concurrency & High Throughput
  if (qLower.includes('concurrent') || qLower.includes('throughput') || qLower.includes('concurrency')) {
    return {
      topicIntent: 'High-Concurrency Request Handling & System Throughput',
      expectedConcepts: [
        'Asynchronous event loop & non-blocking I/O',
        'Rate limiting & request queuing (Redis / Leaky bucket)',
        'Horizontal worker scaling & cluster mode'
      ],
      explanationKeywords: ['non-blocking', 'event loop', 'rate limit', 'queue', 'bullmq', 'redis', 'cluster', 'worker threads', 'horizontal scaling', 'load balancing'],
      passiveMentions: ['node', 'server', 'request', 'concurrency']
    };
  }

  // Rule 7: Logging, Observability & Telemetry
  if (qLower.includes('log') || qLower.includes('observability') || qLower.includes('monitoring') || qLower.includes('telemetry')) {
    return {
      topicIntent: 'Logging, Distributed Tracing & Observability',
      expectedConcepts: [
        'Structured logging (Winston / Pino)',
        'Correlation IDs & distributed tracing',
        'APM monitoring & metrics (Prometheus / Grafana)'
      ],
      explanationKeywords: ['winston', 'pino', 'structured log', 'structured logging', 'correlation id', 'tracing', 'opentelemetry', 'prometheus', 'grafana', 'apm', 'metrics'],
      passiveMentions: ['log', 'monitoring', 'server', 'application']
    };
  }

  // Rule 8: Reusable UI Components
  if (qLower.includes('reusable') || qLower.includes('design system')) {
    return {
      topicIntent: 'Reusable Component Architecture & UI Design Patterns',
      expectedConcepts: [
        'Compound components & render props',
        'Separation of container vs presentational components',
        'Prop-types / TypeScript interface design'
      ],
      explanationKeywords: ['compound component', 'custom hook', 'custom hooks', 'composition', 'props', 'typescript', 'interface', 'container component', 'design system', 'reusable', 'separate presentation'],
      passiveMentions: ['react', 'ui', 'view', 'style']
    };
  }

  // Rule 9: State Transitions, Data Validation & Asynchronous Operations
  if (qLower.includes('state') || qLower.includes('validation') || qLower.includes('validate') || qLower.includes('validating') || qLower.includes('side effect') || qLower.includes('transitions')) {
    return {
      topicIntent: 'State Transitions, Data Validation & Asynchronous Operations',
      expectedConcepts: [
        'React state management (useState / useReducer)',
        'Predictable state transitions & reducers',
        'Frontend / Backend data validation (Zod / Joi / Schema)',
        'Async side-effect handling & loading/error states'
      ],
      explanationKeywords: ['usestate', 'usereducer', 'reducer', 'actions', 'zod', 'joi', 'schema validation', 'client validation', 'backend validation', 'side effect', 'loading state', 'error state', 'try/catch', 'validate', 'validates', 'validation'],
      passiveMentions: ['props', 'api', 'component', 'promises', 'backend', 'frontend', 'async', 'asynchronous']
    };
  }

  // Rule 10: Automated Testing, Error Boundaries & Deployments
  if (qLower.includes('test') || qLower.includes('boundary') || qLower.includes('downtime') || qLower.includes('deployment')) {
    return {
      topicIntent: 'Automated Testing, Error Boundaries & Zero-Downtime Deployments',
      expectedConcepts: [
        'Automated testing strategy (Jest / Supertest / Vitest)',
        'React Error Boundaries (ComponentDidCatch / Fallback UI)',
        'Zero-downtime deployment strategy (Rolling / Blue-Green / Health checks)'
      ],
      explanationKeywords: ['jest', 'supertest', 'vitest', 'unit test', 'unit testing', 'integration test', 'integration testing', 'errorboundary', 'error boundary', 'fallback ui', 'componentdidcatch', 'zero downtime', 'rolling', 'blue-green', 'health check', 'ci/cd', 'e2e test'],
      passiveMentions: ['react', 'node', 'api', 'component', 'state', 'service']
    };
  }

  // Rule 11: Profiling, Memory Leaks, Performance Bottlenecks & Rendering
  if (qLower.includes('profile') || qLower.includes('leak') || qLower.includes('bottleneck') || qLower.includes('memory') || qLower.includes('render')) {
    return {
      topicIntent: 'Performance Profiling, Bottleneck Detection & Memory Leak Prevention',
      expectedConcepts: [
        'Performance profiling tools (Chrome DevTools / React Profiler / Node Inspector)',
        'Memory leak detection & event listener/useEffect cleanup',
        'Render optimization & memoization (useMemo, useCallback, React.memo)'
      ],
      explanationKeywords: ['devtools', 'profiler', 'heap snapshot', 'memoization', 'usememo', 'usecallback', 'react.memo', 'cleanup', 'clean up', 'unmount', 'unmounts', 'event listener', 'event listeners', 'subscription', 'subscriptions', 'timer', 'timers', 'unnecessary re-renders', 'avoidable updates', 'bundle size', 'lazy loading', 'query optimization'],
      passiveMentions: ['react', 'node', 'component', 'api', 'state', 'redis', 'postgresql']
    };
  }

  // Rule 12: Scalable Architecture Principles & Modularity
  if (qLower.includes('architectur') || qLower.includes('scale') || qLower.includes('modular') || qLower.includes('structure')) {
    return {
      topicIntent: 'Scalable Architecture Principles & Modularity',
      expectedConcepts: [
        'Layered architecture & separation of concerns (Routes, Controllers, Services)',
        'Component modularity & decoupling presentation from business logic',
        'Scalability strategy & dependency management'
      ],
      explanationKeywords: ['component-based', 'component composition', 'event-driven', 'non-blocking', 'layered architecture', 'separation of concerns', 'decoupled', 'uncoupled', 'dependency management', 'dependency injection', 'domain driven', 'clean controller', 'stateless api', 'horizontal scaling', 'microservices', 'modular', 'separate presentation', 'business logic'],
      passiveMentions: ['react', 'node', 'component', 'props', 'api', 'docker', 'redis', 'mongodb', 'kubernetes']
    };
  }

  // General dynamic fallback for any other unseen question string
  const tokens = qLower
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['how', 'do', 'you', 'the', 'and', 'for', 'can', 'explain', 'what', 'with', 'in', 'your', 'about', 'role', 'take', 'which', 'application', 'approach', 'would', 'handle', 'design', 'protect'].includes(w));

  return {
    topicIntent: `Domain Mastery on ${tokens.slice(0, 3).join(' ')}`,
    expectedConcepts: tokens.slice(0, 4).map(t => `${t} implementation & design trade-offs`),
    explanationKeywords: tokens.slice(0, 4),
    passiveMentions: ['component', 'service', 'api', 'database']
  };
}

/**
 * Analyzes answer text quality and question relevance to detect gibberish, irrelevant text, buzzword nonsense, or detailed answers.
 */
export function analyzeAnswerTextQuality(answerText = '', technology = '', questionText = '') {
  const text = (answerText || '').trim();
  const intent = extractQuestionIntent(questionText);

  if (!text) {
    return {
      isMeaningless: true,
      score: 0,
      technicalAccuracy: 0,
      communication: 0,
      relevance: 0,
      feedback: '[Evaluation Engine]: No answer text was submitted. Please provide a relevant technical response.',
      weakTopics: ['Core Technical Communication'],
      detectedQuestionIntent: intent.topicIntent,
      expectedConcepts: intent.expectedConcepts,
      explainedConcepts: [],
      merelyMentionedConcepts: [],
      missingConcepts: intent.expectedConcepts,
      unrelatedConcepts: [],
      answerDepth: 'No Answer',
      contradictionDetected: false,
      buzzwordDumpDetected: false,
      metaTestTextDetected: false
    };
  }

  const textLower = text.toLowerCase();

  // 1. Meta / Test Instruction Text Detection
  const metaPhrases = [
    'for testing whether your scoring system',
    'these should be scored low',
    'use this to test the evaluator',
    'question:',
    'answer:',
    'this is a test'
  ];
  const metaTestTextDetected = metaPhrases.some(p => textLower.includes(p));
  if (metaTestTextDetected) {
    return {
      isMeaningless: false,
      score: 1,
      technicalAccuracy: 1,
      communication: 2,
      relevance: 1,
      feedback: '[Evaluation Engine]: Detected test/instruction meta-text rather than a candidate interview response.',
      weakTopics: ['Interview Context & Focus'],
      detectedQuestionIntent: intent.topicIntent,
      expectedConcepts: intent.expectedConcepts,
      explainedConcepts: [],
      merelyMentionedConcepts: [],
      missingConcepts: intent.expectedConcepts,
      unrelatedConcepts: [],
      answerDepth: 'Meta / Instruction Text',
      contradictionDetected: false,
      buzzwordDumpDetected: false,
      metaTestTextDetected: true
    };
  }

  // 2. Gibberish & Keyboard Pattern Detection (e.g., "asdfghjkl", ";kdjfn", "qwrtyopojhvc")
  const mashPatterns = [/asdfgh/i, /qwerty/i, /zxcvbn/i, /dfghjk/i, /fghuio/i, /ertyui/i, /rtyopo/i, /;kdjfn/i, /wefghj/i];
  if (mashPatterns.some(p => p.test(text))) {
    return {
      isMeaningless: true,
      score: 1,
      technicalAccuracy: 0,
      communication: 1,
      relevance: 0,
      feedback: '[Evaluation Engine]: The submitted response consists of random key patterns or keyboard mash and does not answer the technical question.',
      weakTopics: ['Technical Articulation', 'Core Domain Concepts'],
      detectedQuestionIntent: intent.topicIntent,
      expectedConcepts: intent.expectedConcepts,
      explainedConcepts: [],
      merelyMentionedConcepts: [],
      missingConcepts: intent.expectedConcepts,
      unrelatedConcepts: [],
      answerDepth: 'Gibberish Key Patterns',
      contradictionDetected: false,
      buzzwordDumpDetected: false,
      metaTestTextDetected: false
    };
  }

  const words = text.split(/\s+/).filter(Boolean);
  const totalLength = text.length;

  if (words.length === 1 && totalLength >= 5) {
    const vowels = (text.match(/[aeiou]/gi) || []).length;
    const vowelRatio = vowels / totalLength;
    if (vowelRatio < 0.15 || vowelRatio > 0.75) {
      return {
        isMeaningless: true,
        score: 0,
        technicalAccuracy: 0,
        communication: 0,
        relevance: 0,
        feedback: '[Evaluation Engine]: The response contains no readable words or technical concepts.',
        weakTopics: ['Basic Technical Communication'],
        detectedQuestionIntent: intent.topicIntent,
        expectedConcepts: intent.expectedConcepts,
        explainedConcepts: [],
        merelyMentionedConcepts: [],
        missingConcepts: intent.expectedConcepts,
        unrelatedConcepts: [],
        answerDepth: 'Single Word Gibberish',
        contradictionDetected: false,
        buzzwordDumpDetected: false,
        metaTestTextDetected: false
      };
    }
  }

  // 3. Contradiction & Anti-Pattern Detection (Excludes positive negations like "don't ignore validation" or "never skip")
  const positiveNegations = [
    "don't ignore", "never skip", "don't skip", "never avoid", "never ignore", "should not ignore", "must not skip", "cannot skip"
  ];
  const isPositiveNegation = positiveNegations.some(p => textLower.includes(p));

  const contradictionPhrases = [
    "don't follow architectural", "don't really follow any architectural", "no architectural principles", "don't care about architectural",
    "tightly coupled", "single large component", "one giant component", "one large component",
    "avoid separating services", "avoid separating modules", "don't worry about scalability", "don't worry about security", "don't worry about validation",
    "don't validate", "no validation", "don't use automated tests", "avoid automated testing", "don't handle errors", "no security at all"
  ];

  const contradictionDetected = !isPositiveNegation && contradictionPhrases.some(p => textLower.includes(p));

  if (contradictionDetected) {
    return {
      isMeaningless: false,
      score: 1,
      technicalAccuracy: 1,
      communication: 2,
      relevance: 1,
      feedback: '[Evaluation Engine]: The answer explicitly contradicts core engineering principles, rejecting required architecture, testing, or security standards.',
      weakTopics: ['Software Architecture Principles', 'Engineering Best Practices'],
      detectedQuestionIntent: intent.topicIntent,
      expectedConcepts: intent.expectedConcepts,
      explainedConcepts: [],
      merelyMentionedConcepts: [],
      missingConcepts: intent.expectedConcepts,
      unrelatedConcepts: [],
      answerDepth: 'Contradictory / Anti-Pattern',
      contradictionDetected: true,
      buzzwordDumpDetected: false,
      metaTestTextDetected: false
    };
  }

  // 4. Question Concept Explanation vs Mere Mention Classifier
  const explainedConcepts = [];
  const merelyMentionedConcepts = [];
  const missingConcepts = [];
  const unrelatedConcepts = [];

  // Match explained concepts
  intent.explanationKeywords.forEach(k => {
    if (textLower.includes(k.toLowerCase())) {
      if (!explainedConcepts.includes(k)) explainedConcepts.push(k);
    }
  });

  // Match passive mentions
  intent.passiveMentions.forEach(p => {
    if (textLower.includes(p.toLowerCase()) && !explainedConcepts.some(ec => ec.toLowerCase().includes(p.toLowerCase()))) {
      if (!merelyMentionedConcepts.includes(p)) merelyMentionedConcepts.push(p);
    }
  });

  // Identify missing expected concepts
  intent.expectedConcepts.forEach(ec => {
    const ecLower = ec.toLowerCase();
    if (!explainedConcepts.some(k => ecLower.includes(k.toLowerCase()))) {
      missingConcepts.push(ec);
    }
  });

  // Check for unrelated infrastructure/tech list terms (e.g. MongoDB, Redis, Docker, Kubernetes, JWT, PostgreSQL)
  const infrastructureTerms = ['mongodb', 'redis', 'kubernetes', 'docker', 'jwt', 'postgresql', 'prisma', 'api gateway', 'git'];
  infrastructureTerms.forEach(term => {
    if (textLower.includes(term)) {
      if (!intent.explanationKeywords.some(k => k.toLowerCase().includes(term))) {
        unrelatedConcepts.push(term);
      }
    }
  });

  const buzzwordDumpDetected = unrelatedConcepts.length >= 3 && explainedConcepts.length <= 1;

  // 5. Answer Depth & Calibration
  let answerDepth = 'Shallow';
  let score = 3;
  let relevance = 3;
  let technicalAccuracy = 3;
  let communication = 4;
  let feedback = '';

  if (buzzwordDumpDetected || (unrelatedConcepts.length >= 1 && explainedConcepts.length === 0)) {
    answerDepth = buzzwordDumpDetected ? 'Unrelated Technical Buzzword Dump' : 'Unrelated Technical Answer';
    score = 2;
    relevance = 1;
    technicalAccuracy = 1;
    communication = 2;
    feedback = buzzwordDumpDetected
      ? '[Evaluation Engine]: Answer lists unrelated infrastructure and technology names without explaining the requested question concepts.'
      : '[Evaluation Engine]: Answer mentions technical concepts that fail to address the requested question intent.';
  } else if (explainedConcepts.length === 0 && merelyMentionedConcepts.length === 0) {
    answerDepth = 'Unrelated Natural Language';
    score = 1;
    relevance = 1;
    technicalAccuracy = 1;
    communication = 1;
    feedback = '[Evaluation Engine]: Answer is completely unrelated to the technical question asked.';
  } else if (explainedConcepts.length === 0 && merelyMentionedConcepts.length > 0) {
    answerDepth = 'Relevant Shallow (Mere Mentions)';
    score = 3;
    relevance = 3;
    technicalAccuracy = 3;
    communication = 4;
    feedback = '[Evaluation Engine]: Mentions high-level technology names but fails to explain or demonstrate the requested mechanisms.';
  } else if (explainedConcepts.length === 1 && intent.expectedConcepts.length >= 3) {
    // Answer addresses only 1 single sub-concept of a multi-dimensional question (Incomplete Partial Answer)
    answerDepth = 'Incomplete Partial Answer';
    score = 4;
    relevance = 4;
    technicalAccuracy = 4;
    communication = 5;
    feedback = '[Evaluation Engine]: Correctly addresses a subset of the question, but omits key required technical dimensions.';
  } else if (explainedConcepts.length >= 1 && explainedConcepts.length <= 2) {
    answerDepth = 'Relevant & Adequately Explained';
    score = 6;
    relevance = 6;
    technicalAccuracy = 6;
    communication = 6;
    feedback = `[Evaluation Engine]: Demonstrated adequate technical explanation for ${technology}.`;
  } else {
    // 3+ explained concepts or detailed question-focused explanation
    answerDepth = 'Detailed & Question-Focused';
    relevance = Math.min(10, Math.max(8, 7 + Math.min(3, explainedConcepts.length)));
    technicalAccuracy = Math.min(10, Math.max(8, 7 + Math.min(3, explainedConcepts.length)));
    communication = Math.min(10, 8 + Math.min(2, Math.floor(words.length / 30)));
    score = Math.round(relevance * 0.45 + technicalAccuracy * 0.40 + communication * 0.15);
    feedback = `[Evaluation Engine]: Demonstrated strong, detailed technical mastery for ${technology}.`;
  }

  return {
    isMeaningless: score <= 2,
    score,
    technicalAccuracy,
    communication,
    relevance,
    feedback,
    weakTopics: missingConcepts.length > 0 ? missingConcepts : ['Edge Case Optimization'],
    detectedQuestionIntent: intent.topicIntent,
    expectedConcepts: intent.expectedConcepts,
    explainedConcepts,
    merelyMentionedConcepts,
    missingConcepts,
    unrelatedConcepts,
    answerDepth,
    contradictionDetected: false,
    buzzwordDumpDetected,
    metaTestTextDetected: false
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
  let qualityDiagnostics = null;

  const intent = extractQuestionIntent(currentQuestion.question);

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
      const relevance = Math.min(10, Math.max(0, Math.round(parsed.relevance ?? 0)));
      const technicalAccuracy = Math.min(10, Math.max(0, Math.round(parsed.technicalAccuracy ?? 0)));
      const communication = Math.min(10, Math.max(0, Math.round(parsed.communication ?? 0)));

      let score = parsed.score !== undefined && parsed.score !== null
        ? Math.min(10, Math.max(0, Math.round(parsed.score)))
        : Math.round(relevance * 0.45 + technicalAccuracy * 0.40 + communication * 0.15);

      // Apply hard failure caps if contradiction, buzzword dump, or meta text was detected
      if (parsed.contradictionDetected || parsed.buzzwordDumpDetected || parsed.metaTestTextDetected) {
        score = Math.min(2, score);
      }

      let followUpQuestion = parsed.followUpQuestion;
      const existingQTexts = questions.map(q => q.question);

      if (!followUpQuestion || isDuplicateQuestion(followUpQuestion, existingQTexts)) {
        followUpQuestion = generateFallbackAdaptiveQuestion(session, existingQTexts, questions.length + 1, parsed.weakTopics || []);
      }

      evaluationResult = {
        score,
        technicalAccuracy,
        communication,
        relevance,
        feedback: parsed.feedback || `Evaluation for ${session.technology}.`,
        weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics : ['System Design'],
        followUpQuestion
      };
      geminiSuccess = true;
      qualityDiagnostics = {
        detectedQuestionIntent: parsed.detectedQuestionIntent || intent.topicIntent,
        expectedConcepts: parsed.expectedConcepts || intent.expectedConcepts,
        explainedConcepts: parsed.explainedConcepts || [],
        merelyMentionedConcepts: parsed.merelyMentionedConcepts || [],
        missingConcepts: parsed.missingConcepts || intent.expectedConcepts,
        unrelatedConcepts: parsed.unrelatedConcepts || [],
        answerDepth: parsed.answerDepth || (relevance >= 8 ? 'Detailed' : 'Adequately Explained'),
        contradictionDetected: Boolean(parsed.contradictionDetected),
        buzzwordDumpDetected: Boolean(parsed.buzzwordDumpDetected),
        metaTestTextDetected: Boolean(parsed.metaTestTextDetected)
      };
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
    // Dynamic text quality and question relevance evaluation fallback
    const quality = analyzeAnswerTextQuality(answerText, session.technology, currentQuestion.question);
    qualityDiagnostics = quality;
    const existingQTexts = questions.map(q => q.question);
    const followUpQuestion = generateFallbackAdaptiveQuestion(session, existingQTexts, questions.length + 1, quality.weakTopics);

    evaluationResult = {
      score: quality.score,
      technicalAccuracy: quality.technicalAccuracy,
      communication: quality.communication,
      relevance: quality.relevance,
      feedback: `${quality.feedback}`,
      weakTopics: quality.weakTopics,
      followUpQuestion
    };
  }

  // Structured Diagnostic Logger (Does not log API keys, secrets, or passwords)
  const llmProvider = geminiSuccess ? `Google Gemini (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})` : 'Local Intelligent Evaluation Engine';
  console.log(`\n🔍 [AI Evaluation Diagnostics]`);
  console.log(JSON.stringify({
    question: currentQuestion.question,
    answer: answerText,
    provider: llmProvider,
    detectedQuestionIntent: qualityDiagnostics?.detectedQuestionIntent || intent.topicIntent,
    expectedConcepts: qualityDiagnostics?.expectedConcepts || intent.expectedConcepts,
    explainedConcepts: qualityDiagnostics?.explainedConcepts || [],
    merelyMentionedConcepts: qualityDiagnostics?.merelyMentionedConcepts || [],
    missingConcepts: qualityDiagnostics?.missingConcepts || [],
    unrelatedConcepts: qualityDiagnostics?.unrelatedConcepts || [],
    contradictionDetected: qualityDiagnostics?.contradictionDetected || false,
    buzzwordDumpDetected: qualityDiagnostics?.buzzwordDumpDetected || false,
    metaTestTextDetected: qualityDiagnostics?.metaTestTextDetected || false,
    answerDepth: qualityDiagnostics?.answerDepth || 'Evaluated',
    semanticRelevance: evaluationResult.relevance,
    technicalAccuracy: evaluationResult.technicalAccuracy,
    communication: evaluationResult.communication,
    finalScore: evaluationResult.score
  }, null, 2));

  return evaluationResult;
}

async function generateAIFinalReport(session, questions, calculatedScores) {
  const { overallScore, techScore, commScore, questionCount = questions.length } = calculatedScores;

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

  const strengthsText = overallScore >= 60
    ? 'Clear technical articulation and structured problem-solving approach during technical questions.'
    : 'Attempted responses across interview turns, but failed to demonstrate sufficient technical accuracy or question relevance.';

  return `### Final Mock Interview Performance Report

**Candidate:** ${session.role} (${session.experienceLevel})
**Focus Area:** ${session.technology} (${session.interviewType})
**Questions Completed:** ${questions.length} / ${questionCount}

**Overall Score:** ${overallScore}/100
- **Technical Accuracy:** ${techScore}/100
- **Communication:** ${commScore}/100

#### Key Performance Summary
- **Strengths:** ${strengthsText}
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

  const poolKey = Math.min(4, Math.max(1, turnNumber % 4 === 0 ? 4 : turnNumber % 4));
  const candidatePool = topicsByTurn[poolKey] || topicsByTurn[4];

  for (const qCandidate of candidatePool) {
    if (!isDuplicateQuestion(qCandidate, existingQuestions)) {
      return qCandidate;
    }
  }

  // Fallback variant generator if all pool items overlap
  const weakFocus = weakTopics.length > 0 ? weakTopics[0] : 'advanced optimization';
  const uniqueId = turnNumber + '_' + Date.now().toString().slice(-4);
  return `Targeting ${weakFocus} in ${tech} (Turn #${turnNumber}): How would you design, test, and profile a resilient system handling high-concurrency requests? (Ref: #${uniqueId})`;
}
