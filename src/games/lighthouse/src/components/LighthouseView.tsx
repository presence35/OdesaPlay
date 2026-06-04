import React, { useMemo } from 'react';
import { Ship, Weather, ScorePopup, Drone } from '../types';
import { Radio } from 'lucide-react';
import lighthouseImg from '../assets/lighthouse.png';

interface LighthouseViewProps {
  weather: Weather;
  ships: Ship[];
  lightOn: boolean;
  popups: ScorePopup[];
  lightningAlpha?: number;
  drones?: Drone[];
  onCycleWeather?: () => void;
}

export function LighthouseView({ weather, ships, lightOn, popups, lightningAlpha = 0, drones = [], onCycleWeather }: LighthouseViewProps) {

  return (
    <div className="relative w-full h-[45%] bg-[#0A1128] overflow-hidden flex flex-col justify-end isolate">
      {/* Weather Effects */}
      {weather === 'clear' && (
        <React.Fragment>
          {useMemo(() => (
            <div className="absolute inset-0 z-10 pointer-events-none">
              {Array.from({length: 40}).map((_, i) => (
                 <div key={i} className="absolute bg-white rounded-full opacity-60" style={{
                    top: `${Math.random()*65}%`, left: `${Math.random()*100}%`,
                    width: `${Math.random()*2+1}px`, height: `${Math.random()*2+1}px`,
                    animation: `pulse ${Math.random()*3+2}s infinite`
                 }} />
              ))}
            </div>
          ), [])}
        </React.Fragment>
      )}
      {weather === 'fog' && (
         <div className="absolute inset-0 bg-slate-300/30 backdrop-blur-[2px] z-20 pointer-events-none transition-all duration-1000" />
      )}
      {weather === 'storm' && (
        <React.Fragment>
          <div className="absolute inset-0 bg-blue-950/40 z-20 pointer-events-none mix-blend-multiply transition-all duration-1000" />
          {lightningAlpha > 0 && (
            <div 
              className="absolute inset-0 bg-white z-20 pointer-events-none mix-blend-overlay"
              style={{ opacity: lightningAlpha }}
            />
          )}
        </React.Fragment>
      )}

      {/* Drones */}
      {drones.map(d => (
        <div 
          key={d.id} 
          className="absolute z-20 pointer-events-none transition-all duration-100"
          style={{ 
            top: `${d.altitude}%`, 
            left: `${d.progress}%`,
            transform: `translateX(-50%) ${d.direction === 1 ? 'scaleX(-1)' : ''}`,
            opacity: (d.direction === 1 ? (d.progress > -20 && d.progress < 120) : (d.progress > -20 && d.progress < 120)) ? 1 : 0
          }}
        >
          <div className="rotate-[15deg]">
            <svg viewBox="0 0 100 40" className="w-10 h-10 drop-shadow-2xl">
              {/* Main body delta wing */}
              <path d="M 10,20 L 80,8 L 80,32 Z" fill="#1e293b" />
              {/* Central fuselage */}
              <path d="M 5,20 L 85,20 L 75,26 L 15,26 Z" fill="#334155" />
              {/* Vertical stabilizer */}
              <path d="M 75,8 L 82,2 L 82,14 Z" fill="#0f172a" stroke="#475569" strokeWidth="1" />
              {/* Propeller indication */}
              <line x1="85" y1="15" x2="85" y2="25" stroke="#ef4444" strokeWidth="3" opacity="0.8" />
            </svg>
          </div>
        </div>
      ))}

      {/* Header Info Grid */}
      <div className="absolute top-4 left-4 right-4 z-40 flex justify-end items-start pointer-events-none">
        <div 
          onClick={onCycleWeather}
          className={`pointer-events-auto cursor-pointer px-3 py-1 rounded border uppercase font-bold text-xs tracking-widest shadow-md flex items-center gap-2 transition-colors
          ${weather === 'clear' ? 'bg-slate-900/60 border-slate-500 text-slate-300' : ''}
          ${weather === 'fog' ? 'bg-white/80 border-slate-300 text-slate-800' : ''}
          ${weather === 'storm' ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse' : ''}
        `}>
          {weather === 'storm' && <span className="w-2 h-2 rounded-full bg-red-500" />}
          {weather}
        </div>
      </div>

      {/* Sea Horizon */}
      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-[#050B14] border-t border-slate-800 z-[5]" />

      {/* The Vorontsov Lighthouse */}
      <div className="absolute bottom-0 -left-6 md:-left-2 z-[40] flex items-end drop-shadow-2xl scale-[0.28] md:scale-[0.36] origin-bottom-left">
          <div className="relative">
           {/* SVG rendering */}
           <img src={lighthouseImg} alt="Lighthouse" width="240" height="400" className={`object-contain transition-all duration-1000 ${weather === 'storm' ? 'brightness-50' : weather === 'fog' ? 'brightness-75 blur-[1px]' : ''}`} />
           
           {/* Light Beam overlay */}
           <div 
              className={`absolute top-[182px] left-[110px] w-[200vw] h-[160px] -translate-y-1/2 rotate-[25deg] pointer-events-none z-40 origin-left transition-opacity duration-150 ${lightOn ? 'opacity-100' : 'opacity-0'}`}
              style={{
                background: 'linear-gradient(90deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)',
                clipPath: 'polygon(0 45%, 100% 10px, 100% 100%, 0 55%)'
              }}
            />
          </div>
      </div>

      {/* Ships approaching */}
      {ships.map(s => {
        // Distance 100 -> left: 100%
        // Distance 0 -> left: 15% (near lighthouse)
        const leftPos = Math.max(15, 15 + (s.distance * 0.85));
        
        // Use lanes (0, 1, 2) to compute vertical offset:
        const laneOffset = 10 + ((s.lane || 0) * 18); // 10px, 28px, 46px - all under 80px sea horizon
        const yOffset = parseInt(s.id, 16) % 3; // tiny jitter
        
        let visibilityClass = "opacity-100";
        if (weather === 'fog' && !lightOn) visibilityClass = "opacity-40 blur-[2px]";
        if (weather === 'storm') {
          if (s.distance > 40) {
            visibilityClass = lightOn ? "opacity-[0.15]" : "opacity-10";
          } else {
            visibilityClass = lightOn ? "opacity-75" : "opacity-50";
          }
        }

        return (
          <div 
            key={s.id} 
            className={`absolute transition-all duration-300 pointer-events-none ${visibilityClass}`} 
            style={{ 
              bottom: `${laneOffset}px`,
              left: `${leftPos}%`,
              zIndex: 40 - (s.lane || 0),
              transform: `translateY(${yOffset}px) scale(${1 - ((s.lane || 0) * 0.15)})`
            }}
          >
            {/* The Ship Vector */}
            <div className={`relative ${s.status === 'crashed' ? 'animate-ping' : ''}`}>
               {s.status === 'crashed' ? (
                 <div className="w-12 h-6 rounded flex items-end justify-center bg-transparent">
                    <span className="text-xl">💥</span>
                 </div>
               ) : (
                 <div className={`relative w-14 h-6 transition-colors duration-300 ${s.status === 'cleared' ? 'opacity-50 blur-sm brightness-150' : ''}`}>
                    <svg viewBox="0 0 100 40" className={`w-full h-full drop-shadow-lg transition-colors ${s.status === 'cleared' ? 'text-green-400 fill-current' : 'text-slate-300 fill-current'}`}>
                       {s.shipClass === 'speedboat' ? (
                          <React.Fragment>
                             <path d="M 5,35 L 85,35 C 95,35 100,20 90,20 L 70,20 L 55,10 L 35,10 L 30,20 L 5,20 C 0,30 0,35 5,35 Z" />
                             <rect x="40" y="5" width="3" height="15" fill="#3b82f6" />
                             <circle cx="25" cy="27" r="2.5" fill="#0f172a" />
                             <circle cx="45" cy="27" r="2.5" fill="#0f172a" />
                          </React.Fragment>
                       ) : s.shipClass === 'cargoship' ? (
                          <React.Fragment>
                             <path d="M 5,35 L 95,35 C 100,35 100,25 95,25 L 90,25 L 90,5 L 75,5 L 75,25 L 15,25 L 15,15 L 5,15 C 0,25 0,35 5,35 Z" />
                             <rect x="25" y="15" width="10" height="10" fill="#eab308" />
                             <rect x="40" y="10" width="15" height="15" fill="#ef4444" />
                             <rect x="60" y="12" width="12" height="13" fill="#3b82f6" />
                          </React.Fragment>
                       ) : (
                          <React.Fragment>
                             <path d="M 10,30 L 90,30 C 95,30 98,25 95,20 L 80,20 L 75,10 L 40,10 L 35,20 L 10,20 C 5,20 2,25 5,30 Z" />
                             <rect x="50" y="5" width="5" height="15" fill="#ef4444" />
                             <circle cx="20" cy="25" r="2" fill="#0f172a" />
                             <circle cx="35" cy="25" r="2" fill="#0f172a" />
                             <circle cx="50" cy="25" r="2" fill="#0f172a" />
                             <circle cx="65" cy="25" r="2" fill="#0f172a" />
                             <circle cx="80" cy="25" r="2" fill="#0f172a" />
                          </React.Fragment>
                       )}
                    </svg>
                 </div>
               )}
            </div>

            {/* Radio Frequency Popup */}
            {s.status === 'approaching' && s.distance < 85 && (
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded flex items-center justify-center shadow-lg z-50">
                  <span className="text-yellow-400 font-mono text-xs font-bold leading-none">{s.frequency.toFixed(1)}</span>
               </div>
            )}
          </div>
        );
      })}
      {/* Popups */}
      {popups.map(p => {
         const leftPos = Math.max(15, 15 + (p.distance * 0.85));
         return (
           <div 
             key={p.id}
             className={`absolute bottom-[20%] z-50 font-bold text-xl drop-shadow-md pb-4 animate-bounce pointer-events-none ${p.color}`}
             style={{ left: `${leftPos}%` }}
           >
             {p.text}
           </div>
         );
      })}
    </div>
  );
}
