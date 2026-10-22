import { useScrollReveal } from '../hooks/useScrollReveal';
import React from 'react';
export default function RevealOnScroll({ children }) {
  useScrollReveal();
  return children;
}
