import ThemeToggle from './ThemeToggle';
import React from 'react';
export default function Header({ theme, onToggle }) {
  return <>
    <div className="topline"><span>MARUT / Bengaluru, India</span><span>Grown with intention · Coming soon</span></div>
    <header>
      <a className="logo logo-image" href="#top" aria-label="MARUT home"><img src="/images/marut-logo.png" alt="MARUT logo" width="142" height="68" /></a>
      <nav aria-label="Main navigation">
        <a href="#approach">Our approach</a><a href="#produce">What we grow</a><a href="#catalogue">Catalogue</a><a href="#partners">For kitchens</a>
        <ThemeToggle theme={theme} onToggle={onToggle} />
        <a className="nav-cta" href="#contact">Get in touch ↗</a>
      </nav>
    </header>
  </>;
}
