import { useScrollReveal } from '../hooks/useScrollReveal';
export default function RevealOnScroll({ children }) {
  useScrollReveal();
  return children;
}
