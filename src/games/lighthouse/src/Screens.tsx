import React from 'react';
import { Upgrades } from './types';
import { ShieldAlert, Sun, BatteryCharging } from 'lucide-react';
import { audio } from './audio';
import lighthouseImg from './assets/lighthouse.png';

function RadioDialSVG() {
  return (
    <svg width="40" height="16" viewBox="0 0 40 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="4" width="39" height="8" rx="4" className="fill-slate-800" stroke="#334155" strokeWidth="0.5" />
      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(i =>
        <rect key={i} x={1.5 + i * 1.8} y={i % 5 === 0 ? 5 : 6} width="0.5" height={i % 5 === 0 ? 6 : 3} className="fill-slate-500" />
      )}
      <rect x="17" y="2" width="6" height="12" rx="2" className="fill-red-500" />
    </svg>
  );
}

function LightButtonSVG() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" className="fill-slate-800" stroke="#475569" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="10" className="fill-slate-700" />
      <circle cx="16" cy="16" r="4" className="fill-yellow-400" />
      {[0,45,90,135,180,225,270,315].map(angle => (
        <line key={angle} x1="16" y1="4" x2="16" y2="7" className="stroke-yellow-400" strokeWidth="1.5" strokeLinecap="round"
          transform={`rotate(${angle} 16 16)`} />
      ))}
    </svg>
  );
}

function ShipFreqSVG() {
  return (
    <svg width="44" height="20" viewBox="0 0 44 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="0" width="16" height="7" rx="1.5" className="fill-yellow-400/30" stroke="#facc15" strokeWidth="0.6" />
      <text x="28" y="5.5" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fontWeight="bold" className="fill-yellow-400">88.0</text>
      <path d="M4 14 L36 14 Q38 14 38 8 L33 8 L31 3 L15 3 L13 8 L4 8 Q1.5 8 2.5 14 Z" className="fill-[#cbd5e1]" />
      <rect x="18" y="1.5" width="2" height="5" className="fill-red-500" />
      <circle cx="6.5" cy="11" r="0.9" className="fill-slate-800" />
      <circle cx="12.5" cy="11" r="0.9" className="fill-slate-800" />
      <circle cx="18.5" cy="11" r="0.9" className="fill-slate-800" />
      <circle cx="24.5" cy="11" r="0.9" className="fill-slate-800" />
      <circle cx="30.5" cy="11" r="0.9" className="fill-slate-800" />
    </svg>
  );
}

function PumpSVG() {
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="26" height="32" rx="4" className="fill-slate-800" stroke="#334155" strokeWidth="1" />
      <rect x="5" y="18" width="18" height="12" rx="2" className="fill-blue-600/50" />
      <line x1="9" y1="8" x2="19" y2="8" className="stroke-slate-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="12" x2="21" y2="12" className="stroke-slate-600" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="14,26 12,22 16,22" className="fill-slate-400" />
      <line x1="14" y1="26" x2="14" y2="29" className="stroke-slate-400" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface StartScreenProps {
  onStart: () => void;
  t: any;
}

export function StartScreen({ onStart, t }: StartScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center p-6 text-center z-10 relative pt-12">
      {/* Visual Accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-100/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Title Box */}
      <div className="relative z-10 w-full mb-6">
        <h1 className="font-display tracking-tight text-5xl font-bold uppercase drop-shadow-[0_0_15px_rgba(248,250,252,0.3)]">
          <span className="text-[#0057B7]">{t.titlePart1}</span><br/>
          <span className="text-[#FFD700]">{t.titlePart2}</span>
        </h1>
        <p className="text-slate-400 mt-4 text-sm uppercase tracking-widest">
          {t.subtitle}
        </p>
      </div>

      <div className="space-y-3 text-sm text-slate-300 bg-slate-900/50 p-4 rounded-xl border border-slate-800 w-full relative z-10 backdrop-blur-sm flex flex-col items-center">
        <div className="flex items-center gap-3">
          <RadioDialSVG />
          <span><span className="text-[#FFD700] font-bold">{t.actionSwipe}</span> {t.swipeRadio}</span>
          <ShipFreqSVG />
        </div>
        <div className="flex items-center gap-3">
          <LightButtonSVG />
          <span><span className="text-[#FFD700] font-bold">{t.actionTap}</span> {t.tapLight}</span>
        </div>
        <div className="flex items-center gap-3">
          <PumpSVG />
          <span><span className="text-[#FFD700] font-bold">{t.actionSwipe}</span> {t.swipePump}</span>
        </div>
      </div>

      <button
        onClick={() => {
          audio.init();
          onStart();
        }}
        className="mt-8 mb-6 px-8 py-4 bg-white text-[#0A1128] font-display font-bold uppercase tracking-widest rounded-full border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,255,255,0.4),0_0_15px_rgba(255,215,0,0.3)] active:scale-95 transition-transform relative z-10"
      >
        {t.beginShift}
      </button>

      <img src={lighthouseImg} alt="" className="block w-auto h-[35vh] object-contain mx-auto" />
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
