import React from 'react';

export default function SkillBadge({ skill, type = 'matched' }) {
  let badgeStyle = { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' };
  let icon = '✓';

  if (type === 'mentioned') {
    badgeStyle = { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' };
    icon = '💬';
  } else if (type === 'transferable') {
    badgeStyle = { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' };
    icon = '🔄';
  } else if (type === 'missing') {
    badgeStyle = { background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' };
    icon = '✕';
  }

  return (
    <span className="badge" style={{ ...badgeStyle, gap: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.85rem' }}>
      <span>{icon}</span>
      <span>{skill}</span>
    </span>
  );
}
