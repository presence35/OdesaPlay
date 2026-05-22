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
          ? 'bg-gradient-to-b from-blue-600 via-blue-500 to-amber-500'
          : 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900'
      } flex flex-col items-center justify-center p-6 landscape:p-3 text-center text-white`}
    >
      {isWin && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-yellow-400/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-yellow-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 bg-yellow-400 rounded-full"
              initial={{ x: Math.random() * window.innerWidth, y: -20, opacity: 1 }}
              animate={{ y: window.innerHeight + 20, opacity: 0 }}
              transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>
      )}
      <div className="relative z-10">
        <h2 className={`text-5xl sm:text-7xl font-black mb-4 landscape:text-3xl landscape:mb-2 ${
          isWin ? 'text-white drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)]' : 'text-red-500 drop-shadow-lg'
        }`}>
          {isWin ? title.win : title.lose}
        </h2>
        {subtitle && <p className="mb-8 landscape:mb-3 mx-auto opacity-80 max-w-sm text-lg landscape:text-base text-slate-300">{subtitle}</p>}
        <div className="flex gap-8 sm:gap-12 mb-10 landscape:mb-5 bg-black/30 px-16 py-10 landscape:px-8 landscape:py-4 rounded-[2rem] backdrop-blur-md border border-white/10 items-center justify-center shadow-2xl">
          <div className="flex flex-col items-center">
            {imageSrc && (
              <img src={imageSrc} className="w-20 h-20 landscape:w-12 landscape:h-12 object-contain mb-2 drop-shadow-xl" alt="" />
            )}
            {children}
            <span className="text-5xl landscape:text-3xl font-black tabular-nums text-white">{score}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 landscape:gap-1.5">
          <button
            onClick={onPlayAgain}
            className={`px-10 py-5 rounded-2xl font-black text-2xl landscape:px-6 landscape:py-2.5 landscape:text-lg transition-[transform,shadow,filter] duration-200 active:scale-95 shadow-2xl hover:scale-105 transform-gpu ${
              isWin
                ? 'bg-white text-blue-600 hover:bg-gray-100'
                : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:brightness-110'
            }`}
          >
            {t.playAgain}
          </button>
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="text-white/60 hover:text-white text-sm landscape:text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {secondaryLabel}
            </button>
          )}
          {onQuit && (
            <button
              onClick={onQuit}
              className="text-red-400/60 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors mt-1 landscape:mt-0"
            >
              {t.quit || 'Quit'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
