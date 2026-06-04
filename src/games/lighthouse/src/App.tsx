/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { AppScreen, Upgrades } from './types';
import { StartScreen, UpgradeScreen, GameOverScreen } from './Screens';
import { GameScreen } from './components/GameScreen';
import { TRANSLATIONS } from './translations';
import { registerSoundPauser, unregisterSoundPauser } from '../../../utils/audioContext';
import { audio } from './audio';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('start');
  
  // Metagame State
  const [score, setScore] = useState(0);
  const [dayCount, setDayCount] = useState(1);
  const [lastEarnings, setLastEarnings] = useState(0);
  const [totalDockedShips, setTotalDockedShips] = useState(0);

  const [upgrades, setUpgrades] = useState<Upgrades>({
    autoFoghorn: false,
    tungstenFilament: false,
    solarBackup: false,
  });

  const [lang, setLang] = useState<'en' | 'uk'>('uk');
  const t = TRANSLATIONS[lang];

  const scoreRef = useRef(score);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const handleDayEnd = (earnings: number, shiftDocked: number) => {
    const newScore = score + earnings;
    const newTotalShips = totalDockedShips + shiftDocked;

    setLastEarnings(earnings);
    setTotalDockedShips(newTotalShips);
    setScore(newScore);
    
    if (newScore < 0 && newTotalShips >= 3) {
      setCurrentScreen('gameover');
      const odesa = (window as any).Odesa;
      if (odesa) odesa.gameOver(newScore);
    } else {
      setCurrentScreen('upgrade');
    }
  };

  const handleBuy = (key: keyof Upgrades, cost: number) => {
    if (score >= cost && !upgrades[key]) {
      setScore(prev => prev - cost);
      setUpgrades(prev => ({ ...prev, [key]: true }));
    }
  };

  const handleNextDay = () => {
    setDayCount(prev => prev + 1);
    setCurrentScreen('playing');
    window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, '*');
  };

  const handleGameOver = () => {
    const odesa = (window as any).Odesa;
    if (odesa) odesa.gameOver(scoreRef.current);
    window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, '*');
  };

  useEffect(() => {
    const odesa = (window as any).Odesa;
    if (odesa) {
      odesa.init({ gameId: 'lighthouse' });

      odesa.onConfig((config: any) => {
        if (config.lang) setLang(config.lang as 'en' | 'uk');
        if (config.sfxEnabled !== undefined) audio.setSfxEnabled(config.sfxEnabled);
      });

      odesa.onStop(() => {
        setCurrentScreen('gameover');
        if (odesa) odesa.gameOver(scoreRef.current);
      });

      odesa.ready();
    }

    const pauser = {
      pause: () => { const o = (window as any).Odesa; if (o?._triggerPause) o._triggerPause(); },
      resume: () => { const o = (window as any).Odesa; if (o?._triggerResume) o._triggerResume(); },
    };
    registerSoundPauser(pauser);

    return () => {
      unregisterSoundPauser(pauser);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] flex justify-center items-center md:py-8 font-sans selection:bg-yellow-500/30">
      {/* Mobile-first constraints block */}
      <div className="w-full h-screen md:h-[850px] max-w-[430px] bg-[#0A1128] text-white relative flex flex-col shadow-2xl md:rounded-[2.5rem] border-0 md:border-[12px] border-[#1E293B] overflow-hidden">
        
        {currentScreen === 'start' && (
          <StartScreen
            t={t}
            onStart={() => {
              setCurrentScreen('playing');
              window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, '*');
            }}
          />
        )}

        {currentScreen === 'playing' && (
          <GameScreen 
            upgrades={upgrades}
            onDayEnd={handleDayEnd}
            globalScore={score}
            totalDockedShips={totalDockedShips}
            t={t}
          />
        )}

        {currentScreen === 'upgrade' && (
          <UpgradeScreen 
            score={score}
            upgrades={upgrades}
            dayCount={dayCount}
            lastEarnings={lastEarnings}
            onBuy={handleBuy}
            onNextDay={handleNextDay}
            t={t}
          />
        )}

        {currentScreen === 'gameover' && (
          <GameOverScreen 
            score={score}
            totalDockedShips={totalDockedShips}
            dayCount={dayCount}
            onRestart={handleGameOver}
            t={t}
          />
        )}
        
      </div>
    </div>
  );
}
