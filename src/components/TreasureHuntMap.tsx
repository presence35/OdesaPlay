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
    <div className="bg-[var(--bg-secondary)] rounded-[32px] p-6 shadow-2xl overflow-hidden border border-[var(--border-strong)] relative mt-4">
      {/* Demo Mode Badge */}
      {demoMode && (
        <div className="absolute top-4 right-4 outline outline-red-500 text-red-500 bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-red-500/50 z-10">
          {t.demoMode}
        </div>
      )}

      <div className="bg-[var(--bg-overlay)] rounded-2xl border border-[var(--border-default)] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
          <h3 className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-wider">{t.restaurants}</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 divide-y divide-[var(--border-default)]" ref={listRef}>
          {RESTAURANTS.map((r) => {
            const isCompleted = completeList.includes(r.id);
            const isSelected = selectedId === r.id;
            return (
              <div 
                key={r.id}
                ref={el => { itemRefs.current[r.id] = el; }}
                onClick={() => handleTap(r.id)}
                className={`p-3 flex items-center justify-between cursor-pointer transition-all duration-300 rounded-xl mb-1 ${isSelected ? 'bg-[var(--accent-subtle-bg)] border border-[var(--border-accent)]' : 'hover:bg-[var(--nav-active-bg)] border border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-500 ${isSelected ? 'scale-110' : ''} ${isCompleted ? 'bg-[var(--accent-bg)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                    <Utensils className={`w-5 h-5 ${isSelected && !isCompleted ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold tracking-tight ${isSelected ? 'text-[var(--text-accent)]' : 'text-[var(--text-primary)]'}`}>{r.name[lang]}</div>
                    <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address[lang])}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate max-w-[180px] hover:text-[var(--text-accent)] transition-colors"
                      >
                        {r.address[lang]}
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <div className="bg-[var(--accent-subtle-bg)] p-1 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-[var(--text-accent)]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--border-strong)]" />
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
