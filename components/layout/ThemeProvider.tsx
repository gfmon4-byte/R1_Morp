'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: 'dark', toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Read the active theme already applied to <html> by the blocking <head> script
    const currentAttr = document.documentElement.getAttribute('data-theme') as Theme | null;
    if (currentAttr === 'dark' || currentAttr === 'light') {
      setTheme(currentAttr);
      return;
    }

    const stored = localStorage.getItem('runmorp-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      const preferred: Theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      setTheme(preferred);
      document.documentElement.setAttribute('data-theme', preferred);
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('runmorp-theme', next);
      } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
