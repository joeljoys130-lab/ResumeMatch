import getAnthropicClient from '../config/anthropic.js';
import { sanitizeInput } from './sanitizer.js';
import { RESUME_ANALYSIS_SYSTEM_PROMPT, formatAnalysisUserPrompt } from '../prompts/analysisPrompt.js';
import { resumeAnalysisOutputSchema } from '../utils/validators.js';
import { calculateLLMCost } from '../utils/hashes.js';
import { LLMResponseError } from '../utils/errors.js';
import LLMResponse from '../models/LLMResponse.js';

export async function analyzeResumeWithClaude(resumeText, jobDescriptionText, userId = null) {
  const startTime = Date.now();

  // 1. Sanitize inputs
  const sanitizedResume = sanitizeInput(resumeText).cleanedText;
  const sanitizedJD = sanitizeInput(jobDescriptionText).cleanedText;

  const client = getAnthropicClient();

  // If no Anthropic API key is configured, provide a realistic deterministic calculation fallback for local testing
  if (!client) {
    console.warn('ℹ️ ANTHROPIC_API_KEY missing/dummy. Using local intelligent rule-based analysis engine.');
    return generateFallbackAnalysis(sanitizedResume, sanitizedJD, userId, startTime);
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const userPrompt = formatAnalysisUserPrompt(sanitizedResume, sanitizedJD);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      temperature: 0.2,
      system: RESUME_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const latencyMs = Date.now() - startTime;
    const rawText = response.content[0]?.text || '';
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateLLMCost(inputTokens, outputTokens, model);

    let parsedResult;
    try {
      parsedResult = parseAndValidateAnalysisOutput(rawText);
    } catch (parseErr) {
      console.warn('⚠️ First-pass LLM JSON parse failed. Attempting 1-step correction retry...');
      parsedResult = await retryAnalysisCorrection(client, model, rawText, parseErr.message);
    }

    // Log LLM call metrics into MongoDB LLMResponse
    await logLLMResponseMetric({
      userId,
      feature: 'ANALYSIS',
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      latencyMs,
      cached: false,
      success: true
    });

    return {
      result: parsedResult,
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        model,
        latencyMs,
        cached: false
      }
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    await logLLMResponseMetric({
      userId,
      feature: 'ANALYSIS',
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      latencyMs,
      cached: false,
      success: false,
      errorCode: err.code || 'LLM_ERROR'
    });

    if (err instanceof LLMResponseError) throw err;
    console.error('❌ Anthropic Claude API error:', err.message);
    throw new LLMResponseError(`Claude AI analysis service error: ${err.message}`);
  }
}

/**
 * Robust JSON extraction & Zod validation
 */
function parseAndValidateAnalysisOutput(rawText) {
  let cleaned = rawText.trim();
  // Strip code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(cleaned);
  const validated = resumeAnalysisOutputSchema.parse(parsed);
  return validated;
}

/**
 * 1-step automatic correction retry if JSON output is malformed
 */
async function retryAnalysisCorrection(client, model, malformedText, errorMessage) {
  const retryPrompt = `
Your previous response failed JSON schema validation with error: "${errorMessage}".

Here was your previous response:
${malformedText}

Please fix the response and return ONLY valid, raw JSON adhering to the required schema:
{
  "matchScore": number (0-100),
  "atsScore": number (0-100),
  "experienceMatch": "string",
  "matchedSkills": ["string"],
  "missingSkills": ["string"],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"],
  "summary": "string"
}
`;

  const retryResponse = await client.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.1,
    messages: [{ role: 'user', content: retryPrompt }]
  });

  const retryText = retryResponse.content[0]?.text || '';
  return parseAndValidateAnalysisOutput(retryText);
}

/**
 * Intelligent evidence-based resume-to-JD analyzer engine.
 * Evaluates actual evidence, section locations, evidence levels (0-4),
 * keyword-stuffing defense, transferable skills, responsibility matching,
 * and independent ATS readability scoring without hallucinations.
 */
export function generateFallbackAnalysis(resumeText, jobDescriptionText, userId = null, startTime = Date.now()) {
  const latencyMs = Date.now() - startTime;
  const resumeRaw = (resumeText || '').trim();
  const jdRaw = (jobDescriptionText || '').trim();
  const resumeLower = resumeRaw.toLowerCase();
  const jdLower = jdRaw.toLowerCase();

  // 1. Parse Resume Sections (Work Experience, Projects, Skills, Education, Summary)
  const sections = parseResumeSections(resumeRaw);

  // 2. Extract Job Description Requirements across standard categories
  const requirements = extractJDRequirements(jdRaw);

  // 3. Match each requirement against resume sections to determine Evidence Level (0-4)
  const requirementMatches = requirements.map(req => evaluateRequirementEvidence(req, sections, resumeLower));

  // 4. Categorize skills by status
  const matchedSkills = [];       // Level 3-4 (Explicitly Demonstrated)
  const mentionedSkills = [];     // Level 1 (Skills section only)
  const transferableSkills = [];  // Related/Transferable
  const missingSkills = [];       // Level 0 (Missing)

  requirementMatches.forEach(rm => {
    if (rm.status === 'demonstrated') {
      matchedSkills.push(rm.requirement);
    } else if (rm.status === 'mentioned') {
      mentionedSkills.push(rm.requirement);
    } else if (rm.status === 'related') {
      transferableSkills.push(rm.requirement);
    } else if (rm.status === 'missing') {
      missingSkills.push(rm.requirement);
    }
  });

  // 5. Calculate Weighted Compatibility Match Score
  let totalWeight = 0;
  let weightedScoreSum = 0;

  requirementMatches.forEach(rm => {
    const weight = rm.importance === 'critical' ? 1.5 : (rm.importance === 'important' ? 1.0 : 0.6);
    let levelCredit = 0;
    if (rm.evidenceLevel === 4) levelCredit = 1.0;
    else if (rm.evidenceLevel === 3) levelCredit = 0.85;
    else if (rm.evidenceLevel === 2) levelCredit = 0.50;
    else if (rm.evidenceLevel === 1) levelCredit = 0.20; // Mentioned only in skills list
    else if (rm.status === 'related') levelCredit = 0.35; // Transferable
    else levelCredit = 0.0; // Missing

    weightedScoreSum += weight * levelCredit;
    totalWeight += weight;
  });

  let baseEvidenceScore = totalWeight > 0 ? Math.round((weightedScoreSum / totalWeight) * 100) : 50;

  // 6. Keyword-Stuffing Defense & Cap
  const demonstratedCount = matchedSkills.length;
  const mentionedCount = mentionedSkills.length;
  const criticalRequirements = requirementMatches.filter(rm => rm.importance === 'critical');
  const demonstratedCriticalCount = criticalRequirements.filter(rm => rm.status === 'demonstrated').length;

  let keywordStuffingCapApplied = false;
  if (mentionedCount > demonstratedCount * 1.2 && (demonstratedCriticalCount / Math.max(1, criticalRequirements.length)) < 0.4) {
    keywordStuffingCapApplied = true;
    baseEvidenceScore = Math.min(55, baseEvidenceScore);
  }

  // Final Match Score clamped strictly to 0-100
  const matchScore = Math.min(100, Math.max(0, baseEvidenceScore));

  // 7. Calculate Independent ATS Readability Score (Completely separate from matchScore)
  const atsScore = calculateATSReadabilityScore(resumeRaw);

  // 8. Generate Evidence-Grounded Feedback (Zero Hallucinations)
  const { strengths, weaknesses, recommendations, experienceMatch, summary } = generateEvidenceGroundedFeedback(
    matchScore,
    atsScore,
    requirementMatches,
    matchedSkills,
    mentionedSkills,
    transferableSkills,
    missingSkills,
    sections,
    keywordStuffingCapApplied
  );

  const scoringBreakdown = {
    demonstratedCount: matchedSkills.length,
    mentionedCount: mentionedSkills.length,
    relatedCount: transferableSkills.length,
    missingCount: missingSkills.length,
    keywordStuffingCapApplied,
    baseEvidenceScore: matchScore,
    atsReadabilityScore: atsScore
  };

  // 9. Structured Diagnostic Logger
  console.log(`\n📊 [Resume Match Diagnostics]`);
  console.log(JSON.stringify({
    userId,
    overallScore: matchScore,
    atsScore,
    totalRequirements: requirementMatches.length,
    demonstratedRequirements: matchedSkills.length,
    mentionedRequirements: mentionedSkills.length,
    relatedRequirements: transferableSkills.length,
    missingRequirements: missingSkills.length,
    keywordStuffingCapApplied,
    scoringBreakdown
  }, null, 2));

  const result = {
    matchScore,
    atsScore,
    experienceMatch,
    matchedSkills,
    mentionedSkills,
    transferableSkills,
    missingSkills,
    requirementMatches,
    strengths,
    weaknesses,
    recommendations,
    summary,
    scoringBreakdown
  };

  return {
    result,
    tokenUsage: {
      inputTokens: Math.round(resumeRaw.length / 4),
      outputTokens: 400,
      totalTokens: Math.round(resumeRaw.length / 4) + 400,
      estimatedCost: 0.0015,
      model: 'local-intelligent-evidence-engine',
      latencyMs,
      cached: false
    }
  };
}

/**
 * Parses resume text into discrete section blocks.
 */
function parseResumeSections(text) {
  const lines = text.split('\n');
  const sections = {
    workExperience: '',
    projects: '',
    skills: '',
    education: '',
    summary: '',
    fullText: text
  };

  let currentSection = 'summary';

  lines.forEach(line => {
    const trimmed = line.trim();
    const lineLower = trimmed.toLowerCase();

    if (/^(work\s+experience|professional\s+experience|experience|employment\s+history|work\s+history)/i.test(trimmed)) {
      currentSection = 'workExperience';
    } else if (/^(projects|key\s+projects|academic\s+projects|personal\s+projects)/i.test(trimmed)) {
      currentSection = 'projects';
    } else if (/^(technical\s+skills|skills|core\s+competencies|technologies|tools)/i.test(trimmed)) {
      currentSection = 'skills';
    } else if (/^(education|academic\s+background|certifications|degrees)/i.test(trimmed)) {
      currentSection = 'education';
    } else if (/^(summary|profile|executive\s+summary|objective)/i.test(trimmed)) {
      currentSection = 'summary';
    } else {
      sections[currentSection] += '\n' + line;
    }
  });

  return sections;
}

/**
 * Dynamically extracts job requirements from JD text across key categories.
 */
function extractJDRequirements(jdText) {
  const jdLower = jdText.toLowerCase();
  const requirements = [];

  const catalog = [
    // Core Tech
    { name: 'React', keywords: ['react', 'react.js'], category: 'Frontend', importance: 'critical' },
    { name: 'Node.js', keywords: ['node.js', 'node'], category: 'Backend', importance: 'critical' },
    { name: 'TypeScript', keywords: ['typescript', 'ts'], category: 'Languages', importance: 'important' },
    { name: 'JavaScript', keywords: ['javascript', 'js', 'es6'], category: 'Languages', importance: 'important' },

    // Frameworks & Backend
    { name: 'Express.js', keywords: ['express', 'express.js'], category: 'Backend', importance: 'important' },
    { name: 'Nest.js', keywords: ['nest.js', 'nestjs', 'nest'], category: 'Backend', importance: 'important' },
    { name: 'GraphQL', keywords: ['graphql'], category: 'API', importance: 'important' },
    { name: 'REST APIs', keywords: ['rest', 'restful', 'rest api', 'rest apis'], category: 'API', importance: 'critical' },

    // Databases
    { name: 'PostgreSQL', keywords: ['postgresql', 'postgres'], category: 'Databases', importance: 'important' },
    { name: 'MongoDB', keywords: ['mongodb', 'mongo'], category: 'Databases', importance: 'important' },
    { name: 'Redis', keywords: ['redis'], category: 'Databases & Caching', importance: 'important' },

    // DevOps & Infrastructure
    { name: 'Docker', keywords: ['docker', 'containerization', 'containers'], category: 'DevOps', importance: 'important' },
    { name: 'Kubernetes', keywords: ['kubernetes', 'k8s'], category: 'DevOps', importance: 'important' },
    { name: 'AWS', keywords: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'], category: 'Cloud', importance: 'important' },
    { name: 'CI/CD', keywords: ['ci/cd', 'github actions', 'jenkins', 'pipeline', 'deployment pipeline'], category: 'DevOps', importance: 'important' },

    // Architecture & Engineering Practices
    { name: 'Microservices', keywords: ['microservices', 'microservice', 'distributed systems'], category: 'Architecture', importance: 'critical' },
    { name: 'System Design', keywords: ['system design', 'scalable architecture', 'high-scale'], category: 'Architecture', importance: 'critical' },
    { name: 'Cloud-Native Architecture', keywords: ['cloud-native', 'cloud native'], category: 'Architecture', importance: 'important' },
    { name: 'Event-Driven Architecture', keywords: ['event-driven', 'event driven', 'kafka', 'rabbitmq'], category: 'Architecture', importance: 'important' },
    { name: 'Monitoring & Observability', keywords: ['monitoring', 'logging', 'observability', 'winston', 'prometheus', 'datadog'], category: 'Observability', importance: 'important' },
    { name: 'OWASP & Security Principles', keywords: ['owasp', 'security', 'sanitization', 'vulnerability'], category: 'Security', importance: 'important' },
    { name: 'Automated Testing', keywords: ['unit testing', 'integration testing', 'jest', 'vitest', 'supertest', 'automated testing'], category: 'Testing', importance: 'important' },
    { name: 'Performance Optimization', keywords: ['performance optimization', 'profiling', 'memory leaks', 'memoization'], category: 'Performance', importance: 'important' },
    { name: 'Authentication & Authorization', keywords: ['jwt', 'oauth', 'authentication', 'authorization', 'rbac'], category: 'Security', importance: 'important' },

    // Responsibilities & Leadership
    { name: 'Mentoring Junior Developers', keywords: ['mentor', 'mentoring', 'guidance', 'lead junior'], category: 'Leadership', importance: 'important' },
    { name: 'Production Troubleshooting', keywords: ['production troubleshooting', 'incident management', 'outage', 'debugging production'], category: 'Operations', importance: 'important' },
    { name: 'Agile & Scrum', keywords: ['agile', 'scrum', 'sprint'], category: 'Process', importance: 'optional' }
  ];

  catalog.forEach(item => {
    if (item.keywords.some(k => jdLower.includes(k))) {
      requirements.push(item);
    }
  });

  // If JD has no recognized skills from catalog, extract capitalized technical terms
  if (requirements.length < 3) {
    const words = jdText.match(/[A-Z][a-zA-Z0-9.#+]+/g) || [];
    const unique = Array.from(new Set(words)).filter(w => w.length > 2 && !['Senior', 'Junior', 'Lead', 'Engineer', 'Developer', 'Full', 'Stack', 'Software', 'Role', 'Requirements', 'Responsibilities'].includes(w));
    unique.slice(0, 8).forEach(term => {
      requirements.push({
        name: term,
        keywords: [term.toLowerCase()],
        category: 'General',
        importance: 'important'
      });
    });
  }

  return requirements;
}

/**
 * Evaluates evidence level (0-4) and status for a requirement against resume sections.
 */
function evaluateRequirementEvidence(req, sections, resumeLower) {
  const reqName = req.name;
  const keywords = req.keywords;

  const workLower = (sections.workExperience || '').toLowerCase();
  const projLower = (sections.projects || '').toLowerCase();
  const skillsLower = (sections.skills || '').toLowerCase();
  const summLower = (sections.summary || '').toLowerCase();

  const inWork = keywords.some(k => workLower.includes(k));
  const inProj = keywords.some(k => projLower.includes(k));
  const inSkills = keywords.some(k => skillsLower.includes(k));
  const inSumm = keywords.some(k => summLower.includes(k));
  const inFull = keywords.some(k => resumeLower.includes(k));

  const actionRegex = /(built|designed|developed|architected|implemented|led|optimized|managed|created|scaled|reduced|improved|integrated|refactored|deployed|configured)/i;
  const metricRegex = /(%|users|ms|seconds|throughput|latency|requests|million|thousand|k8s|production|scale)/i;

  if (inWork) {
    // Check if work experience section has action verbs or impact metrics near the keyword
    const hasAction = actionRegex.test(sections.workExperience) || metricRegex.test(sections.workExperience);
    const evidenceLevel = hasAction ? 4 : 3;
    return {
      requirement: reqName,
      category: req.category,
      importance: req.importance,
      status: 'demonstrated',
      evidenceLevel,
      evidence: extractSnippet(sections.workExperience, keywords[0]) || `Demonstrated in Work Experience (${reqName}).`,
      evidenceLocation: 'Work Experience',
      confidence: 'High',
      reasoning: `Found in Work Experience with ${evidenceLevel === 4 ? 'specific responsibility/impact' : 'direct role context'}.`
    };
  }

  if (inProj || inSumm) {
    return {
      requirement: reqName,
      category: req.category,
      importance: req.importance,
      status: 'demonstrated',
      evidenceLevel: 2,
      evidence: extractSnippet(sections.projects || sections.summary, keywords[0]) || `Demonstrated in Projects/Summary (${reqName}).`,
      evidenceLocation: inProj ? 'Projects' : 'Summary',
      confidence: 'Medium',
      reasoning: 'Present in Projects or Executive Summary.'
    };
  }

  if (inSkills) {
    return {
      requirement: reqName,
      category: req.category,
      importance: req.importance,
      status: 'mentioned',
      evidenceLevel: 1,
      evidence: `Appears only in Skills list (${reqName}).`,
      evidenceLocation: 'Skills Section',
      confidence: 'Medium',
      reasoning: 'Listed in Skills section without narrative context or work experience.'
    };
  }

  if (inFull) {
    return {
      requirement: reqName,
      category: req.category,
      importance: req.importance,
      status: 'mentioned',
      evidenceLevel: 1,
      evidence: `Mentioned in resume text (${reqName}).`,
      evidenceLocation: 'General Text',
      confidence: 'Medium',
      reasoning: 'Mentioned in resume text.'
    };
  }

  // Check for Related / Transferable Technology
  const transferableMatch = findTransferableSkill(reqName, resumeLower, sections);
  if (transferableMatch) {
    return transferableMatch;
  }

  // Level 0: Missing
  return {
    requirement: reqName,
    category: req.category,
    importance: req.importance,
    status: 'missing',
    evidenceLevel: 0,
    evidence: `No evidence found in resume for ${reqName}.`,
    evidenceLocation: 'None',
    confidence: 'High',
    reasoning: `Requirement ${reqName} is absent from resume.`
  };
}

/**
 * Finds related / transferable technologies (e.g. REST vs GraphQL, PostgreSQL vs MongoDB).
 */
function findTransferableSkill(reqName, resumeLower, sections) {
  const reqLower = reqName.toLowerCase();
  const workLower = (sections.workExperience || '').toLowerCase();

  // ONLY allow genuinely transferable baseline technologies.
  // NEVER infer Docker -> Kubernetes, REST -> GraphQL, Docker -> Microservices, Node.js -> Microservices, or React -> Performance.
  const relations = [
    { req: 'nest.js', related: 'express', label: 'Express.js (Transferable Node framework experience)' },
    { req: 'postgresql', related: 'mysql', label: 'MySQL (Transferable Relational DB experience)' },
    { req: 'mongodb', related: 'dynamodb', label: 'DynamoDB (Transferable NoSQL DB experience)' },
    { req: 'aws', related: 'azure', label: 'Azure cloud experience (Transferable Cloud experience)' },
    { req: 'typescript', related: 'javascript', label: 'JavaScript proficiency (Transferable language experience)' }
  ];

  for (const rel of relations) {
    if (reqLower.includes(rel.req) && (workLower.includes(rel.related) || resumeLower.includes(rel.related))) {
      return {
        requirement: reqName,
        category: 'Transferable',
        importance: 'important',
        status: 'related',
        evidenceLevel: 1.5,
        evidence: `Demonstrates ${rel.label}.`,
        evidenceLocation: 'Work Experience',
        confidence: 'Medium',
        reasoning: `Candidate has related technology (${rel.related}) which provides limited transferable credit.`
      };
    }
  }

  return null;
}

/**
 * Calculates ATS Readability Score strictly independently from compatibility score.
 */
function calculateATSReadabilityScore(resumeText) {
  let score = 30; // Base score

  // 1. Length check (300 to 4000 chars)
  if (resumeText.length >= 300 && resumeText.length <= 5000) score += 25;

  // 2. Section Headers check
  const headerMatches = (resumeText.match(/(experience|education|skills|summary|projects)/gi) || []).length;
  score += Math.min(25, headerMatches * 5);

  // 3. Contact information check (Email / Phone)
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resumeText)) score += 10;
  if (/(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(resumeText)) score += 5;

  // 4. Bullet point formatting check
  if (/[-•*]\s+[A-Z]/.test(resumeText)) score += 5;

  return Math.min(95, Math.max(40, score));
}

/**
 * Generates evidence-grounded feedback, strengths, weaknesses, recommendations, and executive summary.
 */
function generateEvidenceGroundedFeedback(
  matchScore,
  atsScore,
  requirementMatches,
  matchedSkills,
  mentionedSkills,
  transferableSkills,
  missingSkills,
  sections,
  keywordStuffingCapApplied
) {
  // Strengths ONLY cite demonstrated skills with actual work experience (Zero Hallucination!)
  const strengths = [];
  const demonstratedReqs = requirementMatches.filter(rm => rm.status === 'demonstrated');

  if (demonstratedReqs.length > 0) {
    demonstratedReqs.slice(0, 3).forEach(rm => {
      strengths.push(`Explicitly demonstrated ${rm.requirement} in ${rm.evidenceLocation} (${rm.evidence.slice(0, 90)}...).`);
    });
  } else {
    strengths.push('Candidate resume contains readable formatting and standard section headers.');
  }

  if (transferableSkills.length > 0) {
    strengths.push(`Demonstrates transferable technical experience in ${transferableSkills.slice(0, 2).join(', ')}.`);
  }

  // Weaknesses cite real missing/mentioned gaps
  const weaknesses = [];

  if (keywordStuffingCapApplied) {
    weaknesses.push('High keyword density in Skills section with insufficient professional work experience evidence for core requirements.');
  }

  if (mentionedSkills.length > 0) {
    weaknesses.push(`Skills listed without professional work experience evidence: ${mentionedSkills.slice(0, 4).join(', ')}.`);
  }

  const criticalMissing = requirementMatches.filter(rm => rm.status === 'missing' && rm.importance === 'critical');
  if (criticalMissing.length > 0) {
    weaknesses.push(`Missing critical job requirements: ${criticalMissing.map(m => m.requirement).slice(0, 4).join(', ')}.`);
  } else if (missingSkills.length > 0) {
    weaknesses.push(`Missing required role skills: ${missingSkills.slice(0, 4).join(', ')}.`);
  }

  // Recommendations
  const recommendations = [];
  if (mentionedSkills.length > 0) {
    recommendations.push(`Add specific professional accomplishments or project details demonstrating your work with ${mentionedSkills.slice(0, 2).join(' and ')}.`);
  }
  if (missingSkills.length > 0) {
    recommendations.push(`Highlight relevant experience or certifications covering missing requirements: ${missingSkills.slice(0, 2).join(', ')}.`);
  }
  recommendations.push('Quantify technical impact in Work Experience bullet points using metrics (e.g. % performance gain, response time reduction).');

  // Experience Match Summary
  const expMatchText = matchScore >= 75
    ? `Strong evidence alignment (${demonstratedReqs.length} demonstrated requirements). Candidate shows deep work experience.`
    : (matchScore >= 50
      ? `Moderate alignment (${demonstratedReqs.length} demonstrated, ${mentionedSkills.length} mentioned-only). Core skills present but missing key senior requirements.`
      : `Weak evidence match. Significant missing requirements (${missingSkills.length} gaps identified).`);

  // Executive Summary
  const summary = `Candidate achieves an evidence-based match score of ${matchScore}% and an ATS readability score of ${atsScore}%. Identified ${demonstratedReqs.length} demonstrated skills with work experience evidence, ${mentionedSkills.length} mentioned-only skills, and ${missingSkills.length} missing requirement gaps.`;

  return {
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    recommendations: recommendations.slice(0, 3),
    experienceMatch: expMatchText,
    summary
  };
}

/**
 * Extracts a concise snippet from text containing a target keyword.
 */
function extractSnippet(text, keyword) {
  if (!text || !keyword) return '';
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + 80);
  return text.substring(start, end).replace(/\s+/g, ' ').trim();
}

async function logLLMResponseMetric(data) {
  try {
    await LLMResponse.create(data);
  } catch (err) {
    console.warn('⚠️ Could not log LLMResponse metric to MongoDB:', err.message);
  }
}
