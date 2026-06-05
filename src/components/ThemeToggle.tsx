import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleMode } = useTheme();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={() => { if (mode !== 'light') toggleMode(); }}
        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
          mode === 'light'
            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-50 hover:opacity-80'
        }`}
      >
        <Sun size={14} />
      </button>
      <button
        onClick={() => { if (mode !== 'dark') toggleMode(); }}
        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
          mode === 'dark'
            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-50 hover:opacity-80'
        }`}
      >
        <Moon size={14} />
      </button>
    </div>
  );
}
