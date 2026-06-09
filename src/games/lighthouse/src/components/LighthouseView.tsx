import React from 'react';
import { Weather } from '../types';
import lighthouseImg from '../assets/lighthouse.png';

interface LighthouseViewProps {
  weather: Weather;
  lightOn: boolean;
  lightningAlpha: number;
  onCycleWeather: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isAdmin?: boolean;
}

function beamClasses(weather: Weather, lightOn: boolean): string {
  const base = 'absolute top-[182px] left-[110px] w-[200vw] h-[160px] -translate-y-1/2 rotate-[25deg] pointer-events-none z-40 origin-left';
  if (!lightOn) return `${base} opacity-0`;
  if (weather === 'clear') return `${base} opacity-100`;
  if (weather === 'fog') return `${base} opacity-100`;
  return `${base} opacity-100 animate-beam-flicker`;
}

function beamStyle(weather: Weather): React.CSSProperties {
  if (weather === 'clear') {
    return {
      background: 'linear-gradient(90deg, rgba(255,230,150,0.85) 0%, rgba(255,200,80,0) 100%)',
      clipPath: 'polygon(0 45%, 100% 10px, 100% 100%, 0 55%)',
    };
  }
  if (weather === 'fog') {
    return {
      background: 'linear-gradient(90deg, rgba(200,210,230,0.35) 0%, rgba(180,190,210,0) 100%)',
      clipPath: 'polygon(0 35%, 100% 0px, 100% 100%, 0 65%)',
      filter: 'blur(4px)',
    };
  }
  return {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(200,200,255,0) 100%)',
    clipPath: 'polygon(0 45%, 100% 10px, 100% 100%, 0 55%)',
  };
}

export function LighthouseView({ weather, lightOn, lightningAlpha, onCycleWeather, containerRef, isAdmin }: LighthouseViewProps) {
  return (
    <div className="relative w-full h-[45%] bg-[#0A1128] flex flex-col justify-end isolate overflow-hidden">
      {/* Pixi Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Sea Horizon line (behind lighthouse, in front of pixi) */}
      <div className="absolute bottom-0 left-0 right-0 h-[60px] border-t border-slate-800 z-[5] pointer-events-none" />

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
            className={beamClasses(weather, lightOn)}
            style={beamStyle(weather)}
          />
        </div>
      </div>

      {/* Weather Label — admins can cycle, others see read-only */}
      <div className="absolute top-4 left-4 right-4 z-40 flex justify-end items-start pointer-events-none">
        <div
          onClick={isAdmin ? onCycleWeather : undefined}
          className={`select-none px-3 py-1 rounded border uppercase font-bold text-xs tracking-widest shadow-md flex items-center gap-2 transition-colors
            ${weather === 'clear' ? 'bg-slate-900/60 border-slate-500 text-slate-300' : ''}
            ${weather === 'fog' ? 'bg-white/80 border-slate-300 text-slate-800' : ''}
            ${weather === 'storm' ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse' : ''}
            ${isAdmin ? 'cursor-pointer pointer-events-auto' : 'cursor-default pointer-events-auto'}
          `}
          title={isAdmin ? 'Click to cycle weather' : undefined}
        >
          {weather === 'storm' && <span className="w-2 h-2 rounded-full bg-red-500" />}
          {weather}
        </div>
      </div>
    </div>
  );
}
