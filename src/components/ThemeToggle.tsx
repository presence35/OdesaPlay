import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  darkLabel: string;
  lightLabel: string;
}

export default function ThemeToggle({ darkLabel, lightLabel }: ThemeToggleProps) {
  const { mode, toggleMode } = useTheme();
  return (
    <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-center gap-2">
      <button
        onClick={() => toggleMode()}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
          mode === 'dark'
            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-lg'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}
      >
        <Moon size={16} /> {darkLabel}
      </button>
      <span className="text-[var(--text-subtle)] text-xs font-bold">|</span>
      <button
        onClick={() => toggleMode()}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
          mode === 'light'
            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-lg'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}
      >
        <Sun size={16} /> {lightLabel}
      </button>
    </div>
  );
}
