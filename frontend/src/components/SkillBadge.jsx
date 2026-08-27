import React from 'react';

export default function SkillBadge({ skill, type = 'matched' }) {
  const isMatched = type === 'matched';

  return (
    <span className={`badge ${isMatched ? 'badge-matched' : 'badge-missing'}`} style={{ gap: '0.35rem' }}>
      <span>{isMatched ? '✓' : '✕'}</span>
      <span>{skill}</span>
    </span>
  );
}
