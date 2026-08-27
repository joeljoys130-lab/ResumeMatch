import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DashboardCard from '../components/DashboardCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function Admin() {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, usageRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/llm-usage')
      ]);

      if (analyticsRes.data?.success) setData(analyticsRes.data.data.analytics);
      if (usageRes.data?.success) setLogs(usageRes.data.data.logs);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch administrative metrics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner message="Aggregating platform metrics via MongoDB Aggregation Pipelines..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchAdminData} />;

  const { users, analyses, topMissingSkills, llmUsage, evaluation } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade">
      {/* Header Banner */}
      <div className="card" style={{ borderLeft: '4px solid #a855f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>👑 Administrative System Analytics</h2>
          <p className="subtitle">Platform-wide metrics calculated via MongoDB Aggregation Pipelines & PostgreSQL counters</p>
        </div>
        <button onClick={fetchAdminData} className="btn btn-secondary">Refresh Stats</button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid-4">
        <DashboardCard icon="👥" title="Total Registered Users" value={users?.totalUsers || 0} subtitle="PostgreSQL users" />
        <DashboardCard icon="📄" title="Total Analyses" value={analyses?.totalAnalyses || 0} subtitle="MongoDB analyses" />
        <DashboardCard icon="⚡" title="Redis Cache Hit Rate" value={`${llmUsage?.cacheHitRate || 0}%`} subtitle="Sub-second cache hits" />
        <DashboardCard icon="💲" title="Est. Total AI Cost" value={`$${llmUsage?.totalEstimatedCost || 0}`} subtitle="Anthropic token cost" />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid-4">
        <DashboardCard icon="🧠" title="Total LLM Tokens" value={llmUsage?.totalTokens?.toLocaleString() || 0} subtitle={`${llmUsage?.totalInputTokens || 0} in / ${llmUsage?.totalOutputTokens || 0} out`} />
        <DashboardCard icon="⏱️" title="Avg Response Latency" value={`${llmUsage?.avgLatencyMs || 0} ms`} subtitle="API call latency" />
        <DashboardCard icon="🎯" title="Platform Avg Match" value={`${analyses?.avgMatchScore || 0}%`} subtitle="Across all candidates" />
        <DashboardCard icon="🧪" title="Eval Suite Pass Rate" value={`${evaluation?.passRate || 0}%`} subtitle={`${evaluation?.totalPassed || 0}/${evaluation?.totalEvaluated || 0} cases passed`} />
      </div>

      {/* Top Missing Skills & LLM Request Audit Log Grid */}
      <div className="grid-2">
        {/* Top Missing Skills Aggregation */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--status-warning)' }}>
            📊 Top Missing Skills Across Candidate Base
          </h3>
          {topMissingSkills && topMissingSkills.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {topMissingSkills.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontWeight: 600 }}>{item.skill}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{item.count} occurrences</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No skill gap data recorded yet.</div>
          )}
        </div>

        {/* LLM Usage Audit Log */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--accent-teal)' }}>
            📑 Recent LLM Calls Log ({logs.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
            {logs.map((log) => (
              <div key={log._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>[{log.feature}]</span> {log.model}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {log.totalTokens} tokens • ${log.estimatedCost} • {log.latencyMs}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
