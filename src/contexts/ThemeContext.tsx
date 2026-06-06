import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

export type ThemeFamily = 'odesa' | 'ukraine';
export type ThemeMode = 'dark' | 'light';
export type Theme = `${ThemeFamily}-${ThemeMode}`;

const STORAGE_KEY = 'odesa_theme';
const VALID_THEMES = ['odesa-dark', 'odesa-light', 'ukraine-dark', 'ukraine-light'];

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
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored && VALID_THEMES.includes(stored)) {
    return stored;
  }
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'odesa-light' : 'odesa-dark';
}

function applyThemeToDOM(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const isDark = theme.endsWith('dark');
    const mode = theme.split('-')[0];
    if (isDark) {
      meta.setAttribute('content', mode === 'odesa' ? '#0a0a0c' : '#0a1628');
    } else {
      meta.setAttribute('content', mode === 'odesa' ? '#fcf5f0' : '#e8f4fd');
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const userOverride = useRef(localStorage.getItem(STORAGE_KEY) !== null);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, []);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      if (!userOverride.current) {
        setThemeState((prev) => {
          const family = prev.split('-')[0] as ThemeFamily;
          return mq.matches ? `${family}-light` as Theme : `${family}-dark` as Theme;
        });
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const persist = useCallback((t: Theme) => {
    userOverride.current = true;
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const family = theme.split('-')[0] as ThemeFamily;
  const mode = theme.split('-')[1] as ThemeMode;

  const setFamily = useCallback((f: ThemeFamily) => {
    persist(`${f}-${mode}` as Theme);
  }, [mode, persist]);

  const setMode = useCallback((m: ThemeMode) => {
    persist(`${family}-${m}` as Theme);
  }, [family, persist]);

  const toggleMode = useCallback(() => {
    persist(`${family}-${mode === 'dark' ? 'light' : 'dark'}` as Theme);
  }, [family, mode, persist]);

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
