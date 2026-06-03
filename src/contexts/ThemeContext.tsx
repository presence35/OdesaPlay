import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeFamily = 'odesa' | 'ukraine';
export type ThemeMode = 'dark' | 'light';
export type Theme = `${ThemeFamily}-${ThemeMode}`;

interface ThemeContextValue {
  theme: Theme;
  family: ThemeFamily;
  mode: ThemeMode;
  setFamily: (f: ThemeFamily) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('odesa_theme') as Theme | null;
  if (stored && ['odesa-dark', 'odesa-light', 'ukraine-dark', 'ukraine-light'].includes(stored)) {
    return stored;
  }
  return 'odesa-dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    localStorage.setItem('odesa_theme', theme);
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const isDark = theme.endsWith('dark');
      meta.setAttribute('content', isDark ? '#0a0a0c' : '#f8fafc');
    }
  }, [theme]);

  const family = theme.split('-')[0] as ThemeFamily;
  const mode = theme.split('-')[1] as ThemeMode;

  const setFamily = useCallback((f: ThemeFamily) => {
    setThemeState(`${f}-${mode}` as Theme);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setThemeState(`${family}-${m}` as Theme);
  }, [family]);

  const toggleMode = useCallback(() => {
    setThemeState(`${family}-${mode === 'dark' ? 'light' : 'dark'}` as Theme);
  }, [family, mode]);

  return (
    <ThemeContext.Provider value={{ theme, family, mode, setFamily, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
