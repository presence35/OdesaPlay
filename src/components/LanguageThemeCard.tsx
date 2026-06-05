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
      <div className="flex items-center justify-center gap-6">
        <button onClick={() => onLangChange('uk')} className="group">
          <div className={`w-14 h-14 flex items-center justify-center text-4xl transition-all ${
            lang === 'uk'
              ? 'scale-110'
              : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
          }`}>
            🇺🇦
          </div>
        </button>
        <button onClick={() => onLangChange('en')} className="group">
          <div className={`w-14 h-14 flex items-center justify-center text-4xl transition-all ${
            lang === 'en'
              ? 'scale-110'
              : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
          }`}>
            🇺🇸
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-6">
      <button onClick={() => setFamily('odesa')} className="group">
        <div className={`w-14 h-14 flex items-center justify-center transition-all ${
          family === 'odesa'
            ? 'scale-110'
            : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
        }`}>
          <img src="/images/odesa.png" className="w-12 h-12 object-contain" alt="Odesa" />
        </div>
      </button>
      <button onClick={() => setFamily('ukraine')} className="group">
        <div className={`w-14 h-14 flex items-center justify-center transition-all ${
          family === 'ukraine'
            ? 'scale-110'
            : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'
        }`}>
          <img src="/images/ukraine.png" className="w-12 h-12 object-contain" alt="Ukraine" />
        </div>
      </button>
      <ThemeToggle />
    </div>
  );
}
