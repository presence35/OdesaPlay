import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { translations, type Language } from '../language';

const BETA_BANNER_KEY = 'odesa_beta_banner_dismissed';

export default function BetaBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [gamePlaying, setGamePlaying] = useState(false);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('odesa_lang') as Language) || 'uk');

  useEffect(() => {
    const updateLang = () => setLang((localStorage.getItem('odesa_lang') as Language) || 'uk');
    updateLang();
    setDismissed(localStorage.getItem(BETA_BANNER_KEY) === 'true');
    window.addEventListener('odesa:langchange', updateLang);
    return () => window.removeEventListener('odesa:langchange', updateLang);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => setGamePlaying((e as CustomEvent).detail.playing);
    window.addEventListener('odesa:game', handler);
    return () => window.removeEventListener('odesa:game', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(BETA_BANNER_KEY, 'true');
    setDismissed(true);
  };

  const t = translations[lang];

  return (
    <AnimatePresence>
      {!dismissed && !gamePlaying && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[300] bg-[var(--accent-bg)]"
        >
          <div className="flex items-center justify-between px-4 h-9 text-sm font-bold uppercase tracking-wider text-[#0057b8]">
            <span>{t.betaBanner}</span>
            <button
              onClick={dismiss}
              className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer text-red-500"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
