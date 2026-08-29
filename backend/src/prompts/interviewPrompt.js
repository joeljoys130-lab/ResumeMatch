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

CRITICAL INSTRUCTION FOR SCORING & FOLLOW-UP:
1. Meaningless or Gibberish Answer (e.g. "asdfghjkl", random character strings, no coherent English/technical substance):
   - Set score: 0-1, technicalAccuracy: 0, communication: 0-1.
   - Feedback MUST explain that the response contains no readable technical content.
2. Incomplete or Superficial Answer (e.g. "React is for frontend"):
   - Set score: 3-5, technicalAccuracy: 3-5, communication: 4-5.
3. Comprehensive & Detailed Technical Answer:
   - Set score: 8-10, technicalAccuracy: 8-10, communication: 8-10.

Generate a genuinely new, adaptive follow-up question based on the candidate's answer and weak topics.
DO NOT repeat or rephrase any of the previous questions asked above.

Evaluate the candidate's answer and return ONLY a valid JSON object with the following schema:
{
  "score": number (0-10),
  "technicalAccuracy": number (0-10),
  "communication": number (0-10),
  "feedback": "constructive 2-3 sentence feedback",
  "weakTopics": ["array of specific topics needing improvement"],
  "followUpQuestion": "the next adaptive question to deepen the interview"
}
`;
}

export function formatFinalReportPrompt(session, questions, calculatedScores = {}) {
  const { overallScore = 75, techScore = 75, commScore = 75 } = calculatedScores;

  const qAndAs = questions.map((q, idx) => `
Q${idx + 1}: ${q.question}
A${idx + 1}: ${q.userAnswer || 'No answer'}
Score: ${q.score}/10 | Technical Accuracy: ${q.technicalAccuracy}/10 | Communication: ${q.communication}/10
Feedback: ${q.feedback || 'N/A'}
Weak Topics: ${Array.isArray(q.weakTopics) ? q.weakTopics.join(', ') : 'None'}
`).join('\n');

  return `
Target Role: ${session.role} (${session.experienceLevel}) - ${session.technology} (${session.interviewType})

Calculated Quantitative Metrics:
- Overall Performance Score: ${overallScore}/100
- Technical Mastery Score: ${techScore}/100
- Communication Score: ${commScore}/100

Complete Interview Q&A Transcript:
${qAndAs}

Synthesize a comprehensive final interview performance report based ONLY on the transcript and calculated metrics above.

REQUIREMENT:
Your report MUST explicitly state: "**Overall Score:** ${overallScore}/100". Do NOT invent or alter the score.

Include:
1. Overall Performance Summary & Score (${overallScore}/100)
2. Technical Mastery Breakdown (${techScore}/100)
3. Communication & Clarity Assessment (${commScore}/100)
4. Top Strengths Demonstrated
5. Key Areas for Improvement & Recommended Study Topics
6. Hiring Recommendation (Strong Hire if >= 85, Hire if >= 75, Weak Pass if >= 60, Reject if < 60)
`;
}

