import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

export default function Interviews() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  // Form State
  const [role, setRole] = useState('Full Stack Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level');
  const [technology, setTechnology] = useState('React & Node.js');
  const [interviewType, setInterviewType] = useState('Technical');
  const [questionCount, setQuestionCount] = useState(5);

  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/interviews');
      if (res.data?.success) {
        setSessions(res.data.data.sessions);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch interview sessions.');
    } finally {
      setLoading(false);
    }
  }

  const handleStartInterview = async (e) => {
    e.preventDefault();
    setStarting(true);
    try {
      const res = await api.post('/interviews', {
        role,
        experienceLevel,
        technology,
        interviewType,
        questionCount: Number(questionCount)
      });

      if (res.data?.success) {
        const sessionId = res.data.data.session.id;
        navigate(`/interviews/${sessionId}`);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not start interview session.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade">
      {/* Header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Adaptive AI Mock Interview Agent</h2>
          <p className="subtitle">Practice interactive technical & behavioral interviews with real-time scoring and adaptive follow-ups</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Configure New Interview */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--accent-primary)' }}>⚡ Start New Practice Session</h3>
          <form onSubmit={handleStartInterview}>
            <div className="form-group">
              <label className="form-label">Target Role</label>
              <input
                type="text"
                className="form-input"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Experience Level</label>
              <select
                className="form-select"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option value="Junior">Junior (0-2 YOE)</option>
                <option value="Mid-Level">Mid-Level (3-5 YOE)</option>
                <option value="Senior">Senior (6+ YOE)</option>
                <option value="Lead/Principal">Lead / Principal</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Technology Focus</label>
              <input
                type="text"
                className="form-input"
                required
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                placeholder="React, Node.js, PostgreSQL"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Interview Type</label>
              <select
                className="form-select"
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
              >
                <option value="Technical">Technical & System Concepts</option>
                <option value="Behavioral">Behavioral (STAR Method)</option>
                <option value="System Design">System Architecture & Design</option>
                <option value="General HR">General HR & Career Fit</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Number of Questions</label>
              <select
                className="form-select"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              >
                <option value={5}>5 Questions (Quick Practice)</option>
                <option value={10}>10 Questions (Standard Interview)</option>
                <option value={15}>15 Questions (Deep Evaluation)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={starting}>
              {starting ? 'Generating Initial Question...' : '🚀 Start AI Interview'}
            </button>
          </form>
        </div>

        {/* History of Past Sessions */}
        <div>
          <h3 style={{ marginBottom: '1.25rem' }}>Past Interview Sessions</h3>
          {error && <ErrorMessage message={error} onRetry={fetchSessions} />}
          {loading && <LoadingSpinner message="Fetching past session records..." />}

          {!loading && sessions.length === 0 ? (
            <EmptyState
              icon="🎙️"
              title="No Practice Sessions Yet"
              description="Configure and start your first AI mock interview session!"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sessions.map((s) => (
                <div key={s.id} className="card" onClick={() => navigate(`/interviews/${s.id}`)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.role} ({s.interviewType})</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Focus: {s.technology} • Level: {s.experienceLevel}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '0.2rem' }}>
                      Status: <span style={{ color: s.status === 'COMPLETED' ? 'var(--status-success)' : 'var(--status-warning)' }}>{s.status}</span>
                    </div>
                  </div>
                  {s.overallScore !== null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-teal)' }}>{s.overallScore}/100</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Score</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
