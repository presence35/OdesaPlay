import React, { useRef, useEffect } from 'react';
import { GameControls } from '../types';
import { Sun, Zap, Radio, Check, Hammer } from 'lucide-react';

interface ControlPanelProps {
  controlsRef: React.MutableRefObject<GameControls>;
  heat: number;
  battery: number;
  fuseBlown: boolean;
  fuseHealth: number;
  isCooledDown: boolean;
  money: number;
}

export function ControlPanel({ controlsRef, heat, battery, fuseBlown, fuseHealth, isCooledDown, money }: ControlPanelProps) {
  // Sync internal UI state for the radio dial
  const [internalFreq, setInternalFreq] = React.useState(98.0);
  const lastY = useRef<number | null>(null);

  // Sync back to ref when changed
  useEffect(() => {
    controlsRef.current.tunedFreq = internalFreq;
  }, [internalFreq, controlsRef]);

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
  };

  return (
    <div className="flex-1 bg-[#1E293B] flex flex-col p-4 z-40 relative border-t border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] select-none">
      
      {/* Top Header Row */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-yellow-500 font-mono font-bold text-xl drop-shadow-sm flex items-center gap-1">
          {money.toLocaleString()} <span className="text-sm">₴</span>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest text-right">Odesa Radio<br/>Cmd System</div>
          <Radio className="w-5 h-5 text-slate-500" />
        </div>
      </div>

      {/* Row 1: Radio and Dock */}
      <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-3 mb-6 border border-slate-800 shadow-inner">
        <div className="font-mono text-yellow-400 font-bold w-12 text-center text-lg shadow-[0_0_10px_rgba(250,204,21,0.2)]">
          {internalFreq.toFixed(1)}
        </div>
        <div className="relative flex-1 h-8 bg-slate-800 rounded border border-slate-700 overflow-hidden flex items-center">
          <div className="absolute inset-0 flex justify-between px-2 items-center opacity-40 pointer-events-none">
             {Array.from({length: 21}).map((_, i) => (
               <div key={i} className={`w-[1px] ${i % 5 === 0 ? 'h-4 bg-slate-300' : 'h-2 bg-slate-500'}`} />
             ))}
          </div>
          <input
            type="range"
            min="88.0"
            max="108.0"
            step="0.5"
            value={internalFreq}
            onChange={(e) => setInternalFreq(parseFloat(e.target.value))}
            className="w-full h-full appearance-none bg-transparent outline-none focus:outline-none relative z-10 cursor-ew-resize
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(239,68,68,0.9)]
            [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-10 [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(239,68,68,0.9)]"
          />
        </div>
        <button
          onPointerDown={attemptDock}
          className="bg-white text-slate-900 px-4 py-3 rounded-lg font-bold uppercase active:scale-95 active:bg-slate-200 transition-transform shadow-md flex items-center gap-1 text-sm tracking-wider"
        >
          <Check className="w-4 h-4" /> Dock
        </button>
      </div>

      {/* Row 2: Main Interactions (Light & Pump) */}
      <div className="flex-1 flex gap-4 min-h-[140px]">
        {/* Generator Pump (Left side) */}
        <div 
          className="w-24 bg-slate-900 rounded-2xl relative overflow-hidden border border-slate-800 shadow-inner flex flex-col items-center justify-center cursor-ns-resize touch-none"
          onPointerDown={handlePumpDown}
          onPointerMove={handlePumpMove}
          onPointerUp={handlePumpUp}
          onPointerLeave={handlePumpUp}
        >
          {/* Battery Fill level visual */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-blue-600/40 transition-all duration-100 rounded-b-xl"
            style={{ height: `${battery}%` }}
          />
          <div className="z-10 flex flex-col items-center pointer-events-none text-slate-400">
            <div className="w-1 h-8 border-l-2 border-r-2 border-slate-600 dotted rounded opacity-50 mb-2"></div>
            <span className="font-bold uppercase tracking-widest text-[10px] text-center px-1">Swipe<br/>Pump</span>
            <div className="font-mono text-xs text-white mt-1">{Math.floor(battery)}%</div>
          </div>
        </div>

        {/* Light & Heat Center */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Heat warning halo */}
          {heat > 75 && <div className="absolute inset-0 bg-red-500/10 blur-xl animate-pulse pointer-events-none rounded-full" />}
          
          <button
            onPointerDown={() => controlsRef.current.isLightPressed = true}
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

          {/* Heat Gauge */}
          <div className="absolute right-0 bottom-4 top-4 w-4 bg-slate-900 rounded-full border border-slate-800 overflow-hidden flex flex-col justify-end">
            <div 
              className={`w-full transition-all duration-75 ${heat > 80 ? 'bg-red-500' : heat > 50 ? 'bg-yellow-500' : 'bg-orange-500'}`}
              style={{ height: `${heat}%` }}
            />
          </div>
          <div className="absolute right-0 -bottom-2 text-[10px] text-slate-500 font-mono font-bold w-4 text-center">
            {heat > 90 ? '!!' : '°C'}
          </div>
        </div>
      </div>

      {/* Fuse Overlay */}
      {fuseBlown && (
        <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-t-2 border-red-500 rounded-t-lg transition-all">
          <div className="font-display font-bold text-3xl uppercase tracking-widest text-white leading-tight text-center mb-8 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">
            System<br/>Failure
          </div>
          <button
            onPointerDown={attemptFixFuse}
            className="w-40 h-40 bg-red-600 rounded-full border-8 border-red-900 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.4)] active:scale-95 active:bg-red-500 touch-none outline-none"
          >
            <Zap className="w-16 h-16 text-white mb-2 animate-bounce drop-shadow" />
            <span className="mt-2 text-sm font-mono font-bold text-red-200">
              TAP TO FIX: {Math.ceil(fuseHealth)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
