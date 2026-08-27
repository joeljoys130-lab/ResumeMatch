import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }} className="animate-fade">
      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>User Profile & Account Settings</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user?.name || 'User'}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email Address</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user?.email}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Account Access Role</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: user?.role === 'ADMIN' ? '#a855f7' : 'var(--accent-teal)' }}>
              {user?.role === 'ADMIN' ? '👑 System Administrator' : '👤 Standard User'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Member Since</div>
            <div style={{ fontSize: '1rem' }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}</div>
          </div>
        </div>

        <button onClick={logout} className="btn btn-danger" style={{ width: '100%' }}>
          Sign Out of Account
        </button>
      </div>
    </div>
  );
}
