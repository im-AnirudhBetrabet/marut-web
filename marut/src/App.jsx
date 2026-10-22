import { useTheme } from './hooks/useTheme';
import Header from './components/Header';
import Marquee from './components/Marquee';
import Footer from './components/Footer';
import RevealOnScroll from './components/RevealOnScroll';
import Hero from './sections/Hero';
import Philosophy from './sections/Philosophy';
import Produce from './sections/Produce';
import GrowingMethod from './sections/GrowingMethod';
import FarmStory from './sections/FarmStory';
import Partnerships from './sections/Partnerships';
import Contact from './sections/Contact';
import './styles/global.css';
import './styles/components.css';
import './styles/sections.css';
import React from 'react';
export default function App() {
  const { theme, toggleTheme } = useTheme();
  return <RevealOnScroll><div id="page-top"><div className="cursor-dot" aria-hidden="true"/><Header theme={theme} onToggle={toggleTheme}/><main><Hero/><Marquee/><Philosophy/><Produce/><GrowingMethod/><FarmStory/><Partnerships/><Contact/></main><Footer/></div></RevealOnScroll>;
}
