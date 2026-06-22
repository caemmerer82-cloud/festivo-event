import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'default' | 'dark' | 'summer' | 'turquoise' | 'futuristic';

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'default', label: 'Standard' },
  { value: 'dark', label: 'Darkmode' },
  { value: 'summer', label: 'Sommerfarben' },
  { value: 'turquoise', label: 'Türkis' },
  { value: 'futuristic', label: 'Futuristisch' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'app_theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.some(t => t.value === stored)) {
    return stored as Theme;
  }
  return 'default';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
