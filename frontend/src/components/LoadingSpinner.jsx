import React from 'react';

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '1rem'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>{message}</span>
    </div>
  );
}

export function ErrorMessage({ message = 'An error occurred.', onRetry }) {
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

export function EmptyState({ icon = '📭', title = 'No items found', description = 'Get started by creating a new entry.', action }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{icon}</div>
      <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{description}</p>
      {action}
    </div>
  );
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="card animate-fade" style={{ maxWidth: '420px', width: '90%' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn btn-danger">Confirm Delete</button>
        </div>
      </div>
    </div>
  );
}

export default LoadingSpinner;
