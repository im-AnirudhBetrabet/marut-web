
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import Header from './components/Header';
import Marquee from './components/Marquee';
import Footer from './components/Footer';
import RevealOnScroll from './components/RevealOnScroll';
import Hero from './sections/Hero';
import Philosophy from './sections/Philosophy';
import Produce from './sections/Produce';
import MicrogreensEducation from './sections/MicrogreensEducation';
import Catalogue from './sections/Catalogue';
import MarutContact from './sections/MarutContact';
import GrowingMethod from './sections/GrowingMethod';
import FarmStory from './sections/FarmStory';
import Partnerships from './sections/Partnerships';
import Contact from './sections/Contact';
import Feedback from './pages/Feedback';
import React from 'react';
import './styles/global.css';
import './styles/components.css';
import './styles/sections.css';

function HomePage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <RevealOnScroll>
      <div id="page-top">
        <div className="cursor-dot" aria-hidden="true" />
        <Header theme={theme} onToggle={toggleTheme} />
        <main>
          <Hero />
          <Marquee />
          <Philosophy />
          <MicrogreensEducation />
          <Produce />
          <Catalogue />
          <GrowingMethod />
          <FarmStory />
          <Partnerships />
          <Contact />
          <MarutContact />
        </main>
        <Footer />
      </div>
    </RevealOnScroll>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
