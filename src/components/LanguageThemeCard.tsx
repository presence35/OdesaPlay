import { type Language, type translations } from '../language';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';

type Translations = typeof translations.en;

interface LanguageThemeCardProps {
  lang: Language;
  onLangChange: (l: Language) => void;
  t: Translations;
  variant: 'language' | 'theme';
}

export default function LanguageThemeCard({ lang, onLangChange, t, variant }: LanguageThemeCardProps) {
  const { family, setFamily } = useTheme();

  if (variant === 'language') {
    return (
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => onLangChange('uk')} className="group p-0 border-0 bg-transparent cursor-pointer">
          <img src="/images/ukraine.png"
            className={`max-sm:w-10 w-12 transition-all rounded-lg ${
              lang === 'uk'
                ? 'ring-2 ring-[var(--btn-primary-bg)]'
                : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
            }`}
            alt="Українська" />
        </button>
        <button onClick={() => onLangChange('en')} className="group p-0 border-0 bg-transparent cursor-pointer">
          <img src="/images/english.png"
            className={`max-sm:w-10 w-12 transition-all rounded-lg ${
              lang === 'en'
                ? 'ring-2 ring-[var(--btn-primary-bg)]'
                : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
            }`}
            alt="English" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <button onClick={() => setFamily('odesa')} className="group p-0 border-0 bg-transparent cursor-pointer">
        <img src="/images/odesa.png"
          className={`max-sm:w-10 w-12 transition-all rounded-lg ${
            family === 'odesa'
              ? 'ring-2 ring-[var(--btn-primary-bg)]'
              : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
          }`}
          alt="Odesa" />
      </button>
      <button onClick={() => setFamily('ukraine')} className="group p-0 border-0 bg-transparent cursor-pointer">
        <img src="/images/ukraine.png"
          className={`max-sm:w-10 w-12 transition-all rounded-lg ${
            family === 'ukraine'
              ? 'ring-2 ring-[var(--btn-primary-bg)]'
              : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
          }`}
          alt="Ukraine" />
      </button>
      <ThemeToggle />
    </div>
  );
}
