import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import DashboardCard from '../components/DashboardCard';
import { AnalysisCard } from '../components/DashboardCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, analysesRes] = await Promise.all([
        api.get('/admin/user-analytics'),
        api.get('/analysis')
      ]);

      if (analyticsRes.data?.success) setAnalytics(analyticsRes.data.data.analytics);
      if (analysesRes.data?.success) setAnalyses(analysesRes.data.data.analyses);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner message="Gathering career intelligence dashboard metrics..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade">
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(6,182,212,0.15) 100%)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Career Intelligence Dashboard</h1>
          <p className="subtitle">AI Match Score Analysis, Application Tracking & Interactive Coaching</p>
        </div>
        <Link to="/new" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.8rem 1.6rem' }}>
          ⚡ Start New Analysis
        </Link>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchDashboardData} />}

      {/* Metrics Row */}
      <div className="grid-4">
        <DashboardCard icon="📄" title="Total Applications" value={analytics?.totalApplications || 0} subtitle="Saved & tracked" />
        <DashboardCard icon="🎯" title="Avg Match Score" value={`${analytics?.avgMatchScore || 0}%`} subtitle="Across analyses" />
        <DashboardCard icon="🏆" title="Best Score" value={`${analytics?.bestMatchScore || 0}%`} subtitle="Highest match" />
        <DashboardCard icon="💼" title="Active Applications" value={analytics?.statusCounts?.APPLIED || 0} subtitle="In progress" />
      </div>

      {/* Main Grid Section */}
      <div className="grid-2">
        {/* Past Analyses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Recent Resume Analyses</h3>
            <Link to="/new" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>+ New Match</Link>
          </div>

          {analyses.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No Resume Analyses Yet"
              description="Upload your resume and paste a job description to calculate your match score!"
              action={<Link to="/new" className="btn btn-primary">Create First Analysis</Link>}
            />
          ) : (
            analyses.map((item) => (
              <AnalysisCard
                key={item._id}
                analysis={item}
                onClick={() => navigate(`/analysis/${item._id}`)}
              />
            ))
          )}
        </div>

        {/* Quick Career Tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Career Growth Suite</h3>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2rem', background: 'rgba(99,102,241,0.2)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>🎙️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>AI Interview Agent</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Practice adaptive technical & behavioral questions</div>
            </div>
            <Link to="/interviews" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Practice</Link>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2rem', background: 'rgba(20,184,166,0.2)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>📚</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>RAG Career Assistant</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ask questions grounded in ATS & resume guidelines</div>
            </div>
            <Link to="/career-assistant" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Ask RAG</Link>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2rem', background: 'rgba(168,85,247,0.2)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>📌</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Application Tracker</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage statuses from Applied to Offer with audit history</div>
            </div>
            <Link to="/applications" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>View Tracker</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
