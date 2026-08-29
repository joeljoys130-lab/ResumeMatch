import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import ScoreGauge from '../components/ScoreGauge';
import SkillBadge from '../components/SkillBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function AnalysisResult() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingApp, setSavingApp] = useState(false);
  const [appSaved, setAppSaved] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalysisData();
  }, [id]);

  async function fetchAnalysisData() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/analysis/${id}`);
      if (res.data?.success) {
        setData(res.data.data);
        if (res.data.data.application) {
          setAppSaved(true);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch analysis details.');
    } finally {
      setLoading(false);
    }
  }

  const handleSaveAsApplication = async () => {
    setSavingApp(true);
    try {
      const res = await api.post('/applications', {
        company: 'Target Company',
        jobTitle: 'Analyzed Position',
        currentStatus: 'SAVED',
        jobDescriptionId: data.analysis.jobDescriptionId,
        notes: `Auto-saved from Analysis ID: ${id}. Match Score: ${data.analysis.result.matchScore}%`
      });

      if (res.data?.success) {
        setAppSaved(true);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not save application.');
    } finally {
      setSavingApp(false);
    }
  };

  if (loading) return <LoadingSpinner message="Retrieving structured AI analysis..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchAnalysisData} />;
  if (!data || !data.analysis) return <ErrorMessage message="Analysis record not found." />;

  const { analysis } = data;
  const result = analysis.result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade">
      {/* Top Header Card */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            Resume File: {analysis.resumeFileName} {analysis.cached && <span style={{ color: 'var(--accent-teal)' }}>⚡ Redis Cached</span>}
          </div>
          <h2>AI Compatibility Analysis Result</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)', marginTop: '0.2rem' }}>
            Generated on {new Date(analysis.createdAt).toLocaleString()} • Model: {analysis.model}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleSaveAsApplication}
            className="btn btn-secondary"
            disabled={appSaved || savingApp}
          >
            {appSaved ? '✓ Saved in Tracker' : savingApp ? 'Saving...' : '📌 Save to Tracker'}
          </button>
          <Link to="/applications" className="btn btn-primary">
            View Applications
          </Link>
        </div>
      </div>

      {/* Scores Grid */}
      <div className="grid-2">
        <div className="card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '2rem' }}>
          <ScoreGauge score={result.matchScore} label="Overall Match Score" size={140} />
          <ScoreGauge score={result.atsScore} label="ATS Readability Score" size={140} />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--accent-teal)' }}>Experience Alignment</h3>
          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            {result.experienceMatch}
          </p>

          <h4 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>Executive Summary</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {result.summary}
          </p>
        </div>
      </div>

      {/* Matched vs Missing Skills Grid */}
      <div className="grid-2">
        {/* Demonstrated Skills */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✓</span> Explicitly Demonstrated Skills ({result.matchedSkills?.length || 0})
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Backed by professional work experience or projects.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {result.matchedSkills?.length > 0 ? (
              result.matchedSkills.map((skill, idx) => (
                <SkillBadge key={idx} skill={skill} type="matched" />
              ))
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No demonstrated work experience skills identified.</span>
            )}
          </div>

          {result.transferableSkills?.length > 0 && (
            <>
              <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: '#60a5fa', fontSize: '0.9rem' }}>
                🔄 Transferable / Related Technologies ({result.transferableSkills.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.transferableSkills.map((skill, idx) => (
                  <SkillBadge key={idx} skill={skill} type="transferable" />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Mentioned & Missing Skills */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✕</span> Missing Requirement Gaps ({result.missingSkills?.length || 0})
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Requirements absent from candidate resume.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {result.missingSkills?.length > 0 ? (
              result.missingSkills.map((skill, idx) => (
                <SkillBadge key={idx} skill={skill} type="missing" />
              ))
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No missing skill gaps detected! Excellent fit.</span>
            )}
          </div>

          {result.mentionedSkills?.length > 0 && (
            <>
              <h4 style={{ marginTop: '1rem', marginBottom: '0.25rem', color: '#fbbf24', fontSize: '0.9rem' }}>
                💬 Mentioned-Only Skills ({result.mentionedSkills.length})
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Appears in Skills list without professional work experience evidence.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.mentionedSkills.map((skill, idx) => (
                  <SkillBadge key={idx} skill={skill} type="mentioned" />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Strengths & Weaknesses Grid */}
      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--accent-teal)' }}>💪 Candidate Strengths</h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.925rem' }}>
            {result.strengths?.map((s, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--status-warning)' }}>⚠️ Areas of Concern / Weaknesses</h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.925rem' }}>
            {result.weaknesses?.map((w, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{w}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card">
        <h3 style={{ marginBottom: '0.75rem', color: 'var(--accent-primary)' }}>💡 Actionable Resume Improvement Recommendations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {result.recommendations?.map((rec, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)', fontSize: '0.925rem' }}>
              <strong>Step {idx + 1}:</strong> {rec}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
