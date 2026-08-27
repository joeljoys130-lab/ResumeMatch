import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header style={{
      background: 'rgba(17, 24, 39, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0.9rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, fontSize: '1.25rem' }}>
          <span style={{
            background: 'var(--accent-gradient)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1.1rem'
          }}>⚡</span>
          <span className="text-gradient">ResumeMatch AI</span>
        </Link>

        {/* Navigation Links */}
        {isAuthenticated ? (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link to="/" style={{ color: isActive('/') ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
              Dashboard
            </Link>
            <Link to="/new" style={{ color: isActive('/new') ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
              New Match
            </Link>
            <Link to="/applications" style={{ color: isActive('/applications') ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
              Tracker
            </Link>
            <Link to="/interviews" style={{ color: isActive('/interviews') ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
              AI Interview
            </Link>
            <Link to="/career-assistant" style={{ color: isActive('/career-assistant') ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
              RAG Assistant
            </Link>
            {user?.role === 'ADMIN' && (
              <Link to="/admin" style={{ color: isActive('/admin') ? '#a855f7' : 'var(--text-muted)', fontWeight: 600 }}>
                👑 Admin
              </Link>
            )}

            {/* Profile & Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
              <Link to="/profile" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
                👤 {user?.name || user?.email}
              </Link>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>
                Logout
              </button>
            </div>
          </nav>
        ) : (
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/login" className="btn btn-secondary" style={{ padding: '0.5rem 1.2rem' }}>Login</Link>
            <Link to="/signup" className="btn btn-primary" style={{ padding: '0.5rem 1.2rem' }}>Get Started</Link>
          </div>
        )}
      </div>
    </header>
  );
}
