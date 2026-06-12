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
import LoadingTrident from '../../../components/LoadingTrident';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('start');
  
  // Metagame State
  const [score, setScore] = useState(0);
  const [dayCount, setDayCount] = useState(1);
  const [lastEarnings, setLastEarnings] = useState(0);
  const [splashItems, setSplashItems] = useState<any[]>([]);
  const [totalDockedShips, setTotalDockedShips] = useState(0);

  const [upgrades, setUpgrades] = useState<Upgrades>({
    autoFoghorn: false,
    tungstenFilament: false,
    solarBackup: false,
  });

  const [lang, setLang] = useState<'en' | 'uk'>('uk');
  const [isAdmin, setIsAdmin] = useState(false);
  const t = TRANSLATIONS[lang];

  const scoreRef = useRef(score);
  useEffect(() => { scoreRef.current = score; }, [score]);
  const careerScoreRef = useRef(0);

  const handleDayEnd = (earnings: number, shiftDocked: number) => {
    const newScore = score + earnings;
    const newTotalShips = totalDockedShips + shiftDocked;

    setLastEarnings(earnings);
    setTotalDockedShips(newTotalShips);
    setScore(newScore);
    if (earnings > 0) careerScoreRef.current += earnings;
    
    if (newScore < 0 && newTotalShips >= 3) {
      setCurrentScreen('gameover');
      const odesa = (window as any).Odesa;
      if (odesa) odesa.gameOver(Math.max(0, careerScoreRef.current));
    } else {
      setCurrentScreen('upgrade');
    }
  };

  const handleNextDay = () => {
    setDayCount(prev => prev + 1);
    setCurrentScreen('playing');
    window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, '*');
  };

  const handleGameOver = () => {
    window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, '*');
  };

  useEffect(() => {
    const odesa = (window as any).Odesa;
    if (odesa) {
      odesa.init({ gameId: 'lighthouse' });

      odesa.onConfig((config: any) => {
        if (config.lang) setLang(config.lang as 'en' | 'uk');
        if (config.sfxEnabled !== undefined) audio.setSfxEnabled(config.sfxEnabled);
        if (config.isAdmin !== undefined) setIsAdmin(config.isAdmin);
        if (config.inventory?.lighthouse) {
          setUpgrades({
            autoFoghorn: !!config.inventory.lighthouse.autoFoghorn,
            tungstenFilament: !!config.inventory.lighthouse.tungstenFilament,
            solarBackup: !!config.inventory.lighthouse.solarBackup,
          });
        }
      });

      odesa.onStop(() => {
        setCurrentScreen('gameover');
        if (odesa) odesa.gameOver(Math.max(0, careerScoreRef.current));
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
      audio.stop();
    };
  }, []);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return !isReady ? (
    <LoadingTrident className="absolute inset-0 bg-[#0A1128]" />
  ) : (
    <div className="absolute inset-0 bg-[#0A1128] text-white flex flex-col overflow-hidden">
      
      {currentScreen === 'start' && (
        <StartScreen
          t={t}
          splashItems={splashItems}
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
          isAdmin={isAdmin}
        />
      )}

      {currentScreen === 'upgrade' && (
        <UpgradeScreen 
          dayCount={dayCount}
          lastEarnings={lastEarnings}
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
  );
}
