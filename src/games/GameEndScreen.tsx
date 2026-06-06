import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface GameEndScreenProps {
  score: number;
  won?: boolean;
  imageSrc?: string;
  title: { win: string; lose: string };
  subtitle?: string;
  onPlayAgain: () => void;
  onQuit?: () => void;
  t: { playAgain: string; tryAgain: string; quit?: string };
  children?: ReactNode;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function GameEndScreen({ score, won, imageSrc, title, subtitle, onPlayAgain, onQuit, t, children, secondaryLabel, onSecondary }: GameEndScreenProps) {
  const isWin = won;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute inset-0 z-[100] ${
        isWin
          ? 'bg-gradient-to-b from-[var(--accent-bg)] via-[var(--accent-bg)] to-[var(--bg-secondary)]'
          : 'bg-[var(--bg-primary)]'
      } flex flex-col items-center justify-center p-6 landscape:p-3 text-center text-[var(--text-primary)]`}
    >
      {isWin && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-[var(--accent-bg)]/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-[var(--accent-bg)]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 bg-[var(--accent-bg)] rounded-full"
              initial={{ x: Math.random() * window.innerWidth, y: -20, opacity: 1 }}
              animate={{ y: window.innerHeight + 20, opacity: 0 }}
              transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>
      )}
      <div className="relative z-10">
        <h2 className={`text-5xl sm:text-7xl font-black mb-4 landscape:text-3xl landscape:mb-2 ${
          isWin ? 'text-[var(--text-primary)] drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)]' : 'text-[var(--text-error)] drop-shadow-lg'
        }`}>
          {isWin ? title.win : title.lose}
        </h2>
        {subtitle && <p className="mb-8 landscape:mb-3 mx-auto opacity-80 max-w-sm text-lg landscape:text-base text-[var(--text-muted)]">{subtitle}</p>}
        <div className="flex gap-8 sm:gap-12 mb-10 landscape:mb-5 bg-[var(--bg-overlay)] px-16 py-10 landscape:px-8 landscape:py-4 rounded-[2rem] backdrop-blur-md border border-[var(--border-default)] items-center justify-center shadow-2xl">
          <div className="flex flex-col items-center">
            {imageSrc && (
              <img src={imageSrc} className="w-20 h-20 landscape:w-12 landscape:h-12 object-contain mb-2 drop-shadow-xl" alt="" />
            )}
            {children}
            <span className="text-5xl landscape:text-3xl font-black tabular-nums text-[var(--text-primary)]">{score}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 landscape:gap-1.5">
          <button
            onClick={onPlayAgain}
            className={`px-10 py-5 rounded-2xl font-black text-2xl landscape:px-6 landscape:py-2.5 landscape:text-lg transition-[transform,shadow,filter] duration-200 active:scale-95 shadow-2xl hover:scale-105 transform-gpu bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:brightness-110`}
          >
            {t.playAgain}
          </button>
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm landscape:text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {secondaryLabel}
            </button>
          )}
          {onQuit && (
            <button
              onClick={onQuit}
              className="text-[var(--text-error)]/60 hover:text-[var(--text-error)] text-xs font-bold uppercase tracking-widest transition-colors mt-1 landscape:mt-0"
            >
              {t.quit || 'Quit'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
