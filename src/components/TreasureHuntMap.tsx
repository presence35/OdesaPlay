import React, { useState, useEffect } from 'react';
import { translations, Language } from '../language';
import { type Restaurant } from '../data/restaurants';
import { Utensils, CheckCircle2, MapPin } from 'lucide-react';

export default function TreasureHuntMap({ venues = [], demoMode = false, pendingCheckIn, lang = 'uk' }: { venues: Restaurant[], demoMode?: boolean, pendingCheckIn?: string | null, lang?: Language }) {
  const RESTAURANTS = venues;
  const [completeList, setCompleteList] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const t = translations[lang];
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (selectedId && itemRefs.current[selectedId]) {
      itemRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('odesa_checkins') || '{}');
    const completed = Object.entries(stored)
      .filter(([_, v]: [string, any]) => v.mode === 'full')
      .map(([id]) => id);
    setCompleteList(completed);
  }, []);

  const visit = (id: string) => {
    if (!completeList.includes(id)) {
      setCompleteList(prev => [...prev, id]);
      const stored = JSON.parse(localStorage.getItem('odesa_checkins') || '{}');
      stored[id] = { mode: 'full', timestamp: Date.now() };
      localStorage.setItem('odesa_checkins', JSON.stringify(stored));
    }
  };

  useEffect(() => {
    if (pendingCheckIn) {
      visit(pendingCheckIn);
    }
  }, [pendingCheckIn]);

  const handleTap = (id: string) => {
    setSelectedId(id);
  };

  return (
    <div className="bg-slate-900 rounded-[32px] p-6 shadow-2xl overflow-hidden border border-white/10 relative mt-4">
      {/* Demo Mode Badge */}
      {demoMode && (
        <div className="absolute top-4 right-4 outline outline-red-500 text-red-500 bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-red-500/50 z-10">
          {t.demoMode}
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-slate-500 uppercase font-bold tracking-widest px-2 mb-4">
        <span>{t.progress}: {completeList.length} / {RESTAURANTS.length}</span>
        <span>{RESTAURANTS.length > 0 ? Math.round((completeList.length / RESTAURANTS.length) * 100) : 0}%</span>
      </div>

      <div className="bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">{t.restaurants}</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 divide-y divide-white/5" ref={listRef}>
          {RESTAURANTS.map((r) => {
            const isCompleted = completeList.includes(r.id);
            const isSelected = selectedId === r.id;
            return (
              <div 
                key={r.id}
                ref={el => { itemRefs.current[r.id] = el; }}
                onClick={() => handleTap(r.id)}
                className={`p-3 flex items-center justify-between cursor-pointer transition-all duration-300 rounded-xl mb-1 ${isSelected ? 'bg-yellow-400/10 border border-yellow-400/20' : 'hover:bg-white/5 border border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-500 ${isSelected ? 'scale-110' : ''} ${isCompleted ? 'bg-yellow-400 text-black' : 'bg-slate-800 text-slate-500'}`}>
                    <Utensils className={`w-5 h-5 ${isSelected && !isCompleted ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold tracking-tight ${isSelected ? 'text-yellow-400' : 'text-white'}`}>{r.name[lang]}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address[lang])}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate max-w-[180px] hover:text-yellow-400 transition-colors"
                      >
                        {r.address[lang]}
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <div className="bg-yellow-400/20 p-1 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-700" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
