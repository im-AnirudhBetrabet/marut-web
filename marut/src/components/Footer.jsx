import React from 'react';
export default function Footer() {
  return (
    <footer>
      <a className="footer-logo-image" href="#top" aria-label="MARUT home">
        <img src="/images/marut-logo.png" alt="MARUT logo" width="170" height="94" loading="lazy" />
      </a>
      <div className="footer-note">
        Nature, engineered.<br/>Made with intention in Bengaluru, India.
      </div>
      <div className="footer-links">
        <a href="#approach">Our thinking</a>
        <a href="#contact">Contact ↗</a>
        <span>© MARUT 2026</span>
      </div>
    </footer>
  );
}
