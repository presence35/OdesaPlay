import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { translations, type Language } from '../language';

const BETA_BANNER_KEY = 'odesa_beta_banner_dismissed';

export default function BetaBanner() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<Language>('uk');

  useEffect(() => {
    setLang((localStorage.getItem('odesa_lang') as Language) || 'uk');
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem(BETA_BANNER_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(BETA_BANNER_KEY, 'true');
    setVisible(false);
  };

  const t = translations[lang];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[300] bg-[var(--accent-bg)] text-[var(--text-on-accent)]"
        >
          <div className="flex items-center justify-between px-4 h-9 text-sm font-bold uppercase tracking-wider">
            <span>{t.betaBanner}</span>
            <button
              onClick={dismiss}
              className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
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
