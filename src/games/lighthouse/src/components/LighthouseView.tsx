import React from 'react';
import { Ship, Weather } from '../types';
import { Radio } from 'lucide-react';

interface LighthouseViewProps {
  weather: Weather;
  ships: Ship[];
  lightOn: boolean;
  timeRemaining: number;
}

export function LighthouseView({ weather, ships, lightOn, timeRemaining }: LighthouseViewProps) {
  // Format time (ms -> M:SS)
  const totalSeconds = Math.ceil(timeRemaining / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;

  return (
    <div className="relative w-full h-[45%] bg-[#0A1128] overflow-hidden flex flex-col justify-end isolate">
      {/* Weather Effects */}
      {weather === 'fog' && (
        <div className="absolute inset-0 bg-slate-300/30 backdrop-blur-[2px] z-20 pointer-events-none transition-all duration-1000" />
      )}
      {weather === 'storm' && (
        <div className="absolute inset-0 bg-blue-950/40 z-20 pointer-events-none mix-blend-multiply transition-all duration-1000" />
      )}

      {/* Header Info Grid */}
      <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-start pointer-events-none">
        <div className="font-mono text-2xl font-bold text-white drop-shadow-md">
          {timeStr}
        </div>
        <div className={`px-3 py-1 rounded border uppercase font-bold text-xs tracking-widest shadow-md flex items-center gap-2 transition-colors
          ${weather === 'clear' ? 'bg-slate-900/60 border-slate-500 text-slate-300' : ''}
          ${weather === 'fog' ? 'bg-white/80 border-slate-300 text-slate-800' : ''}
          ${weather === 'storm' ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse' : ''}
        `}>
          {weather === 'storm' && <span className="w-2 h-2 rounded-full bg-red-500" />}
          {weather}
        </div>
      </div>

      {/* Sea Horizon (Bottom 25% of this view) */}
      <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-[#050B14] border-t border-slate-800 z-10" />

      {/* The Vorontsov Lighthouse */}
      <div className="absolute bottom-[20%] left-8 z-30 flex flex-col items-center">
        {/* Gallery & Lamp */}
        <div className="relative">
          {/* Bulb/Glass housing */}
          <div className="w-6 h-8 bg-slate-200/20 backdrop-blur-sm border-2 border-slate-700/50 rounded-t-lg z-10 relative flex justify-center items-center">
            {/* The Light element */}
            <div className={`w-2 h-3 rounded-full transition-colors duration-75 ${lightOn ? 'bg-white shadow-[0_0_20px_4px_rgba(255,255,255,0.9)]' : 'bg-slate-700'}`} />
          </div>
          {/* Gallery Deck */}
          <div className="absolute -bottom-1 -left-2 -right-2 h-2 bg-slate-800 border-t border-slate-600 rounded-sm" />
        </div>
        {/* Tower Body */}
        <div className="w-10 h-32 bg-gradient-to-b from-white via-slate-100 to-slate-400 rounded-t-sm shadow-[inset_-6px_0_10px_rgba(0,0,0,0.2)] mt-1 border border-slate-300 flex flex-col items-center py-2 gap-4">
           {/* Tower Windows */}
           <div className="w-2 h-3 bg-[#0A1128] rounded-full opacity-60"></div>
           <div className="w-2 h-3 bg-[#0A1128] rounded-full opacity-60"></div>
        </div>
        {/* Base */}
        <div className="w-16 h-8 bg-slate-800 rounded-t-md -mt-2 border-t-2 border-slate-600" />
      </div>

      {/* The Light Beam (Polygon shape fading to right) */}
      <div 
        className={`absolute bottom-[20%] left-[4.5rem] top-1/2 -translate-y-[60px] w-[150vw] h-[120px] pointer-events-none z-15 origin-left rotate-[0deg] transition-opacity duration-150 ${lightOn ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)',
          clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 60%)'
        }}
      />

      {/* Ships approaching */}
      {ships.map(s => {
        // Distance 100 -> left: 100%
        // Distance 0 -> left: 15% (near lighthouse)
        const leftPos = 15 + (s.distance * 0.85);
        const yOffset = parseInt(s.id, 16) % 15; // small vertical variance
        
        let visibilityClass = "opacity-100";
        if (weather === 'fog' && !lightOn) visibilityClass = "opacity-60 blur-[1px]";
        if (weather === 'storm' && s.distance > 40) visibilityClass = "opacity-0"; // Invisible far away in storm

        return (
          <div 
            key={s.id} 
            className={`absolute bottom-[30%] z-30 transition-all duration-75 ${visibilityClass}`} 
            style={{ 
              left: `${leftPos}%`, 
              transform: `translateY(${yOffset}px)`
            }}
          >
            {/* The Ship Vector (simple silhouette) */}
            <div className={`relative ${s.status === 'crashed' ? 'animate-ping' : ''}`}>
               {/* Ship Body */}
               {s.status === 'crashed' ? (
                 <div className="w-8 h-8 rounded-full bg-red-500 opacity-80" />
               ) : (
                 <div className="w-8 h-3 bg-white rounded-l-full rounded-tr-sm relative shadow-md">
                    <div className="absolute bottom-full right-2 w-3 h-4 bg-slate-300" />
                 </div>
               )}

               {/* Radio Frequency Popup (Audio Radar Interface) */}
               {s.status === 'approaching' && s.distance < 85 && (
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded flex items-center justify-center shadow-lg pointer-events-none">
                    <span className="text-yellow-400 font-mono text-xs font-bold leading-none">{s.frequency.toFixed(1)}</span>
                 </div>
               )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
