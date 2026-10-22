import React from 'react';
const phrases = ['Nature, engineered', 'Less guesswork, more greens', 'Grown with intention'];
export default function Marquee() {
  return <div className="marquee" aria-label={phrases.join('. ')}><div className="marquee-track" aria-hidden="true">
    {[0, 1].map((copy) => <div className="marquee-group" key={copy}>{phrases.map((phrase) => <span key={phrase}>{phrase} <b className="star">✳</b></span>)}</div>)}
  </div></div>;
}
