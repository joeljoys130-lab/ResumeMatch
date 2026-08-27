import React from 'react';

export default function ScoreGauge({ score = 0, label = 'Match Score', size = 140 }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  let color = '#ef4444'; // Red
  if (normalizedScore >= 75) color = '#10b981'; // Green
  else if (normalizedScore >= 50) color = '#f59e0b'; // Amber

  return (
    <div className="score-gauge-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.8s ease-in-out'
          }}
        />
        {/* Central Text */}
        <text
          x="50%"
          y="48%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="#ffffff"
          fontSize={size * 0.24}
          fontWeight="800"
        >
          {normalizedScore}%
        </text>
      </svg>
      {label && (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 600 }}>
          {label}
        </span>
      )}
    </div>
  );
}
