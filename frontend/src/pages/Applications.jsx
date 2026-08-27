import React, { useState, useEffect } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { ConfirmDialog } from '../components/LoadingSpinner';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [deleteAppId, setDeleteAppId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Application Form State
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [currentStatus, setCurrentStatus] = useState('SAVED');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter]);

  async function fetchApplications() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/applications', { params });
      if (res.data?.success) {
        setApplications(res.data.data.applications);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch job applications.');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/applications', {
        company,
        jobTitle,
        jobUrl,
        notes,
        currentStatus
      });

      if (res.data?.success) {
        setShowCreateModal(false);
        setCompany(''); setJobTitle(''); setJobUrl(''); setNotes('');
        fetchApplications();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not create application.');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (appId, newStatus) => {
    try {
      await api.patch(`/applications/${appId}`, { currentStatus: newStatus });
      fetchApplications();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not update status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteAppId) return;
    try {
      await api.delete(`/applications/${deleteAppId}`);
      setDeleteAppId(null);
      fetchApplications();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not delete application.');
    }
  };

  const STATUS_COLORS = {
    SAVED: '#6b7280',
    APPLIED: '#3b82f6',
    SCREENING: '#a855f7',
    INTERVIEW: '#f59e0b',
    OFFER: '#10b981',
    REJECTED: '#ef4444'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">
      {/* Top Header & Filter Controls */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Job Application Tracker</h2>
          <p className="subtitle">Manage pipeline statuses with PostgreSQL status audit history</p>
        </div>

        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          + Add Application
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          style={{ maxWidth: '300px' }}
          placeholder="Search by company or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchApplications()}
        />

        <select
          className="form-select"
          style={{ maxWidth: '200px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="SAVED">Saved</option>
          <option value="APPLIED">Applied</option>
          <option value="SCREENING">Screening</option>
          <option value="INTERVIEW">Interview</option>
          <option value="OFFER">Offer</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchApplications} />}
      {loading && <LoadingSpinner message="Fetching application records..." />}

      {/* Applications List */}
      {!loading && applications.length === 0 ? (
        <EmptyState
          icon="💼"
          title="No Applications Tracked"
          description="Start tracking your job search applications to organize status progressions."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary">Add Application</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {applications.map((app) => (
            <div key={app.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{app.jobTitle}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{app.company}</div>
                {app.jobUrl && (
                  <a href={app.jobUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                    🔗 Job Link
                  </a>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '0.3rem' }}>
                  Added: {new Date(app.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Status Dropdown & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <select
                  className="form-select"
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderColor: STATUS_COLORS[app.currentStatus] || 'var(--border-color)',
                    color: STATUS_COLORS[app.currentStatus] || 'var(--text-main)'
                  }}
                  value={app.currentStatus}
                  onChange={(e) => handleStatusChange(app.id, e.target.value)}
                >
                  <option value="SAVED">Saved</option>
                  <option value="APPLIED">Applied</option>
                  <option value="SCREENING">Screening</option>
                  <option value="INTERVIEW">Interview</option>
                  <option value="OFFER">Offer</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <button onClick={() => setDeleteAppId(app.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAppId}
        title="Delete Job Application"
        message="Are you sure you want to delete this job application? All status history will be removed."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteAppId(null)}
      />

      {/* Modal for Creating New Application */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card animate-fade" style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem' }}>Add New Application</h3>
            <form onSubmit={handleCreateApplication}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input type="text" className="form-input" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="TechCorp Inc" />
              </div>
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input type="text" className="form-input" required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Software Engineer" />
              </div>
              <div className="form-group">
                <label className="form-label">Job Posting URL (Optional)</label>
                <input type="url" className="form-input" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://company.com/careers/job" />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select className="form-select" value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)}>
                  <option value="SAVED">Saved</option>
                  <option value="APPLIED">Applied</option>
                  <option value="SCREENING">Screening</option>
                  <option value="INTERVIEW">Interview</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea className="form-textarea" style={{ minHeight: '80px' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Referral by John, HR contact..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Saving...' : 'Create Application'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
