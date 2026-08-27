import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import FileUploader from '../components/FileUploader';
import LoadingSpinner from '../components/LoadingSpinner';

export default function NewAnalysis() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [fileError, setFileError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleFileSelect = (selectedFile, errorMsg) => {
    setFile(selectedFile);
    setFileError(errorMsg);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!file) {
      setFormError('Please select a valid PDF or DOCX resume document.');
      return;
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      setFormError('Job description text must be at least 50 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('jobDescription', jobDescription);
      if (jobTitle) formData.append('jobTitle', jobTitle);
      if (company) formData.append('company', company);

      const res = await api.post('/analysis', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const analysisId = res.data.data.analysisId;
        navigate(`/analysis/${analysisId}`);
      }
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'Failed to complete resume analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <LoadingSpinner message="Extracting text, running prompt injection checks & Claude AI match analysis..." />;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }} className="animate-fade">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>New AI Resume & Job Analysis</h2>
        <p className="subtitle">Upload your resume and paste the target job description to compute match score and ATS recommendations.</p>
      </div>

      {formError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          ⚠️ {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Step 1: Resume File Upload */}
        <div>
          <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
            1. Upload Resume (PDF or DOCX, Max 5 MB)
          </label>
          <FileUploader onFileSelect={handleFileSelect} selectedFile={file} error={fileError} />
        </div>

        {/* Step 2: Target Position Metadata (Optional) */}
        <div className="grid-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Job Title (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Senior Full Stack Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Company Name (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. TechCorp Solutions"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>

        {/* Step 3: Job Description Text */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">2. Paste Target Job Description</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: '180px' }}
            placeholder="Paste full job posting text here including responsibilities and required technical skills..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
          disabled={!file || !jobDescription || submitting}
        >
          ⚡ Generate Compatibility Analysis
        </button>
      </form>
    </div>
  );
}
