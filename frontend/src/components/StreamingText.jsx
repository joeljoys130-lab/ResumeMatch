import React from 'react';

export function StreamingText({ text, isStreaming }) {
  return (
    <span>
      {text}
      {isStreaming && (
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '14px',
          background: 'var(--accent-primary)',
          marginLeft: '4px',
          animation: 'pulse 0.6s infinite alternate'
        }} />
      )}
    </span>
  );
}

export function SourceCitation({ citations }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 600, color: 'var(--accent-teal)', marginBottom: '0.4rem' }}>
        📚 Source Citations Grounding:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {citations.map((c, i) => (
          <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>[{i + 1}] {c.title} ({c.sourceFile})</span>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '0.1rem' }}>
              "{c.excerpt}"
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InterviewChat({ messages, currentQuestion, onAnswerSubmit, isSubmitting }) {
  const [answer, setAnswer] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onAnswerSubmit(answer);
    setAnswer('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="chat-container">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.2rem', opacity: 0.8 }}>
              {m.role === 'user' ? 'You' : 'AI Hiring Manager'}
            </div>
            <div>{m.content}</div>
            {m.score !== undefined && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-teal)' }}>
                Evaluation Score: {m.score}/10 | Tech: {m.technicalAccuracy}/10 | Comm: {m.communication}/10
              </div>
            )}
          </div>
        ))}
      </div>

      {currentQuestion && (
        <form onSubmit={handleSubmit} className="card" style={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid var(--accent-primary)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-teal)' }}>
            Current Question #{currentQuestion.questionNumber}:
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1rem' }}>
            {currentQuestion.question}
          </div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              placeholder="Type your structured response..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !answer.trim()}>
            {isSubmitting ? 'Evaluating Answer...' : 'Submit Response'}
          </button>
        </form>
      )}
    </div>
  );
}

export default StreamingText;
