import { useState } from 'react';
import { Bell, Volume2, SkipBack, SkipForward, Globe, Palette, Music } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, requestFcmToken, syncNotificationSubscriptions } from '../../firebase';
import { Language } from '../../language';
import { useTheme } from '../../contexts/ThemeContext';
import LanguageThemeCard from '../../components/LanguageThemeCard';
import { showToast } from '../../components/Toast';
import { APP_ID } from '../gamehub/constants';
import { NotificationPreferences } from '../gamehub/types';
import { TrackKey } from '../../utils/audio';

interface SettingsTabProps {
  t: any;
  lang: Language;
  user: FirebaseUser | null;
  notificationPrefs: NotificationPreferences;
  isRequestingNotif: boolean;
  volume: number;
  autoPlayMusic: boolean;
  musicEnabled: boolean;
  activeTracks: TrackKey[];
  currentTrack: TrackKey | null;
  trackOrder: TrackKey[];
  onLangChange: (l: Language) => void;
  onNotificationPrefsChange: (prefs: NotificationPreferences) => void;
  onVolumeChange: (v: number) => void;
  onAutoPlayMusicChange: (v: boolean) => void;
  onMusicEnabledChange: (v: boolean) => void;
  onActiveTracksChange: (tracks: TrackKey[]) => void;
  onSkipTrack: () => void;
  onPrevTrack: () => void;
}

export default function SettingsTab({
  t, lang, user, notificationPrefs, isRequestingNotif,
  volume, autoPlayMusic, musicEnabled, activeTracks, currentTrack, trackOrder,
  onLangChange, onNotificationPrefsChange, onVolumeChange,
  onAutoPlayMusicChange, onMusicEnabledChange, onActiveTracksChange,
  onSkipTrack, onPrevTrack,
}: SettingsTabProps) {
  const { family, setFamily, mode, toggleMode } = useTheme();
  const pickTheme = (f: 'odesa' | 'ukraine') => { setFamily(f); };
  const [isRequestingNotifState, setIsRequestingNotifState] = useState(false);

  return (
    <div className="text-left space-y-6">
      {/* Language & Theme Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-left space-y-4">
          <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
            <Globe className="w-4 h-4 text-[var(--text-accent)]" /> {t.themeLanguageInverse}
          </h3>
          <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-[32px] border border-[var(--border-strong)] shadow-xl">
            <LanguageThemeCard lang={lang} onLangChange={onLangChange} t={t} variant="language" />
          </div>
        </div>
        <div className="text-left space-y-4">
          <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--text-accent)]" /> {t.themeTheme}
          </h3>
          <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-[32px] border border-[var(--border-strong)] shadow-xl">
            <LanguageThemeCard lang={lang} onLangChange={onLangChange} t={t} variant="theme" />
          </div>
        </div>
      </div>

      {/* Music Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
          <Music className="w-4 h-4 text-[var(--text-accent)]" /> {t.musicSettings}</h3>
        <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-2xl border border-[var(--border-default)] flex flex-col gap-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-[var(--text-subtle)]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--text-accent)]"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onAutoPlayMusicChange(!autoPlayMusic)}
                className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${autoPlayMusic ? 'text-[var(--text-success)]' : 'text-[var(--text-error)]'}`}
              >
                {t.autoPlayMusic} {autoPlayMusic ? 'ON' : 'OFF'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (!musicEnabled) onMusicEnabledChange(true); onPrevTrack(); }}
                  className={`p-2 rounded-full flex items-center justify-center active:scale-90 transition-transform ${musicEnabled ? 'bg-[var(--text-success)] text-[var(--text-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (!musicEnabled) onMusicEnabledChange(true); onSkipTrack(); }}
                  className={`p-2 rounded-full flex items-center justify-center active:scale-90 transition-transform ${musicEnabled ? 'bg-[var(--text-success)] text-[var(--text-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {trackOrder.map(key => (
              <button
                key={key}
                onClick={() => {
                  if (activeTracks.includes(key as TrackKey)) {
                    onActiveTracksChange(activeTracks.filter(t => t !== key));
                  } else {
                    onActiveTracksChange([...activeTracks, key as TrackKey]);
                  }
                }}
                className={`p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${activeTracks.includes(key as TrackKey) ? 'bg-[var(--btn-primary-bg)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'} ${currentTrack === key ? 'ring-2 ring-[var(--accent-bg)] ring-offset-2 ring-offset-[var(--bg-secondary)]' : ''}`}
              >
                {(t as any).music[key] || key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
           <Bell className="w-4 h-4 text-[var(--text-accent)]" /> {t.notifications}</h3>
        <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-2xl border border-[var(--border-default)] flex flex-col gap-3 shadow-xl">
          {([
            { key: 'droneAlerts', label: t.droneAlerts, desc: t.droneAlertsDesc },
            { key: 'gameReminders', label: t.gameReminders, desc: t.gameRemindersDesc },
            { key: 'venueSpecials', label: t.venueSpecials, desc: t.venueSpecialsDesc },
            { key: 'tournamentLaunches', label: t.tournamentLaunches, desc: t.tournamentLaunchesDesc },
          ] as const).map(({ key, label, desc }) => {
            const enabled = notificationPrefs[key];
            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className={`w-4 h-4 ${enabled ? 'text-[var(--text-accent)]' : 'text-[var(--text-subtle)]'}`} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">{label}</div>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-wider">{desc}</div>
                  </div>
                </div>
                <button
                  disabled={isRequestingNotif || isRequestingNotifState}
                  onClick={async () => {
                    const newPrefs = { ...notificationPrefs, [key]: !enabled };
                    if (newPrefs[key] && !newPrefs.fcmToken) {
                      setIsRequestingNotifState(true);
                      try {
                        const token = await requestFcmToken();
                        if (!token) {
                          showToast('Notification permission denied');
                          setIsRequestingNotifState(false);
                          return;
                        }
                        newPrefs.fcmToken = token;
                        newPrefs.fcmTokenUpdatedAt = Date.now();
                      } catch (e) {
                        showToast('Notification error: ' + (e instanceof Error ? e.message : 'unknown'));
                        setIsRequestingNotifState(false);
                        return;
                      }
                      setIsRequestingNotifState(false);
                    }
                    onNotificationPrefsChange(newPrefs);
                    if (user) {
                      setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', user.uid), {
                        notifications: newPrefs,
                        updatedAt: serverTimestamp()
                      }, { merge: true }).catch(console.error);
                    }
                    if (newPrefs.fcmToken && user) {
                      const TOPIC_MAP: Record<string, string> = {
                        droneAlerts: 'odesa_alerts',
                        gameReminders: 'game_reminders',
                        tournamentLaunches: 'tournament_launches',
                      };
                      const topic = TOPIC_MAP[key];
                      if (topic) {
                        syncNotificationSubscriptions(
                          newPrefs.fcmToken,
                          user.uid,
                          newPrefs[key] ? [topic] : [],
                          newPrefs[key] ? [] : [topic]
                        );
                      }
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${enabled ? 'bg-[var(--text-success)]/20 text-[var(--text-success)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'} ${isRequestingNotif || isRequestingNotifState ? 'opacity-50' : ''}`}
                >
                  {enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Version */}
      <div className="text-center pt-4">
        <span className="text-[9px] font-mono text-[var(--text-subtle)]">v1.0.2</span>
      </div>
    </div>
  );
}
