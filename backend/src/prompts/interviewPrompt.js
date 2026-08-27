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
  return `
Target Role: ${session.role} (${session.experienceLevel}) - ${session.technology} (${session.interviewType})

Question Asked:
${currentQuestion.question}

Candidate's Answer:
${userAnswer}

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

export function formatFinalReportPrompt(session, questions) {
  const qAndAs = questions.map((q, idx) => `
Q${idx + 1}: ${q.question}
A${idx + 1}: ${q.userAnswer || 'No answer'}
Score: ${q.score}/10 | Feedback: ${q.feedback || 'N/A'}
`).join('\n');

  return `
Target Role: ${session.role} (${session.experienceLevel}) - ${session.technology} (${session.interviewType})

Complete Interview Q&A Transcript:
${qAndAs}

Synthesize a comprehensive final interview performance report.
Provide:
1. Overall Performance Summary & Score (0-100)
2. Technical Mastery Breakdown
3. Communication & Clarity Assessment
4. Top Strengths Demonstrated
5. Key Areas for Improvement & Recommended Study Topics
6. Hiring Recommendation (Strong Hire, Hire, Weak Pass, Reject)
`;
}
