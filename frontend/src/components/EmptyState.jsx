import React from 'react';

export default function EmptyState({ icon = '📭', title = 'No items found', description = 'Get started by creating a new entry.', action }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{icon}</div>
      <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{description}</p>
      {action}
    </div>
  );
}
