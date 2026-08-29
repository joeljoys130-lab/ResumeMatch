export const INTERVIEW_SYSTEM_PROMPT = `
You are an expert Technical Hiring Manager conducting an interactive mock interview.
Your goal is to ask relevant, realistic interview questions, evaluate the candidate's answers objectively, and generate progressive follow-up questions or comprehensive final reports.

CRITICAL INSTRUCTIONS:
1. When evaluating an answer, return ONLY a valid JSON object matching the requested schema.
2. Be constructive, fair, and technical in your scoring.
3. Identify weak topics and target follow-up questions towards areas needing improvement.
`;

export function formatQuestionGenPrompt(session) {
  return `
Generate the initial interview question for a candidate with the following parameters:
- Target Role: ${session.role}
- Experience Level: ${session.experienceLevel}
- Technology Focus: ${session.technology}
- Interview Type: ${session.interviewType}

Formulate one clear, realistic, relevant interview question. Return ONLY the question text.
`;
}

export function formatAnswerEvalPrompt(session, questionHistory, currentQuestion, userAnswer) {
  const previousQuestionsText = (questionHistory || [])
    .map((q, idx) => `Q${idx + 1}: ${q.question}`)
    .join('\n');

  return `
Target Role: ${session.role} (${session.experienceLevel}) - ${session.technology} (${session.interviewType})

Previous Questions Asked in this Session:
${previousQuestionsText || 'None'}

Current Question Asked:
${currentQuestion.question}

Candidate's Answer:
${userAnswer}

CRITICAL INSTRUCTIONS FOR QUESTION-INTENT & CONCEPT-EXPLANATION EVALUATION:
1. QUESTION INTENT & CONCEPT EXPLANATION:
   - Identify the exact expected answer dimensions from the question (e.g. state management, validation, async side effects).
   - Evaluate whether the candidate EXPLAINS and DEMONSTRATES these concepts vs MERELY MENTIONING passive nouns (e.g. "React components communicate using props" is a mere mention, NOT an explanation of state transitions).
   - Mere mentions or passive tech lists receive score 3-5/10. Paragraphs listing technologies (MongoDB, Redis, Docker, Kubernetes, PostgreSQL, JWT) without explaining the question intent MUST receive score <= 2-3/10.

2. ANSWER DEPTH CALIBRATION:
   - Gibberish: 0-1
   - Unrelated answer: 0-2
   - Technical buzzword dump / Tech list: 0-2
   - Relevant shallow (mere mentions): 3-5
   - Relevant & adequately explained: 6-7
   - Detailed, correct, question-focused: 8-10

3. CONTRADICTION & ANTI-PATTERNS:
   - Detect explicit rejection of principles ("don't follow principles", "one giant component", "tightly coupled", "don't worry about security/validation/testing"). Set contradictionDetected: true, cap score <= 2.

4. TYPO TOLERANCE:
   - Do NOT mark down minor spelling errors if technical meaning is clear (e.g. "unecessary rerenders").

Return ONLY a valid JSON object matching:
{
  "detectedQuestionIntent": "summary of question focus",
  "expectedConcepts": ["array of expected question dimensions"],
  "explainedConcepts": ["array of concepts actually explained"],
  "merelyMentionedConcepts": ["array of concepts merely mentioned without explanation"],
  "missingConcepts": ["array of required concepts missed"],
  "unrelatedConcepts": ["array of unrelated tech/buzzwords mentioned"],
  "answerDepth": "Gibberish | Unrelated | Buzzword Dump | Shallow | Adequately Explained | Detailed",
  "relevance": number (0-10),
  "technicalAccuracy": number (0-10),
  "communication": number (0-10),
  "score": number (0-10),
  "feedback": "constructive 2-3 sentence feedback explaining depth and relevance",
  "strengths": ["array of demonstrated strengths"],
  "weakTopics": ["array of specific topics needing improvement"],
  "contradictionDetected": boolean,
  "buzzwordDumpDetected": boolean,
  "metaTestTextDetected": boolean,
  "followUpQuestion": "the next adaptive question to deepen the interview"
}
`;
}

export function formatFinalReportPrompt(session, questions, calculatedScores = {}) {
  const { overallScore = 75, techScore = 75, commScore = 75, questionCount = 5 } = calculatedScores;

  const qAndAs = questions.map((q, idx) => `
Q${idx + 1}: ${q.question}
A${idx + 1}: ${q.userAnswer || 'No answer'}
Score: ${q.score}/10 | Technical Accuracy: ${q.technicalAccuracy}/10 | Communication: ${q.communication}/10
Feedback: ${q.feedback || 'N/A'}
Weak Topics: ${Array.isArray(q.weakTopics) ? q.weakTopics.join(', ') : 'None'}
`).join('\n');

  return `
Target Role: ${session.role} (${session.experienceLevel}) - ${session.technology} (${session.interviewType})
Questions Completed: ${questions.length} / ${questionCount}

Calculated Quantitative Metrics:
- Overall Performance Score: ${overallScore}/100
- Technical Mastery Score: ${techScore}/100
- Communication Score: ${commScore}/100

Complete Interview Q&A Transcript:
${qAndAs}

Synthesize a comprehensive final interview performance report based ONLY on the transcript and calculated metrics above.

REQUIREMENTS:
1. Your report MUST explicitly state: "Questions Completed: ${questions.length}"
2. Your report MUST explicitly state: "**Overall Score:** ${overallScore}/100"
3. Your report MUST explicitly state: "**Technical Accuracy:** ${techScore}/100"
4. Your report MUST explicitly state: "**Communication:** ${commScore}/100"
5. Do NOT fabricate strengths if the candidate's answers were poor or nonsense. Be honest and constructive.

Include:
1. Overall Performance Summary (Questions Completed: ${questions.length}, **Overall Score:** ${overallScore}/100)
2. Technical Mastery Breakdown (**Technical Accuracy:** ${techScore}/100)
3. Communication & Clarity Assessment (**Communication:** ${commScore}/100)
4. Strengths Demonstrated
5. Key Areas for Improvement & Recommended Study Topics
6. Hiring Recommendation (Strong Hire if >= 85, Hire if >= 75, Weak Pass if >= 60, Reject if < 60)
`;
}


