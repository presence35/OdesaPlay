import React from 'react';
import { Upgrades } from './types';
import { ShieldAlert, Sun, BatteryCharging } from 'lucide-react';

interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative bg-[#0A1128]">
      {/* Visual Accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-100/10 rounded-full blur-3xl pointer-events-none" />
      
      <h1 className="font-display tracking-tight text-5xl font-bold text-white mb-2 uppercase drop-shadow-[0_0_15px_rgba(248,250,252,0.3)]">
        Vorontsov<br/>Keeper
      </h1>
      <p className="text-slate-400 mb-8 text-sm uppercase tracking-widest">
        Odesa Port Authority
      </p>

      <div className="space-y-4 mb-12 text-sm text-slate-300 bg-slate-900/50 p-6 rounded-xl border border-slate-800 text-left w-full">
        <p className="flex items-center gap-3"><span className="text-yellow-400 font-bold">1.</span> TAP & HOLD light to guide ships.</p>
        <p className="flex items-center gap-3"><span className="text-yellow-400 font-bold">2.</span> SWIPE radio to match frequencies.</p>
        <p className="flex items-center gap-3"><span className="text-yellow-400 font-bold">3.</span> SWIPE up/down to pump generator.</p>
      </div>

      <button
        onClick={onStart}
        className="px-8 py-4 bg-white text-[#0A1128] font-display font-bold uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"
      >
        Begin Night Shift
      </button>
    </div>
  );
}

interface UpgradeScreenProps {
  money: number;
  upgrades: Upgrades;
  onBuy: (key: keyof Upgrades, cost: number) => void;
  onNextDay: () => void;
  dayCount: number;
  lastEarnings: number;
}

export function UpgradeScreen({ money, upgrades, onBuy, onNextDay, dayCount, lastEarnings }: UpgradeScreenProps) {
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
        <h2 className="font-display text-2xl font-bold text-white uppercase tracking-wider">Shift Complete</h2>
        <p className="text-slate-400">Day {dayCount}</p>
        <div className="mt-4 inline-block bg-green-900/40 text-green-400 px-6 py-2 rounded-full border border-green-800/50 font-mono text-xl">
          +{lastEarnings} ₴
        </div>
      </div>

      <div className="flex justify-between items-end mb-4 px-2 border-b border-slate-800 pb-4">
        <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">Available Funds</span>
        <span className="text-3xl text-white font-mono font-bold">{money} ₴</span>
      </div>

      <div className="flex-1 space-y-4">
        {shopItems.map(item => {
          const owned = upgrades[item.key];
          const canAfford = money >= item.cost;
          return (
            <div key={item.key} className={`p-4 rounded-xl border flex items-center gap-4 ${owned ? 'bg-slate-800/30 border-yellow-900/30 opacity-70' : 'bg-slate-900 border-slate-800'}`}>
              <div className="p-3 bg-slate-950 rounded-lg">{item.icon}</div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-bold">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {!owned && <span className="font-mono text-xs font-bold text-slate-300">{item.cost} ₴</span>}
                <button
                  disabled={owned || !canAfford}
                  onClick={() => onBuy(item.key, item.cost)}
                  className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider
                    ${owned ? 'bg-yellow-900/20 text-yellow-600 border border-yellow-900/30' 
                    : canAfford ? 'bg-white text-[#0A1128] active:scale-95' 
                    : 'bg-slate-800 text-slate-600'}
                  `}
                >
                  {owned ? 'Owned' : 'Buy'}
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
        Start Next Shift
      </button>
    </div>
  );
}
