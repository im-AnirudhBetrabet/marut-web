import { useEffect, useState } from 'react';

const STORAGE_KEY = 'marut-theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'original' ? 'original' : 'earth';
    } catch {
      return 'earth';
    }
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Storage may be unavailable. */ }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'earth' ? 'original' : 'earth');
  return { theme, toggleTheme };
}
