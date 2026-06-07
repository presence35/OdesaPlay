import { useState, useEffect } from 'react';
import { translations, Language } from '../language';
import { type Restaurant } from '../data/restaurants';
import { MapPin, Navigation, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Position {
  lat: number;
  lng: number;
}

interface Props {
  venues: Restaurant[];
  lang: Language;
  onCheckin: (venueId: string) => void;
  onDismiss: () => void;
}

export default function CheckInPrompt({ venues, lang, onCheckin, onDismiss }: Props) {
  const t = translations[lang];
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gpsRequested, setGpsRequested] = useState(false);

  const sorted = [...venues].filter(v => !v.disabled).sort((a, b) => {
    if (!position) return 0;
    return getDistance(position.lat, position.lng, a.lat, a.lng) - getDistance(position.lat, position.lng, b.lat, b.lng);
  });

  const requestGps = () => {
    if (gpsRequested) return;
    setGpsRequested(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setGpsError(true);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSelect = (id: string) => {
    if (!gpsRequested) requestGps();
    setSelectedId(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--bg-primary)] rounded-[32px] border border-[var(--border-strong)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-lg font-black uppercase italic tracking-tight text-[var(--text-primary)]">
              {t.checkinPromptTitle}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-1">
              {t.checkinPromptSub}
            </p>
          </div>
          <button onClick={onDismiss} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors">
            <X className="w-5 h-5 text-[var(--text-subtle)]" />
          </button>
        </div>

        <div className="max-h-[340px] overflow-y-auto px-2 pb-2 space-y-1">
          {sorted.map((v) => {
            const isSelected = selectedId === v.id;
            const dist = position ? getDistance(position.lat, position.lng, v.lat, v.lng) : null;
            return (
              <div
                key={v.id}
                onClick={() => handleSelect(v.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--accent-bg)]/10 border border-[var(--accent-border)]'
                    : 'hover:bg-[var(--bg-secondary)]/50 border border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-[var(--accent-bg)] text-[var(--text-on-accent)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[var(--text-primary)] truncate">{v.name[lang]}</div>
                  <div className="text-[9px] text-[var(--text-muted)] font-medium truncate mt-0.5">{v.address[lang]}</div>
                </div>
                <div className="text-right shrink-0">
                  {dist !== null && (
                    <div className="text-[10px] font-bold text-[var(--text-accent)]">
                      {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                    </div>
                  )}
                  {gpsError && !position && (
                    <div className="text-[9px] text-[var(--text-subtle)] font-medium">{t.checkinGpsOff}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 pt-2 border-t border-[var(--border-default)] space-y-2">
          {gpsRequested && !position && !gpsError && (
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
              <Navigation className="w-3 h-3 animate-pulse" />
              {t.checkinLocating}
            </div>
          )}
          <button
            onClick={() => { if (selectedId) onCheckin(selectedId); }}
            disabled={!selectedId}
            className="w-full py-3.5 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.checkinConfirm}
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t.checkinSkip}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
