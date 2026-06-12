import React, { useRef, useEffect, useCallback } from 'react';
import { GameControls, Upgrades } from '../types';
import { Sun, Zap, Radio, Check, ShieldAlert, BatteryCharging } from 'lucide-react';
import { audio } from '../audio';

interface ControlPanelProps {
  controlsRef: React.MutableRefObject<GameControls>;
  heat: number;
  battery: number;
  fuseBlown: boolean;
  fuseHealth: number;
  isCooledDown: boolean;
  score: number;
  upgrades: Upgrades;
  shipsApproaching: boolean;
  timeRemaining: number;
  t?: any;
}

const FREQ_MIN = 80;
const FREQ_MAX = 100;

export function ControlPanel({ controlsRef, heat, battery, fuseBlown, fuseHealth, isCooledDown, score, upgrades, shipsApproaching, timeRemaining, t }: ControlPanelProps) {
  // Sync internal UI state for the radio dial
  const [internalFreq, setInternalFreq] = React.useState(88);
  const lastY = useRef<number | null>(null);
  const lastFreqTime = useRef(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Sync back to ref when changed
  useEffect(() => {
    controlsRef.current.tunedFreq = internalFreq;
  }, [internalFreq, controlsRef]);

  const freqFromPointer = useCallback((clientX: number) => {
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect) return internalFreq;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(FREQ_MIN + pct * (FREQ_MAX - FREQ_MIN));
  }, [internalFreq]);

  const playFreqBlip = useCallback(() => {
    const now = Date.now();
    if (now - lastFreqTime.current > 50) {
      audio.playRadioBlip();
      lastFreqTime.current = now;
    }
  }, []);

  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    const freq = freqFromPointer(e.clientX);
    setInternalFreq(freq);
    playFreqBlip();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("setPointerCapture failed:", err);
    }
  }, [freqFromPointer, playFreqBlip]);

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    const freq = freqFromPointer(e.clientX);
    setInternalFreq(freq);
    playFreqBlip();
  }, [freqFromPointer, playFreqBlip]);

  // ---- Handlers ----
  const handlePumpDown = (e: React.PointerEvent) => {
    lastY.current = e.clientY;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("setPointerCapture failed:", err);
    }
  };

  const handlePumpMove = (e: React.PointerEvent) => {
    if (lastY.current === null) return;
    const diff = e.clientY - lastY.current;
    
    // threshold for a valid pump "swipe down or up"
    if (Math.abs(diff) > 25) {
      controlsRef.current.pumpQueue += 12; // add battery
      lastY.current = e.clientY; // reset origin
      audio.playPump();
    }
  };

  const handlePumpUp = (e: React.PointerEvent) => {
    lastY.current = null;
    try {
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      console.warn("releasePointerCapture failed:", err);
    }
  };

  const attemptDock = () => {
    controlsRef.current.dockTaps += 1;
  };

  const attemptFixFuse = () => {
    controlsRef.current.fuseFixTaps += 1;
    audio.playError();
  };

  // Format time (ms -> M:SS)
  const totalSeconds = Math.ceil(timeRemaining / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;

  return (
    <div className="flex-1 bg-[#1E293B] flex flex-col p-4 z-40 relative border-t border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] select-none">
      
      {/* Top Header Row */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-950/40 border border-green-500/50 px-3 py-1 rounded-sm text-green-400 font-mono font-bold text-xl drop-shadow-[0_0_8px_rgba(74,222,128,0.3)] flex items-center gap-2">
            {score.toLocaleString()}
          </div>
          <div className="flex gap-1.5 opacity-60">
             {upgrades.autoFoghorn && <ShieldAlert className="w-3.5 h-3.5 text-yellow-500" />}
             {upgrades.tungstenFilament && <Sun className="w-3.5 h-3.5 text-white" />}
             {upgrades.solarBackup && <BatteryCharging className="w-3.5 h-3.5 text-blue-400" />}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest text-right">{t?.radioCmd || 'Odesa Radio Cmd System'}</div>
          <Radio className={`w-5 h-5 ${shipsApproaching ? 'text-green-500 animate-pulse' : 'text-slate-500'}`} />
        </div>
      </div>

      {/* Row 1: Radio and Dock */}
      <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-3 mb-6 border border-slate-800 shadow-inner">
        <div className="font-mono text-yellow-400 font-bold w-12 text-center text-lg shadow-[0_0_10px_rgba(250,204,21,0.2)]">
          {internalFreq.toFixed(0)}
        </div>
        <div
          ref={sliderRef}
          className="relative flex-1 h-8 bg-slate-800 rounded border border-slate-700 overflow-hidden touch-none cursor-pointer select-none"
          onPointerDown={handleSliderPointerDown}
          onPointerMove={handleSliderPointerMove}
        >
          <div className="absolute inset-0 flex justify-between px-2 items-center opacity-40 pointer-events-none">
             {Array.from({length: 21}).map((_, i) => (
               <div key={i} className={`w-[1px] ${i % 5 === 0 ? 'h-4 bg-slate-300' : 'h-2 bg-slate-500'}`} />
             ))}
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-10 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] pointer-events-none rounded-sm"
            style={{ left: `${((internalFreq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 100}%`, marginLeft: '-3px' }}
          />
        </div>
          <button
            onPointerDown={attemptDock}
            onContextMenu={(e) => e.preventDefault()}
            className="bg-white text-slate-900 px-4 py-3 rounded-lg font-bold uppercase active:scale-[0.93] active:bg-slate-300 transition-all duration-75 shadow-[0_4px_0_#94a3b8] active:shadow-[0_0px_0_#94a3b8] active:translate-y-1 flex items-center gap-1 text-sm tracking-wider outline-none touch-manipulation"
          >
          <Check className="w-4 h-4" /> {t?.dock || 'Dock'}
        </button>
      </div>

      {/* Row 2: Main Interactions (Light & Pump) */}
      <div className="flex-1 flex gap-4 min-h-[140px]">
        <div 
          className="w-24 bg-slate-900 rounded-2xl relative overflow-hidden border border-slate-800 shadow-inner flex flex-col items-center justify-center cursor-ns-resize touch-none"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePumpDown}
          onPointerMove={handlePumpMove}
          onPointerUp={handlePumpUp}
          onPointerLeave={handlePumpUp}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-blue-600/40 transition-all duration-100 rounded-b-xl"
            style={{ height: `${battery}%` }}
          />
          {battery <= 0 && <div className="absolute inset-0 bg-red-500/15 blur-2xl animate-pulse pointer-events-none rounded-full" />}
          <div className="z-10 flex flex-col items-center pointer-events-none">
            <div className="w-1 h-8 border-l-2 border-r-2 border-slate-600 dotted rounded opacity-50 mb-2"></div>
            {battery > 16 ? (
              <span className="font-bold uppercase tracking-widest text-center text-[10px] text-slate-400 px-1">water level</span>
            ) : (
              <span className="font-bold uppercase tracking-widest text-center text-red-500 animate-pulse text-[20px] leading-none">Swipe<br/>Pump</span>
            )}
            <div className="font-mono text-xs text-white mt-1">{Math.floor(battery)}%</div>
          </div>
        </div>


        {/* Light Center */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Heat warning halo */}
          {heat > 75 && <div className="absolute inset-0 bg-red-500/10 blur-xl animate-pulse pointer-events-none rounded-full" />}
          
          {timeRemaining <= 15000 && <div className="absolute inset-0 bg-red-500/15 blur-2xl animate-pulse pointer-events-none rounded-full" />}
          <div className={`font-mono text-xl font-bold mb-2 tracking-widest ${timeRemaining <= 15000 ? 'text-red-500 animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-110' : 'text-slate-300'}`}>{timeStr}</div>

          <button
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={() => {
              controlsRef.current.isLightPressed = true;
              if (battery <= 0 || isCooledDown) audio.playError();
            }}
            onPointerUp={() => controlsRef.current.isLightPressed = false}
            onPointerLeave={() => controlsRef.current.isLightPressed = false}
            disabled={isCooledDown || battery <= 0}
            className={`w-36 h-36 rounded-full border-[6px] flex items-center justify-center touch-none transition-transform
              ${isCooledDown ? 'border-red-900 bg-slate-800 opacity-50' : 
                battery <= 0 ? 'border-slate-800 bg-slate-900 opacity-50' :
                controlsRef.current.isLightPressed ? 'border-yellow-400 bg-white scale-95 shadow-[0_0_40px_rgba(255,255,255,0.4)]' : 'border-slate-600 bg-slate-800'
              }
            `}
          >
            <Sun className={`w-12 h-12 ${isCooledDown ? 'text-red-900' : controlsRef.current.isLightPressed ? 'text-yellow-500' : 'text-slate-500'}`} />
          </button>
        </div>
      </div>

      {/* Fuse Overlay */}
      {fuseBlown && (
        <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-t-2 border-red-500 rounded-t-lg transition-all">
          <div className="font-display font-bold text-3xl uppercase tracking-widest text-white leading-tight text-center mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">
            {t?.systemFailure || 'System Failure'}
          </div>
          <div className="text-red-400 font-mono text-lg mb-8 animate-pulse">
            {t?.tapToRepair || 'Tap to repair'} {Math.ceil(fuseHealth)}x
          </div>
          <button
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={attemptFixFuse}
            className="w-32 h-32 bg-red-600 rounded-full border-4 border-red-900 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.4)] active:scale-95 active:bg-red-700 touch-none outline-none transition-transform"
          >
            <Zap className="w-12 h-12 text-white animate-pulse drop-shadow fill-current ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}
