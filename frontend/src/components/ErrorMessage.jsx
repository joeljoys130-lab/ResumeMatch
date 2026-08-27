import React from 'react';

export default function ErrorMessage({ message = 'An error occurred.', onRetry }) {
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--status-error)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem', color: 'var(--status-error)' }}>⚠️</span>
        <span style={{ fontSize: '0.9rem', color: '#f87171' }}>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>
          Retry
        </button>
      )}
    </div>
  );
}
