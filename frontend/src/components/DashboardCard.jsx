import React from 'react';

export function DashboardCard({ icon, title, value, subtitle, trend }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{subtitle}</div>}
    </div>
  );
}

export function AnalysisCard({ analysis, onClick }) {
  const { _id, resumeFileName, result, createdAt, cached } = analysis;
  const dateStr = new Date(createdAt).toLocaleDateString();

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
          📄 {resumeFileName}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {dateStr} {cached && <span style={{ color: 'var(--accent-teal)', marginLeft: '0.5rem' }}>⚡ Cached</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          color: result?.matchScore >= 75 ? 'var(--status-success)' : result?.matchScore >= 50 ? 'var(--status-warning)' : 'var(--status-error)'
        }}>
          {result?.matchScore || 0}%
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Match Score</div>
      </div>
    </div>
  );
}

export default DashboardCard;
