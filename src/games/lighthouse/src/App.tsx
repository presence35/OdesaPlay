/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { AppScreen, Upgrades } from './types';
import { StartScreen, UpgradeScreen, GameOverScreen } from './Screens';
import { GameScreen } from './components/GameScreen';

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

  const handleDayEnd = (earnings: number, shiftDocked: number) => {
    setLastEarnings(earnings);
    setTotalDockedShips(prev => prev + shiftDocked);
    setScore(prev => prev + earnings);
    
    // Check if points go below 0 after having docked 3 or more ships
    if (score + earnings < 0 && (totalDockedShips + shiftDocked) >= 3) {
      setCurrentScreen('gameover');
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
  };

  return (
    <div className="min-h-screen bg-[#020617] flex justify-center items-center md:py-8 font-sans selection:bg-yellow-500/30">
      {/* Mobile-first constraints block */}
      <div className="w-full h-screen md:h-[850px] max-w-[430px] bg-[#0A1128] text-white relative flex flex-col shadow-2xl md:rounded-[2.5rem] border-0 md:border-[12px] border-[#1E293B] overflow-hidden">
        
        {currentScreen === 'start' && (
          <StartScreen onStart={() => setCurrentScreen('playing')} />
        )}

        {currentScreen === 'playing' && (
          <GameScreen 
            upgrades={upgrades}
            onDayEnd={handleDayEnd}
            globalScore={score}
            totalDockedShips={totalDockedShips}
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
          />
        )}

        {currentScreen === 'gameover' && (
          <GameOverScreen 
            score={score}
            totalDockedShips={totalDockedShips}
            dayCount={dayCount}
          />
        )}
        
      </div>
    </div>
  );
}
