import { ErrorBoundary } from '../../../components/ErrorBoundary';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, AlertOctagon, ChevronsUp, ChevronsLeft } from 'lucide-react';
import { TRANSLATIONS } from '../translations';
import { getAudioContext, resumeAudioContext } from '../../../utils/audioContext';
import GameEndScreen from '../../GameEndScreen';


const MARSHRUTKA_WIDTH = 50;
const MARSHRUTKA_HEIGHT = 100;
let charImages: Record<string, HTMLImageElement> = {};

const ROUTES = [
  { number: '4', time: 120, id: 'route4' },
  { number: '7', time: 140, id: 'route7' },
  { number: '146', time: 150, id: 'route146' },
  { number: '168', time: 180, id: 'route168' },
  { number: '185', time: 120, id: 'route185' },
  { number: '250', time: 160, id: 'route250' }
];

interface GameObject {
  id: number;
  type: 'flower' | 'falling_flower' | 'pothole' | 'delivery_bike' | 'babushka' | 'scenery' | 'explosion' | 'passenger';
  x: number;
  y: number;
  side?: 'left' | 'right';
  targetX?: number;
  vy?: number;
  trackSpeed?: number;
  hasThrown?: boolean;
  score?: number;
  passengerType?: 'girl' | 'man' | 'smelly';
  missed?: boolean;
  passengerBehavior?: 'normal' | 'running_up' | 'running_down';
  variant?: number | string;
  foodType?: 'pizza' | 'shawarma';
  stinkyCrying?: boolean;
  hangingOut?: boolean;
}

interface Popup {
  id: number;
  text: string;
  color: string;
  type: 'points' | 'words';
  busX?: number;
  stackIndex?: number;
  createdAt: number;
}

let _soundEnabled = true;
let audioCtx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  if (!audioCtx) audioCtx = getAudioContext();
  return audioCtx;
};
const playSound = (type: 'flower' | 'pothole' | 'bike' | 'gameover' | 'win') => {
  const ctx = getCtx();
  if (!_soundEnabled || !ctx) return;
  const now = ctx.currentTime;
  let freq = 440, duration = 0.15, type2 = 'sine';
  if (type === 'flower') freq = 880;
  else if (type === 'pothole') { freq = 220; duration = 0.3; type2 = 'square'; }
  else if (type === 'bike') { freq = 330; duration = 0.2; type2 = 'sawtooth'; }
  else if (type === 'gameover') { freq = 150; duration = 0.8; type2 = 'triangle'; }
  else if (type === 'win') { freq = 523; duration = 0.4; type2 = 'sine'; }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type2 as OscillatorType;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
};

const triggerHaptic = (type: 'light' | 'heavy') => {
  if (!navigator.vibrate) return;
  try { navigator.vibrate(type === 'light' ? 10 : 30); } catch {}
};

const VyshyvankaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="none">
    <path d="M7 3 L3 7 L4 12 L7 10 L7 21 L17 21 L17 10 L20 12 L21 7 L17 3 Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="white" />
    <path d="M12 4 V20 M9 7 h6 M10 10 h4 M9 13 h6 M10 16 h4 M11 4 v2" stroke="#ef4444" strokeWidth="2" strokeLinecap="square" />
  </svg>
);

const PassengerVisual = React.memo(({ type, missed, stinkyCrying, hangingOut }: { type: 'girl' | 'man' | 'smelly', missed?: boolean, stinkyCrying?: boolean, hangingOut?: boolean }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" className="overflow-visible drop-shadow-md">
    <defs>
      <radialGradient id="skinGrad" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#ffedd5" />
        <stop offset="100%" stopColor="#fdba74" />
      </radialGradient>
      <linearGradient id="dressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#db2777" />
      </linearGradient>
      <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
      <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
    </defs>
    <style>
      {`
        @keyframes waveAnimation {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(40deg); }
        }
        @keyframes runningAnimation {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(-5deg); }
        }
        @keyframes cryingAnimation {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(2px); }
        }
        @keyframes stinkAnimation {
          0% { transform: translateY(0px); opacity: 0.8; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
        @keyframes tearDrop {
          0% { stroke-dashoffset: 20; transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          100% { stroke-dashoffset: 0; transform: translateY(8px); opacity: 0; }
        }
        @keyframes hop {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .hopping { animation: hop 0.4s infinite ease-in-out; }
        .waving-arm-girl { transform-origin: 25px 22px; animation: waveAnimation 0.35s infinite alternate ease-in-out; }
        .waving-arm-man { transform-origin: 26px 20px; animation: waveAnimation 0.35s infinite alternate ease-in-out; }
        .running-man { animation: runningAnimation 0.3s infinite ease-in-out; }
        .crying-girl { animation: cryingAnimation 0.5s infinite alternate ease-in-out; }
        @keyframes scare { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        .scared { animation: scare 0.15s infinite ease-in-out; }
        .tears { animation: tearDrop 0.8s infinite linear; }
        .stink-cloud { animation: stinkAnimation 2s infinite linear; }
      `}
    </style>
    <ellipse cx="20" cy="38" rx="10" ry="2" fill="rgba(0,0,0,0.2)" />
    {type === 'girl' ? (
      <g className={hangingOut ? 'scared' : (missed || stinkyCrying) ? 'crying-girl' : 'hopping'}>
        <path d="M12 22 Q20 42 28 22 Z" fill="url(#dressGrad)" stroke="#be185d" strokeWidth="1" />
        <path d="M12 22 Q20 28 28 22" fill="none" stroke="#fbcfe8" strokeWidth="1.5" />
        {!(missed || stinkyCrying) && <path className="waving-arm-girl" d="M26 24 Q36 18 30 6" stroke="url(#skinGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />}
        {(missed || stinkyCrying) && <path d="M12 30 Q18 24 16 18" stroke="url(#skinGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />}
        {(missed || stinkyCrying) && <path d="M28 30 Q22 24 24 18" stroke="url(#skinGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />}
        <circle cx="20" cy="12" r="10" fill="url(#skinGrad)" stroke="#ea580c" strokeWidth="0.5" />
        <ellipse cx="20" cy="8" rx="8" ry="6" fill="url(#hairGrad)" />
        <circle cx="12" cy="10" r="4" fill="url(#hairGrad)" />
        <circle cx="28" cy="10" r="4" fill="url(#hairGrad)" />
        <path d="M10 14 Q8 20 12 24 Q10 18 12 12" fill="url(#hairGrad)" />
        <path d="M30 14 Q32 20 28 24 Q30 18 28 12" fill="url(#hairGrad)" />
        {hangingOut ? (
          <>
            <ellipse cx="17" cy="11" rx="4" ry="4" fill="#fff" />
            <ellipse cx="23" cy="11" rx="4" ry="4" fill="#fff" />
            <circle cx="17" cy="12" r="1.5" fill="#1f2937" />
            <circle cx="23" cy="12" r="1.5" fill="#1f2937" />
            <circle cx="18" cy="11" r="0.5" fill="#fff" />
            <circle cx="24" cy="11" r="0.5" fill="#fff" />
            <path d="M13 7 Q17 5 21 7" stroke="#1f2937" strokeWidth="1.5" fill="none" />
            <path d="M19 7 Q23 5 27 7" stroke="#1f2937" strokeWidth="1.5" fill="none" />
            <ellipse cx="20" cy="17" rx="2.5" ry="3" fill="#1f2937" />
            <ellipse cx="20" cy="16" rx="1.5" ry="1" fill="#fff" />
            <path d="M12 6 Q11 9 12 10 Q13 9 12 6" fill="#60a5fa" />
            <path d="M28 6 Q27 9 28 10 Q29 9 28 6" fill="#60a5fa" />
          </>
        ) : (
          <>
            <ellipse cx="17" cy="12" rx="2.5" ry="3" fill="#fff" />
            <ellipse cx="23" cy="12" rx="2.5" ry="3" fill="#fff" />
            <circle cx="17" cy="13" r="1.5" fill="#1f2937" />
            <circle cx="23" cy="13" r="1.5" fill="#1f2937" />
            <circle cx="18" cy="12.5" r="0.8" fill="#fff" />
            <circle cx="24" cy="12.5" r="0.8" fill="#fff" />
            <ellipse cx="14" cy="15" rx="2" ry="1" fill="#fda4af" opacity="0.6" />
            <ellipse cx="26" cy="15" rx="2" ry="1" fill="#fda4af" opacity="0.6" />
            {(missed || stinkyCrying) ? (
              <path d="M17 17 Q20 15 23 17" stroke="#1f2937" strokeWidth="1" fill="none" />
            ) : (
              <path d="M17 16 Q20 19 23 16" stroke="#1f2937" strokeWidth="1.5" fill="none" />
            )}
            {(missed || stinkyCrying) && (
              <g>
                <path className="tears" d="M15 14 Q10 22 6 28 M25 14 Q30 22 34 28" stroke="#60a5fa" strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" />
                <ellipse className="tears" cx="5" cy="32" rx="4" ry="6" fill="#60a5fa" style={{animationDelay: '-0.4s'}} />
                <ellipse className="tears" cx="35" cy="32" rx="4" ry="6" fill="#60a5fa" style={{animationDelay: '-0.4s'}} />
              </g>
            )}
          </>
        )}
        <rect x="14" y="32" width="5" height="6" rx="2" fill="#fcd34d" stroke="#ca8a04" strokeWidth="0.5" />
        <rect x="21" y="32" width="5" height="6" rx="2" fill="#fcd34d" stroke="#ca8a04" strokeWidth="0.5" />
      </g>
    ) : type === 'man' ? (
      <g className={hangingOut ? 'scared' : (missed || stinkyCrying) ? 'running-man' : 'hopping'}>
        <rect x="11" y="18" width="18" height="16" rx="5" fill="url(#shirtGrad)" stroke="#1d4ed8" strokeWidth="1" />
        <path d="M16 18 L20 22 L24 18" fill="#93c5fd" />
        {!missed && <path className="waving-arm-man" d="M27 20 Q38 12 30 2" stroke="url(#skinGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />}
        {missed && <path className="waving-arm-man" d="M27 20 Q38 12 30 2" stroke="url(#skinGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />}
        <circle cx="20" cy="11" r="9" fill="url(#skinGrad)" stroke="#ea580c" strokeWidth="0.5" />
        <path d="M11 9 Q20 2 29 9" fill="#374151" />
        <path d="M12 7 Q20 3 28 7" fill="#4b5563" />
        {hangingOut ? (
          <>
            <ellipse cx="16" cy="9" rx="4" ry="4" fill="#fff" />
            <ellipse cx="24" cy="9" rx="4" ry="4" fill="#fff" />
            <circle cx="16" cy="10" r="1.5" fill="#1f2937" />
            <circle cx="24" cy="10" r="1.5" fill="#1f2937" />
            <circle cx="16.5" cy="9" r="0.5" fill="#fff" />
            <circle cx="24.5" cy="9" r="0.5" fill="#fff" />
            <path d="M12 5 Q16 3 20 5" stroke="#374151" strokeWidth="1.5" fill="none" />
            <path d="M20 5 Q24 3 28 5" stroke="#374151" strokeWidth="1.5" fill="none" />
            <ellipse cx="20" cy="14" rx="2.5" ry="3" fill="#374151" />
            <path d="M11 5 Q10 8 11 9 Q12 8 11 5" fill="#60a5fa" />
            <path d="M29 5 Q28 8 29 9 Q30 8 29 5" fill="#60a5fa" />
          </>
        ) : (
          <>
            <ellipse cx="16" cy="10" rx="2.5" ry="3" fill="#fff" />
            <ellipse cx="24" cy="10" rx="2.5" ry="3" fill="#fff" />
            <circle cx="16" cy="10.5" r="1.5" fill="#1f2937" />
            <circle cx="24" cy="10.5" r="1.5" fill="#1f2937" />
            <circle cx="16.5" cy="10" r="0.6" fill="#fff" />
            <circle cx="24.5" cy="10" r="0.6" fill="#fff" />
            <path d="M17 14 Q20 16 23 14" stroke="#374151" strokeWidth="1.5" fill="none" />
          </>
        )}
        <rect x={missed ? "11" : "13"} y="30" width="6" height="8" rx="2" fill="#1e3a8a" />
        <rect x={missed ? "23" : "21"} y="30" width="6" height="8" rx="2" fill="#1e3a8a" />
      </g>
    ) : (
      <g className={(missed || stinkyCrying) ? 'running-man' : 'hopping'}>
        <rect x="8" y="18" width="24" height="16" rx="5" fill="#84cc16" stroke="#4d7c0f" strokeWidth="1" />
        <circle cx="14" cy="24" r="3" fill="#65a30d" opacity="0.7" />
        <circle cx="26" cy="26" r="4" fill="#65a30d" opacity="0.7" />
        <circle cx="20" cy="30" r="2" fill="#65a30d" opacity="0.7" />
        <circle cx="20" cy="10" r="9" fill="#bef264" stroke="#65a30d" strokeWidth="0.5" />
        <path d="M11 8 Q20 -2 29 8" fill="#a3e635" />
        <circle cx="12" cy="6" r="3" fill="#a3e635" />
        <circle cx="28" cy="6" r="3" fill="#a3e635" />
        <path d="M15 4 L17 8 M22 3 L24 7 M27 5 L29 9" stroke="#65a30d" strokeWidth="1.5" />
        <circle cx="16" cy="10" r="2" fill="#1f2937" />
        <circle cx="24" cy="10" r="2" fill="#1f2937" />
        <path d="M16 14 Q20 16 24 14" stroke="#1f2937" strokeWidth="1.5" fill="none" />
        <path d="M17 14.5 L18 15.5 L19 14.5 L20 15.5 L21 14.5 L22 15.5 L23 14.5" stroke="#1f2937" strokeWidth="1" fill="none" />
        <path className="stink-cloud" d="M12 4 Q10 -4 6 2" stroke="#bef264" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path className="stink-cloud" style={{animationDelay: '0.4s'}} d="M20 2 Q20 -8 24 0" stroke="#bef264" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path className="stink-cloud" style={{animationDelay: '0.8s'}} d="M28 4 Q30 -4 34 2" stroke="#bef264" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <rect x="12" y="30" width="6" height="8" rx="2" fill="#4d7c0f" />
        <rect x="22" y="30" width="6" height="8" rx="2" fill="#4d7c0f" />
      </g>
    )}
  </svg>
));

const BouquetVisual = React.memo(({ score = 1 }: { score?: number }) => {
  const isMedium = score === 2;
  const isRare = score === 3;
  const mainColor = isRare ? "#f59e0b" : isMedium ? "#a855f7" : "#ef4444";
  const budColor1 = "#fb923c";
  const budColor2 = "#f472b6";
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" className="overflow-visible drop-shadow-sm">
      <ellipse cx="14" cy="30" rx="8" ry="2" fill="rgba(0,0,0,0.15)" />
      <path d="M14 14 L14 28" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 20 L19 16" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 22 L9 18" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 22 Q10 20 8 18 Q12 19 14 21" fill="#16a34a" />
      <path d="M14 24 Q18 22 20 20 Q16 21 14 23" fill="#16a34a" />
      <g transform="translate(14, 12)">
        <circle r="6" fill={mainColor} />
        <circle r="3" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        {[0, 60, 120, 180, 240, 300].map(angle => (
          <circle key={angle} r="2.5" fill={mainColor} transform={`rotate(${angle}) translate(5, 0)`} />
        ))}
      </g>
      <g transform="translate(19, 16)">
        <ellipse rx="3" ry="4" fill={budColor1} transform="rotate(30)" />
        <path d="M0 0 L-2 4" stroke="#15803d" strokeWidth="1" />
      </g>
      {isMedium && (
        <g transform="translate(9, 18)">
          <ellipse rx="2.5" ry="3.5" fill={budColor2} transform="rotate(-30)" />
          <path d="M0 0 L2 4" stroke="#15803d" strokeWidth="1" />
        </g>
      )}
      {isRare && (
        <g transform="translate(14, 4)">
          <circle r="1" fill="#fff" className="animate-pulse" />
        </g>
      )}
    </svg>
  );
});

const PotholeVisual = React.memo(({ variant = 0 }: { variant?: number }) => {
  if (variant === 1) {
    return (
      <svg width="60" height="40" viewBox="0 0 60 40">
        <ellipse cx="28" cy="20" rx="25" ry="15" fill="#334155" />
        <ellipse cx="28" cy="20" rx="22" ry="13" fill="#0f172a" stroke="#0f172a" strokeWidth="1" />
        <ellipse cx="20" cy="16" rx="6" ry="4" fill="#0f172a" />
        <ellipse cx="35" cy="22" rx="5" ry="3" fill="#0f172a" />
        <circle cx="15" cy="24" r="2" fill="#1e293b" />
        <circle cx="28" cy="18" r="3" fill="#0f172a" />
        <path d="M10 10 L15 18 M48 8 L42 15" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg width="40" height="36" viewBox="0 0 40 36">
        <ellipse cx="20" cy="18" rx="16" ry="12" fill="#334155" />
        <ellipse cx="20" cy="18" rx="14" ry="10" fill="#0f172a" stroke="#0f172a" strokeWidth="1" />
        <ellipse cx="14" cy="14" rx="4" ry="3" fill="#0f172a" />
        <ellipse cx="26" cy="20" rx="5" ry="3" fill="#0f172a" />
        <path d="M8 28 L12 22 M32 26 L28 20" stroke="#475569" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="48" height="32" viewBox="0 0 48 32">
      <ellipse cx="24" cy="16" rx="20" ry="12" fill="#334155" />
      <ellipse cx="24" cy="16" rx="17" ry="10" fill="#0f172a" stroke="#0f172a" strokeWidth="1" />
      <ellipse cx="20" cy="14" rx="8" ry="4" fill="#0f172a" opacity="0.8" />
      <ellipse cx="30" cy="18" rx="6" ry="3" fill="#0f172a" opacity="0.8" />
      <circle cx="6" cy="14" r="2" fill="#64748b" />
      <circle cx="42" cy="18" r="2.5" fill="#64748b" />
      <circle cx="8" cy="22" r="1.5" fill="#475569" />
      <circle cx="40" cy="12" r="1.5" fill="#475569" />
    </svg>
  );
});

const DeliveryBikeVisual = React.memo(() => (
  <svg width="40" height="60" viewBox="0 0 40 60">
    <ellipse cx="20" cy="58" rx="14" ry="3" fill="rgba(0,0,0,0.2)" />
    <ellipse cx="20" cy="6" rx="8" ry="4" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
    <ellipse cx="20" cy="6" rx="5" ry="2.5" fill="#334155" />
    <ellipse cx="20" cy="54" rx="8" ry="4" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
    <ellipse cx="20" cy="54" rx="5" ry="2.5" fill="#334155" />
    <path d="M16 8 L16 50 L24 50 L24 8 Z" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
    <rect x="16" y="8" width="8" height="4" rx="2" fill="#64748b" />
    <rect x="14" y="5" width="12" height="4" rx="2" fill="#475569" />
    <rect x="12" y="35" width="16" height="15" rx="3" fill="#475569" stroke="#334155" strokeWidth="1" />
    <rect x="12" y="35" width="16" height="4" fill="#64748b" />
    <path d="M8 14 L16 14 L16 10 L8 10 Z" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
    <circle cx="9" cy="12" r="2" fill="#ef4444" />
    <circle cx="15" cy="12" r="2" fill="#ef4444" />
    <rect x="2" y="18" width="36" height="32" rx="6" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
    <rect x="2" y="22" width="36" height="3" fill="#fbbf24" />
    <rect x="2" y="43" width="36" height="3" fill="#fbbf24" />
    <text x="20" y="36" fontSize="12" fontWeight="900" fill="#15803d" textAnchor="middle" fontFamily="Arial Black">GLO</text>
    <circle cx="8" cy="30" r="2" fill="#22c55e" />
    <circle cx="32" cy="30" r="2" fill="#22c55e" />
    <ellipse cx="20" cy="18" rx="9" ry="8" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
    <rect x="11" y="14" width="18" height="4" rx="2" fill="#eab308" />
    <rect x="13" y="16" width="14" height="5" rx="2" fill="#1e293b" />
    <rect x="14" y="17" width="4" height="3" rx="1" fill="#334155" />
    <path d="M5 45 L10 45 M3 48 L8 48" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
));

declare global {
  interface Window {
    Odesa: any;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function tailwindToHex(cls: string): string {
  const map: Record<string, string> = {
    'text-green-500': '#22c55e',
    'text-red-500': '#ef4444',
    'text-red-600': '#dc2626',
    'text-green-600': '#16a34a',
  };
  for (const [key, val] of Object.entries(map)) {
    if (cls.includes(key)) return val;
  }
  return '#fff';
}

function drawSkyline(ctx: CanvasRenderingContext2D, w: number, h: number, routeId: string) {
  const buildings: { x: number; y: number; w: number; h: number; color?: string }[] = [];
  const add = (x: number, y: number, w: number, h: number) => buildings.push({ x, y, w, h, color: '#1e293b' });
  const addWindows = (x: number, y: number, count: number, spacing: number) => {
    for (let i = 0; i < count; i++) {
      buildings.push({ x: x + 2 + i * spacing, y: y + 2, w: 4, h: 5, color: '#fbbf24' });
    }
  };
  ctx.fillStyle = '#1e293b';
  ctx.globalAlpha = 0.55;
  switch (routeId) {
    case 'route4':
      add(80, 50, 40, 30); addWindows(82, 52, 3, 12);
      ctx.beginPath(); ctx.ellipse(100, 38, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(98, 15, 4, 15); ctx.beginPath(); ctx.arc(100, 12, 4, 0, Math.PI * 2); ctx.fill();
      add(170, 60, 60, 20); addWindows(175, 62, 4, 14);
      add(280, 55, 30, 25); ctx.fillRect(280, 25, 30, 30);
      break;
    case 'route7':
      ctx.beginPath(); ctx.moveTo(30, 80); ctx.lineTo(50, 70); ctx.lineTo(70, 60); ctx.lineTo(90, 50); ctx.lineTo(110, 40); ctx.lineTo(130, 30); ctx.lineTo(130, 80); ctx.closePath(); ctx.fill();
      add(150, 50, 80, 5); add(160, 45, 3, 35); add(180, 45, 3, 35); add(200, 45, 3, 35); add(220, 45, 3, 35);
      add(250, 60, 40, 20); add(260, 55, 8, 25);
      break;
    case 'route148':
      ctx.beginPath(); ctx.arc(40, 45, 15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(70, 40, 12, 0, Math.PI * 2); ctx.fill();
      add(120, 40, 20, 40); ctx.fillRect(125, 20, 10, 20); ctx.beginPath(); ctx.arc(130, 18, 4, 0, Math.PI * 2); ctx.fill();
      add(180, 45, 50, 35); ctx.beginPath(); ctx.moveTo(180, 45); ctx.lineTo(205, 25); ctx.lineTo(230, 45); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(230, 55, 8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'route168':
      add(30, 25, 35, 55); addWindows(35, 30, 3, 10);
      ctx.beginPath(); ctx.moveTo(100, 80); ctx.lineTo(110, 72); ctx.lineTo(120, 64); ctx.lineTo(130, 56); ctx.lineTo(140, 48); ctx.lineTo(150, 40); ctx.lineTo(150, 80); ctx.closePath(); ctx.fill();
      add(170, 55, 70, 4); add(180, 50, 2, 30); add(195, 50, 2, 30); add(210, 50, 2, 30); add(225, 50, 2, 30);
      break;
    case 'route185':
      add(30, 25, 35, 55); addWindows(35, 30, 3, 10);
      add(95, 78, 45, 4); add(100, 62, 3, 16); add(115, 65, 3, 15); add(130, 58, 3, 22);
      add(180, 55, 30, 25); ctx.beginPath(); ctx.ellipse(195, 43, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(193, 25, 4, 12); ctx.beginPath(); ctx.arc(195, 22, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'route250':
      for (let x = 25; x <= 95; x += 14) { add(x, 60 + Math.random() * 8, 12, 15); }
      add(140, 55, 60, 4); add(150, 50, 2, 30); add(165, 50, 2, 30); add(180, 50, 2, 30);
      add(230, 40, 8, 40); add(255, 40, 8, 40); ctx.fillRect(230, 35, 25, 5);
      break;
    default:
      for (let x = 50; x < 450; x += 50) { add(x, 35 + Math.random() * 15, 25 + Math.random() * 10, 40 - Math.random() * 10); }
  }
  for (const b of buildings) {
    if (b.color === '#fbbf24') {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    } else {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = b.color || '#1e293b';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }
  ctx.globalAlpha = 1;
}

function drawMarshrutka(ctx: CanvasRenderingContext2D, x: number, y: number, routeNum: string, doorOpen: boolean) {
  ctx.save();
  ctx.translate(x, y);
  const hw = MARSHRUTKA_WIDTH / 2;
  const hh = MARSHRUTKA_HEIGHT / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, hh - 2, hw * 0.8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, -hw, -hh, MARSHRUTKA_WIDTH, MARSHRUTKA_HEIGHT, 8);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRect(ctx, -hw + 2, -hh + 2, MARSHRUTKA_WIDTH - 4, MARSHRUTKA_HEIGHT - 4, 6);
  ctx.fillStyle = '#fef08a';
  ctx.fill();
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(-hw + 2, -hh + 3, 3, MARSHRUTKA_HEIGHT - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(hw - 5, -hh + 3, 3, MARSHRUTKA_HEIGHT - 6);
  ctx.beginPath();
  ctx.moveTo(-hw + 4, -hh + 5);
  ctx.quadraticCurveTo(0, -hh + 3, hw - 4, -hh + 5);
  ctx.lineTo(hw - 4, -hh + 28);
  ctx.lineTo(-hw + 4, -hh + 28);
  ctx.closePath();
  ctx.fillStyle = '#7dd3fc';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-hw + 6, -hh + 8);
  ctx.quadraticCurveTo(0, -hh + 6, hw - 20, -hh + 12);
  ctx.lineTo(-hw + 12, -hh + 18);
  ctx.lineTo(-hw + 6, -hh + 14);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  roundRect(ctx, -hw + 6, hh - 18, MARSHRUTKA_WIDTH - 12, 8, 2);
  ctx.fillStyle = '#7dd3fc';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath(); ctx.arc(-hw + 8, -hh + 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hw - 8, -hh + 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(-hw + 8, -hh + 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hw - 8, -hh + 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-hw + 8, -hh + 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hw - 8, -hh + 2, 2, 0, Math.PI * 2); ctx.fill();
  roundRect(ctx, -hw, hh - 10, MARSHRUTKA_WIDTH, 6, 2);
  ctx.fillStyle = '#374151';
  ctx.fill();
  roundRect(ctx, -hw, hh - 10, MARSHRUTKA_WIDTH, 2, 1);
  ctx.fillStyle = '#6b7280';
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  roundRect(ctx, -hw + 2, hh - 9, 8, 4, 1); ctx.fill();
  roundRect(ctx, hw - 10, hh - 9, 8, 4, 1); ctx.fill();
  ctx.fillStyle = '#fca5a5';
  roundRect(ctx, -hw + 2, hh - 9, 8, 2, 0.5); ctx.fill();
  roundRect(ctx, hw - 10, hh - 9, 8, 2, 0.5); ctx.fill();
  roundRect(ctx, -15, -hh + 2, 30, 16, 3);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  roundRect(ctx, -13, -hh + 4, 26, 12, 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(routeNum, 0, -hh + 10);
  ctx.save();
  ctx.translate(hw, -hh + 30);
  if (doorOpen) ctx.rotate(-60 * Math.PI / 180);
  roundRect(ctx, 0, 0, 3, 20, 1);
  ctx.fillStyle = '#ca8a04';
  ctx.fill();
  roundRect(ctx, 0.5, 2, 2, 8, 0.5);
  ctx.fillStyle = '#7dd3fc';
  ctx.fill();
  roundRect(ctx, 0.5, 11, 2, 7, 0.5);
  ctx.fillStyle = '#7dd3fc';
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 8, 2, 4);
  ctx.restore();
  if (doorOpen) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hw - 5, -hh + 30, 3, 20);
  }
  ctx.restore();
}

function drawPothole(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number) {
  ctx.save();
  ctx.translate(x, y);
  const img = charImages['pothole-' + variant];
  if (img) {
    const size = variant === 1 ? { w: 60, h: 40 } : variant === 2 ? { w: 40, h: 36 } : { w: 48, h: 32 };
    ctx.drawImage(img, -size.w / 2, -size.h / 2, size.w, size.h);
  }
  ctx.restore();
}

function drawBouquet(ctx: CanvasRenderingContext2D, x: number, y: number, score: number = 1) {
  ctx.save();
  ctx.translate(x, y);
  const key = score === 2 ? 'bouquet-2' : 'bouquet-1';
  const img = charImages[key];
  if (img) {
    ctx.drawImage(img, -14, -16, 28, 32);
  }
  ctx.restore();
}

function drawDeliveryBike(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  const img = charImages['delivery-bike'];
  if (img) {
    ctx.drawImage(img, -20, -30, 40, 60);
  }
  ctx.restore();
}

function drawBabushka(ctx: CanvasRenderingContext2D, x: number, y: number, side: string, sheet: HTMLImageElement | null) {
  ctx.save();
  ctx.translate(x, y);
  if (sheet) {
    const now = performance.now();
    const frameIndex = Math.floor(now / 150) % 16;
    const sx = (frameIndex % 4) * 256;
    const sy = Math.floor(frameIndex / 4) * 256;
    if (side === 'right') {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, 256, 256, -64, -64, 128, 128);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, sy, 256, 256, -64, -64, 128, 128);
    }
  } else {
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, -54, -108, 108, 160, 14);
    ctx.fill();
    ctx.fillStyle = '#334155';
    roundRect(ctx, -48, -102, 96, 148, 10);
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath(); ctx.arc(0, -74, 64, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.arc(0, -84, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.arc(0, -74, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.ellipse(-20, -80, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, -80, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -64, 10, 0, Math.PI); ctx.stroke();
  }
  ctx.restore();
}

function drawPassenger(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, missed?: boolean, stinkyCrying?: boolean, hangingOut?: boolean) {
  ctx.save();
  ctx.translate(x, y);
  let key = 'passenger-' + type;
  if (hangingOut) key += '-hangingOut';
  else if (missed || stinkyCrying) {
    key += '-missed';
    if (type === 'girl') {
      const frame = Math.floor(performance.now() / 200) % 4;
      key += '-' + frame;
    }
  }
  else if (type === 'girl' || type === 'man') {
    const frame = Math.floor(performance.now() / 150) % 3;
    key += '-' + frame;
  }
  const img = charImages[key];
  if (img) {
    ctx.drawImage(img, -20, -20, 40, 40);
  }
  if (hangingOut) {
    ctx.fillStyle = '#60a5fa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -24);
  }
  if (type === 'smelly' || stinkyCrying) {
    ctx.strokeStyle = '#bef264';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-12, -26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(12, -26); ctx.stroke();
  }
  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, variant?: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(251,146,60,0.8)';
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(251,191,36,0.6)';
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  if (variant === 'negative_pizza') {
    ctx.fillStyle = '#991b1b';
    ctx.beginPath(); ctx.arc(-7, -6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-9, 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4, 7, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 7, 2, 0, Math.PI * 2); ctx.fill();
  } else if (variant === 'negative_shawarma') {
    ctx.fillStyle = '#a16207';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#854d0e';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#65a30d';
    ctx.beginPath(); ctx.ellipse(-3, 1, 6, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath(); ctx.ellipse(5, -2, 5, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#991b1b';
    ctx.beginPath(); ctx.ellipse(2, 3, 3, 2, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eab308';
    ctx.beginPath(); ctx.ellipse(-7, 1, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawScenery(ctx: CanvasRenderingContext2D, x: number, y: number, routeId: string, isLeft: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-5, 5, 10, 30);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath(); ctx.arc(0, -12, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.beginPath(); ctx.arc(-8, -16, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -16, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -24, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export default function Game() {
  const [isReady, setIsReady] = useState(false);
  const [lang, setLang] = useState<'en' | 'uk'>('uk');
  const [displayScore, setDisplayScore] = useState(0);
  const scoreRef = useRef(0);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameover' | 'win'>('start');
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [activeRoute, setActiveRoute] = useState(ROUTES[0]);
  const [difficulty, setDifficulty] = useState<'slow' | 'fast'>('slow');
  const [swipeHint, setSwipeHint] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const babushkaSheetRef = useRef<HTMLImageElement | null>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef(0);
  const objectIdRef = useRef(0);
  const popupIdRef = useRef(0);
  const svgPreloaderRef = useRef<HTMLDivElement>(null);
  const stopTimerRef = useRef(0);
  const doorOpenRef = useRef(false);
  const doorTimerRef = useRef(0);
  const doorStuckOpenRef = useRef(false);
  const doorOpenedTimeRef = useRef<number | null>(null);
  const spawnTimers = useRef({ pothole: 0, bike: 0, babushka: 0, scenery: 0, passenger: 0 });
  const objectsRef = useRef<GameObject[]>([]);
  const busXRef = useRef(0);
  const screenShakeRef = useRef(0);
  const distanceRef = useRef(0);
  const maxScoreRef = useRef(0);
  const gameStateRef = useRef(gameState);
  const popupsRef = useRef<Popup[]>([]);
  const roadOffsetRef = useRef(0);
  const gameWidthRef = useRef(350);
  const gameHeightRef = useRef(600);
  const laneLimitRef = useRef(0);
  const busYRef = useRef(500);
  const skyGradRef = useRef<CanvasGradient | null>(null);
  const roadGradRef = useRef<CanvasGradient | null>(null);
  const curbGradLRef = useRef<CanvasGradient | null>(null);
  const curbGradRRef = useRef<CanvasGradient | null>(null);

  useEffect(() => {
    const applyConfig = (config: any) => {
      if (config.lang === 'uk' || config.lang === 'en') setLang(config.lang);
      if (typeof config.sfxEnabled === 'boolean') {
        _soundEnabled = config.sfxEnabled;
        const ctx = getCtx();
        if (ctx) {
          if (!config.sfxEnabled && ctx.state === 'running') ctx.suspend();
          if (config.sfxEnabled && ctx.state === 'suspended') ctx.resume();
        }
      }
    };

    if (window.Odesa) {
      if (window.Odesa.getConfig) applyConfig(window.Odesa.getConfig());
      else if (window.Odesa.config) applyConfig(window.Odesa.config);
      if (window.Odesa.onConfig) {
        window.Odesa.onConfig((config: any) => {
          applyConfig(config);
          setIsReady(true);
        });
      }
      if (window.Odesa.ready) window.Odesa.ready();
      if (window.Odesa.onStop) {
        window.Odesa.onStop(() => {
          setGameState('gameover');
          playSound('gameover');
          if (window.Odesa.gameOver) window.Odesa.gameOver(scoreRef.current);
          if (window.Odesa.saveScore) window.Odesa.saveScore(scoreRef.current);
          if (window.parent) {
            window.parent.postMessage({ type: 'gameOver', score: scoreRef.current, payload: scoreRef.current }, window.location.origin);
          }
        });
      }
      if (window.Odesa.onPause) {
        window.Odesa.onPause(() => {
          if (gameStateRef.current === 'playing') setGameState('paused');
        });
      }
      if (window.Odesa.onResume) {
        window.Odesa.onResume(() => {
          if (gameStateRef.current === 'paused') setGameState('playing');
        });
      }
      setIsReady(true);
    }

    const handleMsg = (e: MessageEvent) => {
      try {
        if (e.data && e.data.type === 'config') {
          applyConfig(e.data.payload || e.data);
          setIsReady(true);
        } else if (e.data && typeof e.data === 'string' && e.data.includes('config')) {
          const parsed = JSON.parse(e.data);
          if (parsed.type === 'config') {
            applyConfig(parsed.payload || parsed);
            setIsReady(true);
          }
        }
      } catch (err) {}
    };
    window.addEventListener('message', handleMsg);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      img.decode().then(() => {
        babushkaSheetRef.current = img;
      }).catch(() => {
        babushkaSheetRef.current = img;
      });
    };
    img.onerror = () => { console.error('[marshrutka] Failed to load babushka spritesheet'); };
    img.src = '/games/marshrutka/babushka/spritesheet.png';

    const timeout = setTimeout(() => setIsReady(true), 2000);

    return () => {
      window.removeEventListener('message', handleMsg);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const container = svgPreloaderRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>('[data-key]');
    const images: Record<string, HTMLImageElement> = {};

    const animatableArm = new Set(['passenger-girl', 'passenger-man']);
    const animatableTear = new Set(['passenger-girl-missed']);
    const frameCounts: Record<string, number> = {};
    items.forEach(el => {
      const key = el.dataset.key || '';
      if (animatableArm.has(key)) frameCounts[key] = 3;
      else if (animatableTear.has(key)) frameCounts[key] = 4;
      else frameCounts[key] = 1;
    });
    const totalToLoad = Object.values(frameCounts).reduce((a, b) => a + b, 0);
    let loaded = 0;
    const checkDone = () => {
      loaded++;
      if (loaded >= totalToLoad) charImages = images;
    };

    items.forEach(el => {
      const key = el.dataset.key || '';
      const svgEl = el.querySelector('svg');
      if (!svgEl) {
        for (let f = 0; f < (frameCounts[key] || 1); f++) checkDone();
        return;
      }
      const frames = frameCounts[key] || 1;
      for (let frame = 0; frame < frames; frame++) {
        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        const frameKey = frames > 1 ? `${key}-${frame}` : key;
        if (animatableArm.has(key)) {
          const angle = frame === 0 ? '0' : frame === 1 ? '20' : '40';
          const arms = clone.querySelectorAll('.waving-arm-girl, .waving-arm-man');
          arms.forEach(p => {
            const el = p as SVGElement;
            const cx = el.classList.contains('waving-arm-girl') ? '25' : '26';
            const cy = el.classList.contains('waving-arm-girl') ? '22' : '20';
            el.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
            el.removeAttribute('class');
          });
        }
        if (animatableTear.has(key)) {
          const offsets = [20, 13, 7, 0];
          const opacities = ['0', '1', '1', '1'];
          const yOffsets = [0, 2, 5, 8];
          const tears = clone.querySelectorAll('.tears');
          tears.forEach(el => {
            const svgEl = el as SVGElement;
            svgEl.setAttribute('opacity', opacities[frame]);
            if (svgEl.tagName === 'path') {
              svgEl.setAttribute('stroke-dashoffset', String(offsets[frame]));
            } else {
              svgEl.setAttribute('transform', `translate(0, ${yOffsets[frame]})`);
            }
            svgEl.removeAttribute('class');
            if (svgEl.hasAttribute('style')) svgEl.removeAttribute('style');
          });
        }
        const suffix = frameKey.replace(/[^a-z0-9]/g, '_');
        let svgData = new XMLSerializer().serializeToString(clone);
        svgData = svgData.replace(/id="([^"]+)"/g, (_, id) => `id="${id}_${suffix}"`);
        svgData = svgData.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}_${suffix})`);
        svgData = svgData.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
        if (!svgData.includes('xmlns=')) {
          svgData = svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); checkDone(); };
        img.onerror = () => { URL.revokeObjectURL(url); checkDone(); };
        img.src = url;
        images[frameKey] = img;
      }
    });
  }, [isReady]);

  useEffect(() => {
    const handleInitAudio = () => {
      getCtx();
      resumeAudioContext();
      window.removeEventListener('click', handleInitAudio);
    };
    window.addEventListener('click', handleInitAudio);
    return () => window.removeEventListener('click', handleInitAudio);
  }, []);

  useEffect(() => {
    if (!swipeHint) return;
    const timer = setTimeout(() => setSwipeHint(false), 2000);
    return () => clearTimeout(timer);
  }, [swipeHint]);

  const showPointsPopup = (text: string, color: string, busX: number) => {
    const id = popupIdRef.current++;
    popupsRef.current = [...popupsRef.current, { id, text, color, type: 'points', busX, createdAt: performance.now() }];
  };

  const showWordsPopup = (text: string, color: string) => {
    const id = popupIdRef.current++;
    const wordCount = popupsRef.current.filter(p => p.type === 'words').length;
    popupsRef.current = [...popupsRef.current, { id, text, color, type: 'words', stackIndex: wordCount, createdAt: performance.now() }];
  };

  const startGame = (route: typeof ROUTES[0]) => {
    setActiveRoute(route);
    scoreRef.current = 0;
    setDisplayScore(0);
    objectsRef.current = [];
    popupsRef.current = [];
    setTimeLeft(route.time);
    busXRef.current = 0;
    setSwipeHint(true);
    setGameState('playing');
    if (window.parent) {
      window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, window.location.origin);
    }
    lastTimeRef.current = 0;
    stopTimerRef.current = 0;
    doorOpenRef.current = false;
    doorStuckOpenRef.current = false;
    doorOpenedTimeRef.current = null;
    distanceRef.current = 0;
    maxScoreRef.current = 0;
    spawnTimers.current = { pothole: 0, bike: 0, babushka: 0, scenery: 0, passenger: 0 };
  };

  useEffect(() => {
    let interval: number;
    if (gameState === 'playing') {
      interval = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('win');
            playSound('win');
            if (window.Odesa) {
              if (window.Odesa.win) window.Odesa.win(scoreRef.current);
              if (window.Odesa.saveScore) window.Odesa.saveScore(scoreRef.current);
            }
            if (window.parent) {
              window.parent.postMessage({ type: 'win', score: scoreRef.current, payload: scoreRef.current }, window.location.origin);
              window.parent.postMessage({ type: 'saveScore', score: scoreRef.current, payload: scoreRef.current }, window.location.origin);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameState !== 'playing' || !gameContainerRef.current) return;
    if (swipeHint) setSwipeHint(false);
    const rect = gameContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const busMoveLimit = (rect.width - 160) / 2;
    busXRef.current = Math.max(-busMoveLimit, Math.min(busMoveLimit, x));
  };

  const drawFrame = (ctx: CanvasRenderingContext2D) => {
    const w = gameWidthRef.current;
    const h = gameHeightRef.current;

    const shake = screenShakeRef.current;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    ctx.fillStyle = skyGradRef.current || '#38bdf8';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(48, 24, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(68, 22, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(82, 28, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(60, 28, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(w - 64, 48, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w - 48, 44, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w - 56, 52, 12, 8, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, 96);
    ctx.clip();
    drawSkyline(ctx, w, 96, activeRoute.id);
    ctx.restore();

    const roadLeft = 56;
    const roadRight = w - 56;
    const roadW = roadRight - roadLeft;

    ctx.fillStyle = roadGradRef.current || '#3d4654';
    ctx.fillRect(roadLeft, 0, roadW, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(roadLeft, 0, roadW, h);
    ctx.clip();

    const dashHeight = 70;
    const dashSpacing = 140;
    const offset = roadOffsetRef.current % dashSpacing;
    const centerX = roadLeft + roadW / 2;
    const numDashes = Math.ceil(h / dashSpacing) + 2;
    for (let i = -1; i < numDashes; i++) {
      const y = i * dashSpacing + offset - dashHeight;
      ctx.fillStyle = '#cbd5e1';
      roundRect(ctx, centerX - 2, y, 4, dashHeight, 4);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = curbGradLRef.current || '#a8a29e';
    ctx.fillRect(0, 0, roadLeft, h);
    ctx.fillRect(roadRight, 0, roadLeft, h);
    ctx.fillStyle = curbGradRRef.current || '#78716c';
    ctx.fillRect(0, 0, roadLeft, h);
    ctx.fillRect(w - roadLeft, 0, roadLeft, h);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(roadLeft, 0, 4, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(roadRight - 4, 0, 4, h);

    ctx.fillStyle = '#57534e';
    ctx.fillRect(0, 0, 4, h);
    ctx.fillRect(w - 4, 0, 4, h);

    ctx.translate(w / 2, 0);

    const sortedObjects = objectsRef.current;
    sortedObjects.sort((a, b) => {
      const z: Record<string, number> = { scenery: 1, babushka: 10, passenger: 15, flower: 15, falling_flower: 15, pothole: 15, delivery_bike: 20, explosion: 100 };
      return (z[a.type] || 5) - (z[b.type] || 5);
    });

    for (const obj of sortedObjects) {
      switch (obj.type) {
        case 'babushka':
          drawBabushka(ctx, obj.x, obj.y, obj.side || 'left', babushkaSheetRef.current);
          break;
        case 'passenger':
          drawPassenger(ctx, obj.x, obj.y, obj.passengerType || 'man', obj.missed, obj.stinkyCrying, obj.hangingOut);
          break;
        case 'delivery_bike':
          drawDeliveryBike(ctx, obj.x, obj.y);
          break;
        case 'flower':
        case 'falling_flower':
          drawBouquet(ctx, obj.x, obj.y, obj.score);
          break;
        case 'scenery':
          drawScenery(ctx, obj.x, obj.y, activeRoute.id, obj.side === 'left');
          break;
        case 'explosion':
          drawExplosion(ctx, obj.x, obj.y, obj.variant as string | undefined);
          break;
        default:
          drawPothole(ctx, obj.x, obj.y, Number(obj.variant || 0));
      }
    }

    if (gameState === 'playing') {
      drawMarshrutka(ctx, busXRef.current, busYRef.current, activeRoute.number, doorOpenRef.current);
    }

    const now = performance.now();
    for (const p of popupsRef.current) {
      const elapsed = now - p.createdAt;
      const dur = p.type === 'points' ? 1000 : 1500;
      const progress = elapsed / dur;
      let alpha: number;
      let yOff = 0;
      if (p.type === 'points') {
        alpha = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
        yOff = -progress * 20;
        const px = p.busX !== undefined ? p.busX : 0;
        const py = busYRef.current - MARSHRUTKA_HEIGHT / 2 - 50 + yOff;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = tailwindToHex(p.color);
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.text, px, py);
      } else {
        alpha = progress < 0.1 ? progress / 0.1 : progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
        const py = h * 0.25 + (p.stackIndex || 0) * 48;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        const hex = tailwindToHex(p.color);
        ctx.font = 'bold 16px sans-serif';
        const textWidth = ctx.measureText(p.text).width;
        const bubblePad = 16;
        const bubbleW = textWidth + bubblePad * 2;
        ctx.fillStyle = '#000000';
        roundRect(ctx, -bubbleW / 2, py - 16, bubbleW, 32, 20);
        ctx.fill();
        ctx.strokeStyle = hex + '66';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = hex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, 0, py);
      }
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  const update = (time: number) => {
    if (gameState !== 'playing') {
      lastTimeRef.current = 0;
      return;
    }
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
      spawnTimers.current.pothole = time;
      spawnTimers.current.babushka = time;
      spawnTimers.current.bike = time;
      spawnTimers.current.passenger = time;
      spawnTimers.current.scenery = time;
    }
    const deltaTime = Math.min(time - lastTimeRef.current, 100);
    lastTimeRef.current = time;
    const dt = deltaTime / 1000;

    const roadSpeed = difficulty === 'fast' ? 320 : 220;
    const bikeSpeed = difficulty === 'fast' ? 220 : 160;
    const frameMove = roadSpeed * dt;

    distanceRef.current += frameMove;
    roadOffsetRef.current = distanceRef.current % 560;

    const gameWidth = gameWidthRef.current;
    const gameHeight = gameHeightRef.current;
    const laneLimit = laneLimitRef.current;
    const busY = busYRef.current;
    const currentBusX = busXRef.current;

    let next = objectsRef.current;
    const newItems: GameObject[] = [];

    if (!doorStuckOpenRef.current && time > doorTimerRef.current) {
      if (doorOpenRef.current) {
        const nearPassenger = next.some(o => o.type === 'passenger' && !o.missed && Math.abs(o.y - busY) < 300);
        if (!nearPassenger) {
          doorOpenRef.current = false;
        }
      }
    }

    if (doorOpenRef.current) {
      if (doorOpenedTimeRef.current === null) {
        doorOpenedTimeRef.current = time;
      }
    } else {
      doorOpenedTimeRef.current = null;
    }

    for (const obj of next) {
      if (obj.type === 'pothole' || obj.type === 'babushka' || obj.type === 'scenery' || obj.type === 'explosion') {
        obj.y += frameMove;
      } else if (obj.hangingOut) {
        obj.x = currentBusX + 22;
        obj.y = busY + 20;
        if (time - (obj as any)._hangTimer > 6000) {
          (obj as any)._hangTimer = time;
          obj.hangingOut = false;
          obj.missed = true;
          obj.y = gameHeight + 200;
          doorStuckOpenRef.current = false;
        } else if ((obj as any)._hangTimer === undefined) {
          (obj as any)._hangTimer = time;
        }
      } else if (obj.type === 'passenger') {
        if (!obj.missed && Math.abs(obj.y - busY) < 300) {
          doorOpenRef.current = true;
        }
        if (!obj.missed) {
          obj.y += frameMove;
          if (obj.y > busY + 120) {
            obj.missed = true;
            obj.passengerBehavior = 'running_up';
            obj.stinkyCrying = true;
            const t = TRANSLATIONS[lang];
            showWordsPopup(t.ignored, "text-red-600");
            if (obj.passengerType === 'man') {
              obj.passengerType = 'smelly';
            }
            doorOpenRef.current = true;
            doorTimerRef.current = time + 2000;
            doorStuckOpenRef.current = true;
            newItems.push({
              id: objectIdRef.current++,
              type: 'passenger',
              passengerType: Math.random() > 0.5 ? 'man' : 'girl',
              x: currentBusX + 22,
              y: busY + 20,
              hangingOut: true,
              score: -1
            });
            scoreRef.current -= 1;
            setDisplayScore(scoreRef.current);
            showPointsPopup("-1", "text-red-500", currentBusX);
          }
        } else {
          if (obj.passengerBehavior === 'running_up') {
            obj.y -= 1000 * dt;
            if (obj.y < -50) {
              obj.passengerBehavior = 'running_down';
            }
          } else {
            obj.y += frameMove;
            if (obj.passengerBehavior === 'running_down') {
              const dx = currentBusX - obj.x;
              obj.x += Math.sign(dx) * Math.min(Math.abs(dx), 200 * dt);
            }
          }
        }
      } else if (obj.type === 'delivery_bike') {
        const distToBus = Math.abs(obj.x - currentBusX);
        const distY = (busY - 90) - obj.y;
        if (distY > 0 && distY < 300 && distToBus < 80) {
          const evadeDir = obj.x < currentBusX ? -1 : 1;
          obj.y += (roadSpeed - bikeSpeed) * dt;
          obj.x += evadeDir * 400 * dt;
        } else {
          const dartY = Math.cos(time / 200 + obj.id * 5) * 120;
          obj.y += (roadSpeed - bikeSpeed + dartY) * dt;
          obj.x += Math.cos(time / 150 + obj.id * 10) * 250 * dt;
        }
        const busMoveLimit = (gameWidth - 120) / 2;
        obj.x = Math.max(-busMoveLimit + 15, Math.min(busMoveLimit - 15, obj.x));
      } else if (obj.type === 'flower' || obj.type === 'falling_flower') {
        if (obj.type === 'flower') {
          if (obj.vy !== undefined) {
            obj.vy += 350 * dt;
            obj.y += frameMove + obj.vy * dt;
          } else {
            obj.y += frameMove + 150 * dt;
          }
          if (obj.targetX !== undefined) {
            const dx = obj.targetX - obj.x;
            obj.x += dx * dt * (obj.trackSpeed ?? 3.0);
          }
        } else {
          obj.y += frameMove;
          if (obj.targetX !== undefined) {
            const dx = obj.targetX - obj.x;
            obj.x += dx * dt * 6.0;
          }
        }
      }
    }

    const busHitWidth = 36;
    const busHitHeight = 80;
    const busLeft = currentBusX - busHitWidth / 2;
    const busRight = currentBusX + busHitWidth / 2;
    const busTop = busY - busHitHeight / 2;
    const busBottom = busY + busHitHeight / 2;

    next = next.filter(obj => {
      if (obj.y > gameHeight + 100) return false;
      if (obj.type === 'babushka' || obj.type === 'scenery' || obj.type === 'falling_flower' || obj.type === 'explosion') return true;
      if (obj.hangingOut) return doorOpenRef.current;

      let hitWidth = 20;
      let hitHeight = 20;
      if (obj.type === 'pothole') {
        hitWidth = obj.variant === 1 ? 40 : 30;
        hitHeight = obj.variant === 1 ? 20 : 15;
      }
      if (obj.type === 'delivery_bike') { hitWidth = 26; hitHeight = 40; }
      if (obj.type === 'flower') { hitWidth = 30; hitHeight = 30; }
      if (obj.type === 'passenger') { hitWidth = 30; hitHeight = 40; }

      const objLeft = obj.x - hitWidth / 2;
      const objRight = obj.x + hitWidth / 2;
      const objTop = obj.y - hitHeight / 2;
      const objBottom = obj.y + hitHeight / 2;

      const collided =
        objRight > busLeft &&
        objLeft < busRight &&
        objBottom > busTop &&
        objTop < busBottom;

      if (collided && !(obj.type === 'passenger' && obj.passengerBehavior === 'running_up')) {
        if (obj.type === 'flower') {
          const points = obj.score || 1;
          scoreRef.current += points;
          setDisplayScore(scoreRef.current);
          playSound('flower');
          triggerHaptic('light');
          showPointsPopup(`+${points}`, "text-green-500", currentBusX);
        } else if (obj.type === 'passenger') {
          doorOpenRef.current = false;
          doorStuckOpenRef.current = false;
          const t = TRANSLATIONS[lang];
          if (obj.missed || obj.stinkyCrying) {
            if (obj.passengerType === 'smelly') {
              scoreRef.current -= 3;
              setDisplayScore(scoreRef.current);
              playSound('pothole');
              triggerHaptic('heavy');
              showWordsPopup(t.stinkyMan, "text-red-600");
              showPointsPopup("-3", "text-red-500", currentBusX);
            } else if (obj.passengerType === 'girl') {
              scoreRef.current -= 4;
              setDisplayScore(scoreRef.current);
              playSound('pothole');
              triggerHaptic('heavy');
              showWordsPopup(t.cryingGirl, "text-red-600");
              showPointsPopup("-4", "text-red-500", currentBusX);
            } else {
              scoreRef.current -= 3;
              setDisplayScore(scoreRef.current);
              playSound('pothole');
              triggerHaptic('heavy');
              showWordsPopup(t.missed, "text-red-600");
              showPointsPopup("-3", "text-red-500", currentBusX);
            }
          } else {
            if (obj.passengerType === 'smelly') {
              scoreRef.current -= 3;
              setDisplayScore(scoreRef.current);
              playSound('pothole');
              triggerHaptic('heavy');
              showWordsPopup(t.stinky, "text-red-600");
              showPointsPopup("-3", "text-red-500", currentBusX);
            } else {
              const isGirl = obj.passengerType === 'girl';
              const points = isGirl ? 2 : 1;
              scoreRef.current += points;
              setDisplayScore(scoreRef.current);
              playSound('flower');
              triggerHaptic('light');
              showWordsPopup(t.pickedUp, "text-green-600");
              showPointsPopup(`+${points}`, "text-green-500", currentBusX);
            }
          }
        } else if (obj.type === 'delivery_bike') {
          const isHitFromBehind = obj.y < busTop + 20 && Math.abs(currentBusX - obj.x) < 22;
          const t = TRANSLATIONS[lang];
          const food = obj.foodType || 'pizza';
          const bonusKey = food === 'pizza' ? 'deliveryBonusPizza' : 'deliveryBonusShawarma';
          const hitKey = food === 'pizza' ? 'deliveryHitPizza' : 'deliveryHitShawarma';
          if (isHitFromBehind) {
            scoreRef.current += 5;
            setDisplayScore(scoreRef.current);
            playSound('bike');
            triggerHaptic('light');
            showWordsPopup(t[bonusKey], "text-green-600");
            showPointsPopup("+5", "text-green-500", currentBusX);
          } else {
            scoreRef.current -= 5;
            setDisplayScore(scoreRef.current);
            playSound('pothole');
            triggerHaptic('heavy');
            showPointsPopup("-5", "text-red-500", currentBusX);
            showWordsPopup(t[hitKey], "text-red-600");
            newItems.push({ id: objectIdRef.current++, type: 'explosion', x: obj.x, y: obj.y, variant: 'negative_' + food });
          }
          screenShakeRef.current = 20;
        } else if (obj.type === 'pothole') {
          if ((obj as any)._hit) return true;
          (obj as any)._hit = true;
          const lost = 3;
          scoreRef.current -= lost;
          setDisplayScore(scoreRef.current);
          playSound('pothole');
          triggerHaptic('heavy');
          const t = TRANSLATIONS[lang];
          showWordsPopup(t.flowersLost, "text-red-600");
          showPointsPopup(`-${lost}`, "text-red-500", currentBusX);
          screenShakeRef.current = 30;
          doorOpenRef.current = true;
          doorTimerRef.current = time + 600;
          for (let i = 0; i < lost; i++) {
            newItems.push({
              id: objectIdRef.current++,
              type: 'falling_flower',
              x: currentBusX + (Math.random() - 0.5) * 40,
              y: busTop,
              vy: -250 - Math.random() * 200,
              targetX: currentBusX + 100 + Math.random() * 200
            });
          }
          return true;
        }
        return false;
      }
      return true;
    });

    next.push(...newItems);

    for (const obj of next) {
      if (obj.type === 'babushka' && !obj.hasThrown && obj.y > 150 && obj.y < busY - 150) {
        obj.hasThrown = true;
        const throwType = Math.random();
        let targetX: number;
        let vy: number;
        let trackSpeed: number;
        let score: number;
        if (throwType < 0.33) {
          targetX = (Math.random() - 0.5) * laneLimit * 1.2;
          vy = -250 - Math.random() * 100;
          trackSpeed = 1.5 + Math.random() * 1.0;
          score = 1;
        } else if (throwType < 0.66) {
          targetX = (Math.random() - 0.5) * laneLimit * 2.5;
          vy = 200 + Math.random() * 150;
          trackSpeed = 0.5 + Math.random() * 1.0;
          score = 2;
        } else {
          targetX = (Math.random() - 0.5) * laneLimit * 1.5;
          vy = 50 + Math.random() * 100;
          trackSpeed = 2.5 + Math.random() * 2.0;
          score = Math.random() > 0.5 ? 2 : 1;
        }
        next.push({
          id: objectIdRef.current++,
          type: 'flower',
          x: obj.x,
          y: obj.y,
          targetX: targetX,
          vy: vy,
          trackSpeed: trackSpeed,
          score: score
        });
      }
    }

    if (time - spawnTimers.current.pothole > (difficulty === 'fast' ? 1000 : 1500)) {
      if (Math.random() < 0.9) {
        next.push({
          id: objectIdRef.current++,
          type: 'pothole',
          x: (Math.random() - 0.5) * laneLimit * 1.5,
          y: -100,
          variant: Math.floor(Math.random() * 3)
        });
      }
      spawnTimers.current.pothole = time;
    }

    if (time - spawnTimers.current.babushka > (difficulty === 'fast' ? 1800 : 2500)) {
      if (Math.random() < 0.95) {
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const bX = side === 'left' ? -gameWidth / 2 + 30 : gameWidth / 2 - 30;
        next.push({
          id: objectIdRef.current++,
          type: 'babushka',
          x: bX,
          y: -250,
          side: side,
          hasThrown: false
        });
      }
      spawnTimers.current.babushka = time;
    }

    if (time - spawnTimers.current.bike > (difficulty === 'fast' ? 6000 : 8000)) {
      if (Math.random() < 0.5 && !next.some(o => o.type === 'delivery_bike')) {
        const foodType = Math.random() > 0.5 ? 'pizza' : 'shawarma';
        next.push({
          id: objectIdRef.current++,
          type: 'delivery_bike',
          x: (Math.random() - 0.5) * laneLimit * 1.2,
          y: -150,
          foodType
        });
      }
      spawnTimers.current.bike = time;
    }

    if (time - spawnTimers.current.passenger > (difficulty === 'fast' ? 2200 : 3500)) {
      if (Math.random() < 0.85) {
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const bX = side === 'left' ? -gameWidth / 2 + 50 : gameWidth / 2 - 50;
        next.push({
          id: objectIdRef.current++,
          type: 'passenger',
          x: bX,
          y: -100,
          side: side,
          passengerType: Math.random() > 0.5 ? 'girl' : 'man'
        });
      }
      spawnTimers.current.passenger = time;
    }

    objectsRef.current = next;

    const now = performance.now();
    popupsRef.current = popupsRef.current.filter(p => {
      const elapsed = now - p.createdAt;
      return elapsed < (p.type === 'points' ? 1000 : 1500);
    });

    if (scoreRef.current > maxScoreRef.current) {
      maxScoreRef.current = scoreRef.current;
    }
    if (scoreRef.current < 0 || (scoreRef.current === 0 && maxScoreRef.current > 0)) {
      setGameState('gameover');
      playSound('gameover');
      if (window.Odesa) {
        if (window.Odesa.gameOver) window.Odesa.gameOver(scoreRef.current);
        if (window.Odesa.saveScore) window.Odesa.saveScore(scoreRef.current);
      }
      if (window.parent) {
        window.parent.postMessage({ type: 'gameOver', score: scoreRef.current, payload: scoreRef.current }, window.location.origin);
      }
    }

    if (screenShakeRef.current > 0) {
      screenShakeRef.current *= 0.9;
      if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
    }
  };

  const gameLoop = (time: number) => {
    update(time);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFrame(ctx);
      }
    }
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container) return;
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      gameWidthRef.current = rect.width;
      gameHeightRef.current = rect.height;
      laneLimitRef.current = (rect.width - 96) / 2;
      busYRef.current = rect.height - 200 + Math.round(rect.height * 0.1);
      const w = rect.width, h = rect.height;
      const roadLeft = 56;
      if (ctx) {
        skyGradRef.current = ctx.createLinearGradient(0, 0, 0, h);
        skyGradRef.current.addColorStop(0, '#38bdf8');
        skyGradRef.current.addColorStop(0.5, '#7dd3fc');
        skyGradRef.current.addColorStop(1, '#bae6fd');
        roadGradRef.current = ctx.createLinearGradient(0, 0, 0, h);
        roadGradRef.current.addColorStop(0, '#3d4654');
        roadGradRef.current.addColorStop(0.5, '#2d3544');
        roadGradRef.current.addColorStop(1, '#1f2937');
        curbGradLRef.current = ctx.createLinearGradient(0, 0, roadLeft, 0);
        curbGradLRef.current.addColorStop(0, '#a8a29e');
        curbGradLRef.current.addColorStop(1, '#78716c');
        curbGradRRef.current = ctx.createLinearGradient(w - roadLeft, 0, w, 0);
        curbGradRRef.current.addColorStop(0, '#78716c');
        curbGradRRef.current.addColorStop(1, '#a8a29e');
      }
    };
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    resizeCanvas();
    return () => observer.disconnect();
  }, [isReady]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, lang, difficulty]);

  const t = TRANSLATIONS[lang];

  if (!isReady) {
    return <div className="fixed inset-0 bg-slate-900" />;
  }

  return (
    <div className="relative w-full h-full bg-neutral-900 overflow-hidden flex flex-col items-center justify-center font-sans select-none touch-none">

      {/* HUD Header */}
      {gameState === 'playing' && (
        <div className="absolute top-4 left-0 right-0 z-50 flex justify-between px-4 sm:px-6 mx-auto w-full max-w-lg pointer-events-none">
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="flex items-center justify-center gap-2 bg-gradient-to-b from-zinc-800 to-zinc-900 px-4 py-2 rounded-xl border-b-4 border-amber-500 shadow-xl min-w-[5rem] ring-1 ring-amber-500/30">
              <div className="p-1.5 bg-amber-500/20 rounded-lg">
                <VyshyvankaIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              </div>
              <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none tracking-tight ${displayScore < 0 ? 'text-red-500 animate-pulse' : 'text-white'} text-right`}>{displayScore}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 bg-gradient-to-b from-zinc-800 to-zinc-900 px-4 py-2 rounded-xl border-b-4 border-slate-600 shadow-xl text-white shrink-0 min-w-[5rem] ring-1 ring-slate-500/30">
            <svg className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-lg sm:text-xl font-black tabular-nums leading-none mt-0.5 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}s</span>
          </div>
        </div>
      )}

      {/* Swipe hint */}
      {swipeHint && gameState === 'playing' && (
        <div className="absolute bottom-8 left-0 right-0 z-50 flex flex-col items-center pointer-events-none">
          <div className="relative flex items-center gap-6 px-8 py-5 bg-black/60 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl">
            <div className="relative flex items-center gap-1">
              <svg className="w-10 h-10 text-yellow-400 animate-swipeLeft" viewBox="0 0 40 40" fill="currentColor">
                <path d="M28 20 L14 12 L14 17 L4 17 L4 23 L14 23 L14 28 Z"/>
              </svg>
              <svg className="w-10 h-10 text-yellow-400 animate-swipeRight" viewBox="0 0 40 40" fill="currentColor">
                <path d="M12 20 L26 12 L26 17 L36 17 L36 23 L26 23 L26 28 Z"/>
              </svg>
            </div>
            <span className="text-white font-black text-xl uppercase tracking-widest drop-shadow-lg">{t.swipe}</span>
            <div className="relative flex items-center gap-1">
              <svg className="w-10 h-10 text-yellow-400 animate-swipeLeft" viewBox="0 0 40 40" fill="currentColor">
                <path d="M28 20 L14 12 L14 17 L4 17 L4 23 L14 23 L14 28 Z"/>
              </svg>
              <svg className="w-10 h-10 text-yellow-400 animate-swipeRight" viewBox="0 0 40 40" fill="currentColor">
                <path d="M12 20 L26 12 L26 17 L36 17 L36 23 L26 23 L26 28 Z"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="text-white text-5xl font-black tracking-widest drop-shadow-lg select-none">PAUSED</div>
        </div>
      )}

      {/* Main Game Canvas */}
      <div
        ref={gameContainerRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
        className="relative w-full max-w-lg h-full touch-none overflow-hidden"
        style={{ cursor: gameState === 'playing' ? 'none' : 'default' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        <div ref={svgPreloaderRef} style={{ position: 'absolute', left: -9999, top: 0, pointerEvents: 'none' }}>
          <div data-key="passenger-girl"><PassengerVisual type="girl" /></div>
          <div data-key="passenger-girl-missed"><PassengerVisual type="girl" missed /></div>
          <div data-key="passenger-girl-hangingOut"><PassengerVisual type="girl" hangingOut /></div>
          <div data-key="passenger-man"><PassengerVisual type="man" /></div>
          <div data-key="passenger-man-missed"><PassengerVisual type="man" missed /></div>
          <div data-key="passenger-man-hangingOut"><PassengerVisual type="man" hangingOut /></div>
          <div data-key="passenger-smelly"><PassengerVisual type="smelly" /></div>
          <div data-key="passenger-smelly-missed"><PassengerVisual type="smelly" missed /></div>
          <div data-key="bouquet-1"><BouquetVisual score={1} /></div>
          <div data-key="bouquet-2"><BouquetVisual score={2} /></div>
          <div data-key="pothole-0"><PotholeVisual variant={0} /></div>
          <div data-key="pothole-1"><PotholeVisual variant={1} /></div>
          <div data-key="pothole-2"><PotholeVisual variant={2} /></div>
          <div data-key="delivery-bike"><DeliveryBikeVisual /></div>
        </div>
      </div>

      {/* Menus */}
      <AnimatePresence initial={false}>
        {gameState === 'start' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-center"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-10 left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-20 right-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#0057b7] to-[#ffd700] drop-shadow-lg">
                {t.title2}
              </h1>
              <p className="text-xs sm:text-sm font-bold mb-4 drop-shadow-md uppercase tracking-wide text-white">
                {t.pickUpPassengers} • {t.avoidPotholes} • {t.collectFlowers}
              </p>
              <div
                onClick={() => setDifficulty(prev => prev === 'slow' ? 'fast' : 'slow')}
                className="flex bg-slate-700/50 p-1 rounded-2xl mb-6 w-full max-w-[220px] relative cursor-pointer ring-2 ring-white/10 overflow-hidden"
              >
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-6px)] bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl transition-transform duration-300 shadow-lg transform-gpu"
                  style={{
                    left: '4px',
                    transform: difficulty === 'fast' ? 'translateX(100%)' : 'translateX(0)',
                    width: 'calc(50% - 4px)'
                  }}
                />
                <div className={`flex-1 text-center py-2.5 z-10 text-sm font-bold transition-colors duration-200 ${difficulty === 'slow' ? 'text-white' : 'text-white/60'}`}>{t.slow || 'SLOW'}</div>
                <div className={`flex-1 text-center py-2.5 z-10 text-sm font-bold transition-colors duration-200 ${difficulty === 'fast' ? 'text-white' : 'text-white/60'}`}>{t.fast || 'FAST'}</div>
              </div>
              <div className="flex flex-col gap-2 mb-6 bg-slate-800/50 p-4 rounded-2xl border border-white/10 backdrop-blur-sm w-full">
                <div className="grid grid-cols-4 gap-4 text-white">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-center gap-2 h-[40px]">
                      <span className="text-emerald-400 font-black text-sm leading-none">+2</span>
                      <div className="flex items-center justify-center"><div className="scale-95"><PassengerVisual type="girl" /></div></div>
                    </div>
                    <div className="w-full h-px bg-white/10" />
                    <div className="flex flex-row items-center justify-center gap-2 h-[40px]">
                      <span className="text-red-400 font-black text-sm leading-none">-4</span>
                      <div className="flex items-center justify-center"><div className="scale-90"><PassengerVisual type="girl" missed /></div></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-center gap-2 h-[40px]">
                      <span className="text-emerald-400 font-black text-sm leading-none">+1</span>
                      <div className="flex items-center justify-center"><div className="scale-90"><PassengerVisual type="man" /></div></div>
                    </div>
                    <div className="w-full h-px bg-white/10" />
                    <div className="flex flex-row items-center justify-center gap-2 h-[40px]">
                      <span className="text-red-400 font-black text-sm leading-none">-3</span>
                      <div className="flex items-center justify-center"><div className="scale-90"><PassengerVisual type="smelly" /></div></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-center gap-2 h-[40px]">
                      <div className="flex flex-row items-center gap-1">
                        <span className="text-emerald-400 font-black text-sm leading-none">+1</span>
                        <div className="flex items-center justify-center scale-90"><BouquetVisual score={1} /></div>
                      </div>
                      <div className="flex flex-row items-center gap-1">
                        <span className="text-emerald-400 font-black text-sm leading-none">+2</span>
                        <div className="flex items-center justify-center scale-90"><BouquetVisual score={2} /></div>
                      </div>
                    </div>
                    <div className="w-full h-px bg-white/10" />
                    <div className="flex flex-row items-center justify-center gap-2 h-[40px]">
                      <span className="text-red-400 font-black text-sm leading-none">-3</span>
                      <div className="flex items-center justify-center"><div className="scale-75"><PotholeVisual /></div></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-center gap-1 h-[40px]">
                      <span className="text-emerald-400 font-black text-sm leading-none">+5</span>
                      <div className="flex items-center justify-center"><div className="scale-75"><DeliveryBikeVisual /></div></div>
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-emerald-400 mt-3 -ml-2">
                        <ChevronsUp size={14} strokeWidth={4} />
                      </motion.div>
                    </div>
                    <div className="w-full h-px bg-white/10" />
                    <div className="flex flex-row items-center justify-center gap-1 h-[40px]">
                      <span className="text-red-400 font-black text-sm leading-none">-5</span>
                      <div className="flex items-center justify-center"><div className="scale-75 rotate-[-15deg]"><DeliveryBikeVisual /></div></div>
                      <motion.div animate={{ x: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-red-500 mt-1 -ml-1">
                        <ChevronsLeft size={14} strokeWidth={4} />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full">
                {ROUTES.map(r => (
                  <button
                    key={r.number}
                    onClick={() => startGame(r)}
                    className="flex flex-col items-center gap-1 text-white transition-[transform] duration-200 active:scale-95 transform-gpu"
                  >
                    <div className="w-12 h-12 shrink-0 bg-[#0057b7] rounded-lg flex items-center justify-center text-[#ffd700] font-black text-lg shadow-md">
                      {r.number}
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-xs leading-tight min-h-[28px] flex items-center justify-center text-white overflow-hidden">{(t as any)[r.id]}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {(gameState === 'gameover' || gameState === 'win') && (
          <GameEndScreen
            score={displayScore}
            won={gameState === 'win'}
            imageSrc="/images/marshrutka.png"
            title={{ win: t.win, lose: t.wrecked }}
            subtitle={gameState === 'gameover' ? t.wreckedDesc : undefined}
            onPlayAgain={() => {
              if (gameState === 'win' && window.parent) {
                window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, window.location.origin);
              }
              setGameState('start');
            }}
            onQuit={() => window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, window.location.origin)}
            t={{ playAgain: t.playAgain, tryAgain: t.tryAgain, quit: t.quit }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
