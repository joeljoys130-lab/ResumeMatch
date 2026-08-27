import React, { useState } from 'react';

export default function FileUploader({ onFileSelect, selectedFile, error }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  const validateAndPassFile = (file) => {
    const validExts = ['.pdf', '.docx', '.doc'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExts.includes(ext)) {
      onFileSelect(null, 'Invalid file type. Please upload a PDF (.pdf) or Word (.docx) document.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onFileSelect(null, 'File size exceeds maximum 5 MB limit.');
      return;
    }

    onFileSelect(file, null);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        background: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onClick={() => document.getElementById('resumeFileInput').click()}
    >
      <input
        id="resumeFileInput"
        type="file"
        accept=".pdf,.docx,.doc"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
      {selectedFile ? (
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--accent-teal)' }}>
            ✓ {selectedFile.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for parsing
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
            Drag & drop your resume file here
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Supports PDF and DOCX (Max 5 MB)
          </div>
        </div>
      )}
      {error && <div style={{ color: 'var(--status-error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</div>}
    </div>
  );
}
