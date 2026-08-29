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

CRITICAL INSTRUCTIONS FOR QUESTION-SPECIFIC EVALUATION & SCORING:
1. Evaluate candidate's answer against the EXACT question asked above.
2. Determine whether the answer actually addresses the requested concepts, task, and question.
3. DO NOT award points merely for technical keywords. Mentioning keywords (e.g. "MongoDB", "indexing", "React", "Node.js", "memory") without explaining their relevance to the specific question must NOT result in a passing score.
4. SCORING RULES:
   - Score 0-1/10: Gibberish, random key patterns, or meaningless text.
   - Score 0-2/10: Completely unrelated answer, random technical buzzwords, or nonsense that does not address the question.
   - Score 3-5/10: Partially relevant, basic understanding, addresses some part of the question with missing depth.
   - Score 6-7/10: Generally correct, addresses most of the question with reasonable technical understanding.
   - Score 8-9/10: Strong, technically accurate answer directly addressing requested concepts.
   - Score 10/10: Exceptional, comprehensive technical answer addressing all important aspects.
5. Typo Tolerance: Do NOT mark an answer down merely for minor spelling errors if the technical meaning is clear and relevant.

Generate a genuinely new, adaptive follow-up question based on the candidate's answer and weak topics.
DO NOT repeat or rephrase any of the previous questions asked above.

Evaluate the candidate's answer and return ONLY a valid JSON object with the following schema:
{
  "score": number (0-10),
  "technicalAccuracy": number (0-10),
  "communication": number (0-10),
  "relevance": number (0-10),
  "feedback": "constructive 2-3 sentence feedback explaining relevance and accuracy",
  "missingConcepts": ["array of concepts requested in the question that were missed"],
  "strengths": ["array of demonstrated strengths"],
  "weakTopics": ["array of specific topics needing improvement"],
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


