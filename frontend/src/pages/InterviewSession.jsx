import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { InterviewChat } from '../components/StreamingText';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function InterviewSession() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchSessionDetails();
  }, [id]);

  async function fetchSessionDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/interviews/${id}`);
      if (res.data?.success) {
        setSession(res.data.data.session);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load interview session.');
    } finally {
      setLoading(false);
    }
  }

  const handleAnswerSubmit = async (answerText) => {
    setSubmitting(true);
    try {
      const res = await api.post(`/interviews/${id}/answer`, { answer: answerText });
      if (res.data?.success) {
        fetchSessionDetails();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not evaluate answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteInterview = async () => {
    setCompleting(true);
    try {
      const res = await api.post(`/interviews/${id}/complete`);
      if (res.data?.success) {
        fetchSessionDetails();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not complete interview.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading mock interview session transcript..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchSessionDetails} />;
  if (!session) return <ErrorMessage message="Session record not found." />;

  // Build chat message list from questions
  const messages = [];
  session.questions.forEach((q) => {
    messages.push({ role: 'assistant', content: q.question });
    if (q.userAnswer) {
      messages.push({
        role: 'user',
        content: q.userAnswer,
        score: q.score,
        technicalAccuracy: q.technicalAccuracy,
        communication: q.communication,
        feedback: q.feedback
      });
    }
  });

  const currentUnansweredQuestion = session.questions.find((q) => !q.userAnswer);
  const isCompleted = session.status === 'COMPLETED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">
      {/* Session Header Bar */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Session #{session.id} • {session.interviewType} Interview
          </div>
          <h2>{session.role} ({session.experienceLevel})</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--accent-teal)' }}>
            Tech Focus: {session.technology}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isCompleted ? (
            <div style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>
              ✓ Completed (Score: {session.overallScore}/100)
            </div>
          ) : (
            <button onClick={handleCompleteInterview} className="btn btn-primary" disabled={completing}>
              {completing ? 'Generating Report...' : 'Finish & Generate Report'}
            </button>
          )}
          <button onClick={() => navigate('/interviews')} className="btn btn-secondary">
            Back to List
          </button>
        </div>
      </div>

      {/* Main Chat & Question Component */}
      <InterviewChat
        messages={messages}
        currentQuestion={!isCompleted ? currentUnansweredQuestion : null}
        onAnswerSubmit={handleAnswerSubmit}
        isSubmitting={submitting}
      />

      {/* Final Performance Report Section */}
      {isCompleted && session.finalReport && (
        <div className="card" style={{ borderLeft: '4px solid var(--status-success)', marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--status-success)' }}>📊 Final Interview Performance Report</h3>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '0.95rem' }}>
            {session.finalReport}
          </div>
        </div>
      )}
    </div>
  );
}
