import React from 'react';
export default function ThemeToggle({ theme, onToggle }) {
  const isOriginal = theme === 'original';
  return <button className="theme-toggle" type="button" onClick={onToggle} aria-pressed={isOriginal} aria-label={`Switch to ${isOriginal ? 'earth-tone' : 'original'} colour palette`}>
    <span className="theme-dot" aria-hidden="true" /> <span>{isOriginal ? 'Original colours' : 'Earth tones'}</span>
  </button>;
}
