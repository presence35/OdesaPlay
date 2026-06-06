import React, { useMemo } from 'react';
import { Weather } from '../types';
import lighthouseImg from '../assets/lighthouse.png';

interface LighthouseViewProps {
  weather: Weather;
  lightOn: boolean;
  lightningAlpha: number;
  onCycleWeather: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function LighthouseView({ weather, lightOn, lightningAlpha, onCycleWeather, containerRef }: LighthouseViewProps) {
  return (
    <div className="relative w-full h-[45%] bg-[#0A1128] flex flex-col justify-end isolate overflow-hidden">
      {/* Pixi Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Sea Horizon line (behind lighthouse, in front of pixi) */}
      <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-[#050B14] border-t border-slate-800 z-[5]" />

      {/* The Vorontsov Lighthouse - DOM overlay on top of Pixi */}
      <div
        className="absolute bottom-0 -left-6 md:-left-2 z-[40] flex items-end drop-shadow-2xl scale-[0.28] md:scale-[0.36] origin-bottom-left pointer-events-none"
      >
        <div className="relative">
          <img
            src={lighthouseImg}
            alt="Lighthouse"
            width="240"
            height="400"
            className={`object-contain transition-all duration-1000 pointer-events-none select-none ${weather === 'storm' ? 'brightness-50' : weather === 'fog' ? 'brightness-75 blur-[1px]' : ''}`}
          />
          <div
            className={`absolute top-[182px] left-[110px] w-[200vw] h-[160px] -translate-y-1/2 rotate-[25deg] pointer-events-none z-40 origin-left transition-opacity duration-150 ${lightOn ? 'opacity-100' : 'opacity-0'}`}
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)',
              clipPath: 'polygon(0 45%, 100% 10px, 100% 100%, 0 55%)',
            }}
          />
        </div>
      </div>

      {/* Weather Label */}
      <div className="absolute top-4 left-4 right-4 z-40 flex justify-end items-start pointer-events-none">
        <div
          onClick={onCycleWeather}
          className={`pointer-events-auto cursor-pointer select-none px-3 py-1 rounded border uppercase font-bold text-xs tracking-widest shadow-md flex items-center gap-2 transition-colors
            ${weather === 'clear' ? 'bg-slate-900/60 border-slate-500 text-slate-300' : ''}
            ${weather === 'fog' ? 'bg-white/80 border-slate-300 text-slate-800' : ''}
            ${weather === 'storm' ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse' : ''}
          `}
        >
          {weather === 'storm' && <span className="w-2 h-2 rounded-full bg-red-500" />}
          {weather}
        </div>
      </div>
    </div>
  );
}
