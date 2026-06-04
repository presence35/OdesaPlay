import React from 'react';
import { Upgrades } from './types';
import { ShieldAlert, Sun, BatteryCharging } from 'lucide-react';
import { audio } from './audio';
import lighthouseImg from './assets/lighthouse.png';

interface StartScreenProps {
  onStart: () => void;
  t: any;
}

export function StartScreen({ onStart, t }: StartScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-between pt-12 pb-8 p-6 text-center z-10 relative bg-[#0A1128] overflow-hidden">
      {/* Background Image */}
      <div 
         className="absolute bottom-0 w-full h-1/2 z-0 opacity-70 bg-center bg-no-repeat bg-contain mix-blend-screen pointer-events-none" 
         style={{ backgroundImage: `url(${lighthouseImg})` }} 
      />

      {/* Visual Accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-100/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Title Box - at the very top */}
      <div className="relative z-10 w-full mb-8">
        <h1 className="font-display tracking-tight text-5xl font-bold uppercase drop-shadow-[0_0_15px_rgba(248,250,252,0.3)]">
          <span className="text-[#0057B7]">Vorontsov</span><br/>
          <span className="text-[#FFD700]">Keeper</span>
        </h1>
        <p className="text-slate-400 mt-4 text-sm uppercase tracking-widest">
          {t.subtitle}
        </p>
      </div>

      <div className="space-y-2 mb-auto text-sm text-slate-300 bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center w-full relative z-10 backdrop-blur-sm">
        <p><span className="text-[#FFD700] font-bold">SWIPE</span> {t.swipeRadio}</p>
        <p><span className="text-[#FFD700] font-bold">TAP</span> {t.tapLight}</p>
        <p><span className="text-[#FFD700] font-bold">SWIPE</span> {t.swipePump}</p>
      </div>

      <button
        onClick={() => {
          audio.init();
          onStart();
        }}
        className="mt-6 mb-8 px-8 py-4 bg-white text-[#0A1128] font-display font-bold uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 transition-transform relative z-10"
      >
        {t.beginShift}
      </button>
    </div>
  );
}

interface UpgradeScreenProps {
  score: number;
  upgrades: Upgrades;
  onBuy: (key: keyof Upgrades, cost: number) => void;
  onNextDay: () => void;
  dayCount: number;
  lastEarnings: number;
}

export function GameOverScreen({ score, totalDockedShips, dayCount, onRestart, t }: { score: number, totalDockedShips: number, dayCount: number, onRestart?: () => void, t?: any }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative bg-[#0A1128]">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
      
      <h1 className="font-display tracking-tight text-5xl font-bold text-red-500 mb-2 uppercase drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        {t?.youFired || "You're Fired"}
      </h1>
      <p className="text-slate-400 mb-8 text-sm uppercase tracking-widest leading-relaxed">
        {t?.firedDesc || "Too many accidents under your watch.<br/>The Port Authority has relieved you of duty."}
      </p>

      <div className="space-y-4 mb-12 text-sm text-slate-300 bg-slate-900/50 p-6 rounded-xl border border-slate-800 text-left w-full max-w-sm mx-auto">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <span className="text-slate-500 uppercase font-bold text-xs">{t?.daysSurvived || 'Days Survived'}</span>
          <span className="font-mono text-white text-lg">{dayCount}</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <span className="text-slate-500 uppercase font-bold text-xs">{t?.shipsDocked || 'Ships Docked'}</span>
          <span className="font-mono text-green-400 text-lg">{totalDockedShips}</span>
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-slate-500 uppercase font-bold text-xs">{t?.finalDebt || 'Final Debt'}</span>
          <span className="font-mono text-red-500 text-lg">{score}</span>
        </div>
      </div>

      <button
        onClick={() => onRestart?.()}
        className="px-8 py-4 bg-red-600 text-white font-display font-bold uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-95 transition-transform"
      >
        {t?.startOver || 'Start Over'}
      </button>
    </div>
  );
}

export function UpgradeScreen({ score, upgrades, onBuy, onNextDay, dayCount, lastEarnings, t }: UpgradeScreenProps & { t?: any }) {
  const shopItems: { key: keyof Upgrades; name: string; desc: string; cost: number; icon: React.ReactNode }[] = [
    {
      key: 'autoFoghorn',
      name: 'Auto Foghorn',
      desc: 'Slows down lost ships automatically during deep fog cover.',
      cost: 500,
      icon: <ShieldAlert className="w-5 h-5 text-yellow-500" />
    },
    {
      key: 'tungstenFilament',
      name: 'Tungsten Bulb',
      desc: 'High resilience filament. Slows down main light overheat rate.',
      cost: 800,
      icon: <Sun className="w-5 h-5 text-white" />
    },
    {
      key: 'solarBackup',
      name: 'Storm Battery',
      desc: 'Preserves power drain specifically when navigating through storms.',
      cost: 1200,
      icon: <BatteryCharging className="w-5 h-5 text-blue-400" />
    }
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0A1128] p-6 z-10 overflow-y-auto">
      <div className="mt-8 text-center mb-8">
        <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider">{t?.shiftComplete || 'Shift Complete'}</h2>
        <p className="text-slate-400">{t?.day || 'Day'} {dayCount}</p>
        <div className={`mt-4 inline-block px-6 py-2 rounded-full border font-mono text-xl ${
          lastEarnings >= 0 
            ? 'bg-green-900/40 text-green-400 border-green-800/50' 
            : 'bg-red-900/40 text-red-400 border-red-800/50'
        }`}>
          {lastEarnings > 0 ? '+' : ''}{lastEarnings}
        </div>
      </div>

      <div className="flex justify-between items-end mb-4 px-2 border-b border-slate-800 pb-4">
          <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">{t?.availablePoints || 'Available Points'}</span>
        <span className="text-3xl text-white font-mono font-bold">{score}</span>
      </div>

      <div className="flex-1 space-y-4">
        {shopItems.map(item => {
          const owned = upgrades[item.key];
          const canAfford = score >= item.cost;
          return (
            <div key={item.key} className={`p-4 rounded-xl border flex items-center gap-4 ${owned ? 'bg-slate-800/30 border-yellow-900/30 opacity-70' : 'bg-slate-900 border-slate-800'}`}>
              <div className="p-3 bg-slate-950 rounded-lg">{item.icon}</div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-bold">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {!owned && <span className="font-mono text-xs font-bold text-slate-300">{item.cost}</span>}
                <button
                  disabled={owned || !canAfford}
                  onClick={() => onBuy(item.key, item.cost)}
                  className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider
                    ${owned ? 'bg-yellow-900/20 text-yellow-600 border border-yellow-900/30' 
                    : canAfford ? 'bg-white text-[#0A1128] active:scale-95' 
                    : 'bg-slate-800 text-slate-600'}
                  `}
                >
                  {owned ? (t?.owned || 'Owned') : (t?.get || 'Get')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onNextDay}
        className="w-full mt-6 py-4 bg-yellow-500 text-slate-950 font-display font-bold uppercase tracking-widest rounded-full uppercase shadow-[0_4px_20px_rgba(234,179,8,0.3)] active:bg-yellow-400"
      >
        {t?.startNextShift || 'Start Next Shift'}
      </button>
    </div>
  );
}
