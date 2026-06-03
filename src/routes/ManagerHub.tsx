import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, updateDoc, serverTimestamp, increment, getDoc, getDocs, addDoc,
  Timestamp, query, where, orderBy, limit
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, getUserId, ensureAnonymousAuth } from '../firebase';
import { useVenues, useActiveTournaments, useTournamentLeaderboard, useTournament } from '../data/restaurants';
import { getDailyToken } from '../utils/qr';
import { translations, Language } from '../language';
import { showToast } from '../components/Toast';
import { VenueTournament } from './gamehub/types';
import {
  ShieldCheck, BarChart2, Zap, Gamepad2, Clock, Ticket,
  Calendar, X, Trophy, Medal, Users, Mail
} from 'lucide-react';


const APP_ID = 'odesa-gra-prod';

interface Claim {
  id?: string;
  code: string;
  venueId: string;
  rewardType: string;
  gameTitle: string;
  score: number;
  tier: number;
  timestamp: any;
  expiresAt: number;
  uid: string;
  nickname?: string;
  redeemed?: boolean;
  redeemedAt?: any;
}

export default function ManagerHub() {
  const [params] = useSearchParams();
  const cardCode = params.get('v') || '';

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [lang] = useState<Language>(() => (localStorage.getItem('odesa_lang') as Language) || 'uk');
  const [venueConfig, setVenueConfig] = useState<any>({
    tier1: { prize: 'Free Tea', threshold: 100, mode: 'score' },
    tier2: { prize: 'Free Fries', threshold: 125, mode: 'score' },
    tier3: { prize: '15% Discount', threshold: 150, mode: 'score' },
  });
  const [venueStats, setVenueStats] = useState<Record<string, number>>({});
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [leaderboards, setLeaderboards] = useState<any[]>([]);

  const { venues } = useVenues();
  const { tournaments: allTournaments } = useActiveTournaments();
  const activeTournament = allTournaments.find(t => t.venueId === restaurantId) || null;
  const [lastTournamentId, setLastTournamentId] = useState<string | null>(null);
  const { tournament: endedTournament } = useTournament(lastTournamentId);
  const [previousEndedTournament, setPreviousEndedTournament] = useState<VenueTournament | null>(null);
  const [tournamentGame, setTournamentGame] = useState('shooter');
  const [tournamentPrize, setTournamentPrize] = useState('');
  const [tournamentTopWinners, setTournamentTopWinners] = useState(1);
  const { entries: tournamentEntries } = useTournamentLeaderboard(activeTournament?.id || null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (activeTournament?.id) {
      setLastTournamentId(activeTournament.id);
    }
  }, [activeTournament?.id]);
  useEffect(() => {
    if (endedTournament?.resolved) {
      setPreviousEndedTournament(endedTournament);
    } else if (activeTournament?.status === 'active') {
      setPreviousEndedTournament(null);
    }
  }, [endedTournament?.resolved, activeTournament?.id]);
  const notifiedManagerRef = useRef<Set<string>>(new Set());

  const GAME_OPTIONS = [
    { id: 'shooter', title: { en: 'Odesa Sharpshooter', uk: 'Одеський Стрілець' }, icon: '/images/shooter.png' },
    { id: 'drones', title: { en: 'Russian Drones', uk: 'Російські Дрони' }, icon: '/images/drone.png' },
    { id: 'marshrutka', title: { en: 'Crazy Marshrutka', uk: 'Шалена Маршрутка' }, icon: '/images/marshrutka.png' },
    { id: 'trivia', title: { en: 'Odesa & Ukraine Trivia', uk: 'Вікторина про Одесу та Україну' }, icon: '/images/trivia.png' },
  ];

  const restaurant = venues.find(r => r.id === restaurantId);
  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('odesa_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (!activeTournament) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [!!activeTournament]);

  useEffect(() => {
    if (!activeTournament || !activeTournament.resolved) return;
    if (notifiedManagerRef.current.has(activeTournament.id)) return;
    notifiedManagerRef.current.add(activeTournament.id);
    showToast(`🏁 Tournament ended! ${activeTournament.prize} ${activeTournament.topWinners === 1 ? 'winner' : 'winners'} ready to claim.`);
  }, [activeTournament]);

  // Auth - sign in anonymously
  useEffect(() => {
    ensureAnonymousAuth().catch(console.error);
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Resolve venue card code to restaurant ID
  useEffect(() => {
    if (!authReady || !cardCode) return;

    const resolveCard = async () => {
      try {
        const cardSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueCards', cardCode));

        if (!cardSnap.exists()) {
          setResolved(false);
          return;
        }

        const cardData = cardSnap.data();
        if (!cardData.restaurantId) {
          setResolved(false);
          return;
        }

        setRestaurantId(cardData.restaurantId);
        setResolved(true);
      } catch (e) {
        console.error('Failed to resolve venue card:', e);
        setResolved(false);
      }
    };

    resolveCard();
  }, [authReady, cardCode]);

  // Database listeners (only after restaurant resolved)
  useEffect(() => {
    if (!restaurantId) return;

    const STALE_HEARTBEAT_MS = 2 * 60 * 1000;
    const STALE_STARTED_MS = 5 * 60 * 1000;

    const unsub1 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'claims'),
        where('venueId', '==', restaurantId)
      ),
      snapshot => {
        setAllClaims(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Claim)));
      }
    );

    const unsub2 = onSnapshot(
      doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueStats', restaurantId),
      docSnap => {
        if (docSnap.exists()) setVenueStats(docSnap.data().prizeCounts || {});
      }
    );

    const unsub3 = onSnapshot(
      doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueConfigs', restaurantId),
      docSnap => {
        if (docSnap.exists()) setVenueConfig(docSnap.data());
      }
    );

    const unsub4 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards'),
        where('venueId', '==', restaurantId),
        orderBy('score', 'desc'), limit(42)
      ),
      snapshot => {
        setLeaderboards(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    const unsub6 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'activeSessions'),
        where('venueId', '==', restaurantId)
      ),
      snapshot => {
        const now = Date.now();
        const sessions = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(s => {
            if (s.active === false) return false;
            if (s.lastHeartbeat) {
              return now - s.lastHeartbeat.toMillis() < STALE_HEARTBEAT_MS;
            }
            if (s.startedAt) {
              return now - s.startedAt.toMillis() < STALE_STARTED_MS;
            }
            return false;
          });
        setActiveSessions(sessions);
      }
    );

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub6();
    };
  }, [restaurantId]);

  const verifyClaim = async (claim: Claim) => {
    if (!claim.id) return;
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'claims', claim.id), {
        redeemed: true,
        redeemedAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueStats', restaurantId!),
        { prizeCounts: { [claim.rewardType]: increment(1) } },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const saveVenueConfig = async () => {
    if (!restaurantId) return;
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueConfigs', restaurantId),
        venueConfig,
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const launchTournament = async () => {
    if (!restaurantId || !tournamentPrize.trim()) return;
    const now = Date.now();
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'venueTournaments'), {
        venueId: restaurantId,
        venueName: restaurant?.name?.[lang] || restaurant?.name?.en || restaurantId,
        gameId: tournamentGame,
        prize: tournamentPrize.trim(),
        topWinners: tournamentTopWinners,
        startedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + 10800000),
        status: 'active',
        resolved: false,
      });
      setTournamentPrize('');
      showToast('Tournament launched!');
    } catch (e) {
      console.error('Failed to launch tournament', e);
    }
  };

  const endTournamentEarly = async () => {
    if (!activeTournament) return;
    const now = Date.now();
    try {
      const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards'),
        where('tournamentId', '==', activeTournament.id)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => ((b.tournamentScore ?? b.score) || 0) - ((a.tournamentScore ?? a.score) || 0));
      const top = docs.slice(0, activeTournament.topWinners);
      const winners = top.map((d, i) => ({
        uid: d.uid,
        nickname: d.nickname || 'Hero',
        avatar: d.avatar || '👤',
        score: (d.tournamentScore ?? d.score) || 0,
        rank: i + 1,
        claimCode: Math.floor(1000 + Math.random() * 9000).toString(),
        claimExpiresAt: new Date(now).setHours(23, 59, 59, 999),
        claimed: false,
      }));
      for (const w of winners) {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'claims'), {
          code: w.claimCode,
          venueId: activeTournament.venueId,
          rewardType: activeTournament.prize,
          gameTitle: activeTournament.gameId,
          score: w.score,
          tier: 0,
          timestamp: serverTimestamp(),
          expiresAt: w.claimExpiresAt,
          uid: w.uid,
          nickname: w.nickname,
          tournamentId: activeTournament.id,
        });
      }
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueTournaments', activeTournament.id),
        { expiresAt: Timestamp.fromMillis(now), resolved: true, status: 'ended', winners },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to end tournament', e);
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return t.timeAgoJustNow;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return (days === 1 ? t.timeAgoDay : t.timeAgoDays).replace('{n}', days.toString());
    if (hours > 0) return (hours === 1 ? t.timeAgoHour : t.timeAgoHours).replace('{n}', hours.toString());
    if (mins > 0) return (mins === 1 ? t.timeAgoMin : t.timeAgoMins).replace('{n}', mins.toString());
    return t.timeAgoJustNow;
  };

  // Loading
  if (resolved === null) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <ShieldCheck className="w-12 h-12 text-[var(--text-accent)] mb-4 animate-spin" />
          <p className="text-[var(--text-subtle)] font-bold uppercase tracking-widest text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not activated
  if (!resolved || !restaurant) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans p-6 flex flex-col items-center justify-center">
        <div className="max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-[var(--bg-elevated)] rounded-full mx-auto flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-[var(--text-muted)]" />
          </div>
          <h1 className="text-2xl font-black italic uppercase text-slate-300">Not Activated</h1>
          <p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-wider">
            This manager card has not been linked to a restaurant yet. Contact OdesaPlay support.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="mailto:contact@odesaplay.com.ua" className="w-12 h-12 bg-[var(--btn-primary-bg)] rounded-full flex items-center justify-center text-[var(--text-primary)] hover:scale-105 transition-transform shadow-lg">
              <Mail className="w-5 h-5" />
            </a>
            <a href="https://t.me/odesaplay_bot" target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center text-[#24A1DE] bg-white rounded-full hover:scale-105 transition-transform drop-shadow-lg">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.233-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const todayToken = getDailyToken(restaurantId);
  const customerQrUrl = `${window.location.origin}/play?r=${restaurantId}&t=${todayToken}`;
  const venueSessions = activeSessions.filter(s => s.venueId === restaurantId);
  const venueClaims = allClaims.filter(c => c.venueId === restaurantId);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-center fixed w-full top-0 left-0 right-0 bg-[var(--bg-primary)]/95 backdrop-blur-md z-50 border-b border-[var(--border-strong)] shadow-2xl">
        <h1 className="text-xl font-black italic uppercase text-[var(--text-accent)] text-center">
          {restaurant.name[lang] || restaurant.name['uk'] || restaurant.name['en']}
        </h1>
      </header>

      <main className="px-5 py-5 max-w-lg mx-auto pb-8 space-y-12">
        <div className="space-y-6">
              {/* Today's Hunt QR */}
              <section className="bg-black/50 p-8 rounded-[32px] border border-[var(--border-strong)] text-center flex flex-col items-center">
                <h2 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-widest mb-3">
                  {t.todayHunt} <span className="text-[9px] align-bottom text-[var(--text-muted)]">({todayToken})</span>
                </h2>
                <div className="bg-white p-3 rounded-2xl w-fit">
                  <QRCodeSVG value={customerQrUrl} size={200} />
                </div>
              </section>

              {/* Active Wins */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-[var(--text-muted)] flex items-center gap-2 tracking-widest italic">
                  <Zap className="w-4 h-4 text-[var(--text-accent)]" fill="currentColor" /> {t.activeWins}
                </h3>
                {venueClaims.filter(w => !w.redeemed).map(w => (
                  <div key={w.id} className="bg-[var(--bg-secondary)]/50 p-5 rounded-[24px] border border-[var(--border-default)] flex justify-between items-center shadow-xl">
                    <div className="min-w-0 mr-3">
                      <div className="text-lg font-black text-[var(--text-accent)] leading-none mb-1 uppercase italic truncate">{w.rewardType}</div>
                      <div className="text-sm text-[var(--text-primary)]/80 font-bold leading-none mb-1">{w.nickname || 'Player'}</div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)] font-bold uppercase tracking-tighter leading-none mb-1">
                        <span className="truncate">{w.gameTitle}</span>
                        <span>·</span>
                        <span className="shrink-0">{w.tier === 0 ? <Trophy className="w-4 h-4 text-[var(--text-accent)]" /> : `${t.level} ${w.tier}`}</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mt-1">{getTimeAgo(w.timestamp)}</div>
                    </div>
                    <button
                      onClick={() => verifyClaim(w)}
                      className="shrink-0 bg-white text-black px-6 py-4 rounded-2xl font-black text-base uppercase active:scale-95 hover:bg-gray-100 hover:shadow-2xl active:shadow-md transition-all shadow-xl"
                    >
                      {w.code}
                    </button>
                  </div>
                ))}
                {venueClaims.filter(w => !w.redeemed).length === 0 && (
                  <div className="py-12 text-center text-[var(--text-subtle)] italic border-2 border-dashed border-[var(--border-default)] rounded-[32px]">{t.noWinners}</div>
                )}
              </div>

              {/* Redemption Stats */}
              <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] shadow-inner">
                <h3 className="text-xs font-black uppercase text-[var(--text-muted)] mb-4 flex items-center gap-2 tracking-widest italic">
                  <BarChart2 className="w-4 h-4" /> {t.redemptionStats}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(venueStats).map(([p, c]) => (
                    <div key={p} className="bg-black/40 p-4 rounded-2xl border border-[var(--border-default)]">
                      <div className="text-3xl font-black text-[var(--text-accent)] font-mono">{c}</div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{p}</div>
                    </div>
                  ))}
                  {Object.keys(venueStats).length === 0 && (
                    <div className="col-span-2 text-center text-[var(--text-subtle)] text-xs py-4 font-bold tracking-widest uppercase">{t.noRedemptions}</div>
                  )}
                </div>
              </div>

              {/* Live Players */}
              <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase text-[var(--text-muted)] flex items-center gap-2 tracking-widest italic">
                    <Gamepad2 className="w-4 h-4 text-red-400" /> {t.livePlayers}
                  </h3>
                  {venueSessions.length > 0 && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      {venueSessions.length} now
                    </span>
                  )}
                </div>
                {venueSessions.length === 0 ? (
                  <p className="text-[var(--text-subtle)] text-xs font-bold uppercase tracking-widest text-center py-4">{t.noEntries}</p>
                ) : (
                  <div className="space-y-2">
                    {venueSessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-black/40 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{s.avatar || '👤'}</span>
                          <div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">{s.nickname}</div>
                            <div className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{s.gameTitle || s.gameId}</div>
                          </div>
                        </div>
                        <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          {s.startedAt ? (() => {
                            const diff = Date.now() - ((s.startedAt as any)?.toMillis?.() || (s.startedAt as any)?.seconds * 1000 || Date.now());
                            const m = Math.floor(diff / 60000);
                            return m < 1 ? '<1m' : `${m}m`;
                          })() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Redeemed History */}
              <div className="space-y-3 mt-6">
                <h3 className="text-xs font-black uppercase text-[var(--text-subtle)] flex items-center gap-2 tracking-widest italic">
                  <Ticket className="w-4 h-4" /> {t.claimedPrize}
                </h3>
                {venueClaims.filter(w => w.redeemed).length === 0 ? (
                  <div className="py-8 text-center text-[var(--text-subtle)] italic border-2 border-dashed border-[var(--border-default)] rounded-[32px]">{t.noRedeemedPrizes}</div>
                ) : (
                  venueClaims.filter(w => w.redeemed).sort((a: any, b: any) => {
                    const ta = a.redeemedAt?.toMillis ? a.redeemedAt.toMillis() : 0;
                    const tb = b.redeemedAt?.toMillis ? b.redeemedAt.toMillis() : 0;
                    return tb - ta;
                  }).map(w => (
                    <div key={w.id} className="bg-[var(--bg-secondary)]/30 p-4 rounded-[20px] border border-[var(--border-default)] flex justify-between items-center opacity-60">
                      <div className="min-w-0 mr-3">
                        <div className="text-base font-black text-[var(--text-subtle)] leading-none mb-1 uppercase italic truncate">{w.rewardType}</div>
                        <div className="text-sm text-[var(--text-muted)] font-bold leading-none mb-1">{w.nickname || 'Player'}</div>
                        <div className="text-[9px] text-[var(--text-subtle)] uppercase font-black tracking-widest mt-1">{getTimeAgo(w.redeemedAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-[var(--text-muted)] font-mono tracking-widest">{w.code}</div>
                        <div className="text-[10px] text-green-600 font-black uppercase tracking-widest">{t.claimRedeemed}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Week Stats */}
              {(() => {
                const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const weekScores = leaderboards.filter(l => {
                  if (!l.timestamp) return false;
                  const ts = l.timestamp.toMillis ? l.timestamp.toMillis() : (l.timestamp.seconds * 1000);
                  return ts >= oneWeekAgo;
                });
                if (weekScores.length === 0) return null;
                const uniquePlayers = new Set(weekScores.map(l => l.uid)).size;
                const highScore = Math.max(...weekScores.map(l => l.score || 0));
                const avgScore = Math.round(weekScores.reduce((sum, l) => sum + (l.score || 0), 0) / weekScores.length);
                return (
                  <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] shadow-inner">
                    <h3 className="text-xs font-black uppercase text-[var(--text-muted)] mb-4 flex items-center gap-2 tracking-widest italic">
                      <Calendar className="w-4 h-4" /> {t.weekStats}
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black/40 p-3 rounded-2xl border border-[var(--border-default)] text-center">
                        <div className="text-2xl font-black text-blue-400 font-mono">{uniquePlayers}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{t.weekPlayers}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-[var(--border-default)] text-center">
                        <div className="text-2xl font-black text-[var(--text-accent)] font-mono">{highScore}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{t.weekHighScore}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-[var(--border-default)] text-center">
                        <div className="text-2xl font-black text-emerald-400 font-mono">{avgScore}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{t.weekAvgScore}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
        </div>

        <div className="h-px bg-gradient-to-r from-blue-500 via-yellow-400 to-transparent" />

        <div className="space-y-6">
          {/* Create new tournament form */}
              {(!activeTournament || activeTournament.status === 'ended') && (
                <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] space-y-5 shadow-inner">
                  <h3 className="text-sm font-black uppercase text-[var(--text-muted)] flex items-center gap-2 tracking-widest italic">
                    <Trophy className="w-4 h-4 text-[var(--text-accent)]" /> {t.launchTournament}
                  </h3>
                  <div>
                    <label className="text-[9px] font-bold text-[var(--text-subtle)] uppercase mb-2 block tracking-widest">{t.prizeLabel}</label>
                    <input
                      type="text"
                      value={tournamentPrize}
                      onChange={e => setTournamentPrize(e.target.value)}
                      placeholder={lang === 'uk' ? 'Напр. Безкоштовна кава' : 'E.g. Free coffee'}
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] shadow-inner text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-[var(--text-subtle)] uppercase mb-2 block tracking-widest">{t.games}</label>
                    <div className="flex gap-2 flex-wrap">
                      {GAME_OPTIONS.map(g => (
                        <button
                          key={g.id}
                          onClick={() => setTournamentGame(g.id)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                            tournamentGame === g.id
                              ? 'bg-[var(--accent-bg)] text-[var(--text-on-accent)]'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-subtle)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {g.icon && <img src={g.icon} alt="" className="w-4 h-4 object-contain" />}
                          {g.title[lang]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-[var(--text-subtle)] uppercase mb-2 block tracking-widest">{t.topWinners}</label>
                    <div className="flex gap-2 justify-center">
                      {[1,2,3,4,5].map(i => {
                        const selected = i <= tournamentTopWinners;
                        return (
                          <button
                            key={i}
                            onClick={() => setTournamentTopWinners(i)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                              selected
                                ? 'bg-[var(--accent-bg)]/15 border-2 border-[var(--accent-bg)]'
                                : 'bg-[var(--bg-elevated)]/50 border-2 border-transparent hover:bg-[var(--bg-elevated)]'
                            }`}
                          >
                            <span className="relative w-[28px] h-[28px] shrink-0" style={{ filter: selected ? 'none' : 'grayscale(1) opacity(0.4)' }}>
                              <img src="/images/trophy-badge.png" alt="" className="w-full h-full object-contain" />
                              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[var(--text-primary)] translate-y-[-7px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{i}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={launchTournament}
                    disabled={!tournamentPrize.trim()}
                    className="w-full bg-[var(--accent-bg)] text-[var(--text-on-accent)] py-4 rounded-xl font-black active:scale-95 transition-transform uppercase tracking-widest mt-2 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t.launch1hButton}
                  </button>
                </div>
              )}

              {/* Ended tournament winners */}
              {(() => {
                const displayEndedTournament = previousEndedTournament ?? endedTournament;
                if (!displayEndedTournament?.winners || displayEndedTournament.winners.length === 0) return null;
                return (
                <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] shadow-inner">
                  <h3 className="text-xs font-black uppercase text-[var(--text-muted)] mb-4 flex items-center gap-2 tracking-widest italic">
                    <Ticket className="w-4 h-4 text-green-400" /> Winners
                  </h3>
                  <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/5 p-4 rounded-2xl border border-[var(--border-accent)] mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const g = GAME_OPTIONS.find(g => g.id === displayEndedTournament.gameId);
                        return g?.icon ? <img src={g.icon} alt="" className="w-6 h-6 object-contain" /> : null;
                      })()}
                      <div>
                        <div className="text-lg font-black text-[var(--text-accent)]">{displayEndedTournament.prize}</div>
                        <div className="text-[9px] text-[var(--text-subtle)] font-bold uppercase tracking-wider">
                          {(() => {
                            const g = GAME_OPTIONS.find(g => g.id === displayEndedTournament.gameId);
                            return g?.title[lang] || displayEndedTournament.gameId;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                      Top {displayEndedTournament.topWinners}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {displayEndedTournament.winners.map(w => (
                      <div key={w.uid} className="bg-black/40 p-4 rounded-2xl border border-[var(--border-default)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{w.avatar || '👤'}</span>
                            <div>
                              <div className="text-sm font-bold text-[var(--text-primary)]">{w.nickname}</div>
                              <div className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">#{w.rank} · {w.score} {w.score === 1 ? 'pt' : 'pts'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-green-400 font-mono tracking-widest">{w.claimCode}</div>
                            <div className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              {w.claimed ? t.claimRedeemed : t.claimPending}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}

              {/* Active tournament view */}
              {activeTournament && activeTournament.status === 'active' && (
                <>
                  <div className="bg-gradient-to-br from-yellow-400/10 to-orange-400/5 p-6 rounded-[32px] border border-[var(--border-accent)] space-y-4">
                    {(() => {
                      const g = GAME_OPTIONS.find(g => g.id === activeTournament.gameId);
                      return (
                        <h3 className="flex items-center gap-1.5 text-sm font-black uppercase text-[var(--text-accent)] tracking-widest italic">
                          {g?.icon && <img src={g.icon} alt="" className="w-5 h-5 object-contain" />}
                          {g?.title[lang] || activeTournament.gameId}
                        </h3>
                      );
                    })()}
                    <div className="text-2xl font-black text-[var(--text-primary)] text-center">{activeTournament.prize}</div>
                    <div className="flex justify-between items-center">
                      <div className="text-4xl font-black text-[var(--text-accent)] font-mono tabular-nums">
                        {(() => {
                          const diff = Math.max(0, activeTournament.expiresAt?.toMillis() - Date.now());
                          const m = Math.floor(diff / 60000);
                          const s = Math.floor((diff % 60000) / 1000);
                          return `${m}:${s.toString().padStart(2, '0')}`;
                        })()}
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('End tournament early? Players currently in the lead will lose their progress.')) {
                            endTournamentEarly();
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] text-red-400/60 font-bold uppercase tracking-wider hover:text-red-400 transition-colors"
                      >
                        🏁 End early
                      </button>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] shadow-inner">
                    <h3 className="text-xs font-black uppercase text-[var(--text-muted)] mb-4 flex items-center gap-2 tracking-widest italic">
                      <Medal className="w-4 h-4" /> {t.tournamentLeaderboard}
                    </h3>
                    <div className="space-y-2">
                      {Array.from({ length: Math.max(activeTournament.topWinners, tournamentEntries.length) }, (_, i) => {
                        const e = tournamentEntries[i] || null;
                        const isWinning = e && i < activeTournament.topWinners;
                        return (
                          <div
                            key={e?.id || `empty-${i}`}
                            className={`flex items-center justify-between p-3 rounded-xl ${
                              isWinning ? 'bg-[var(--accent-bg)]/10 border border-[var(--border-accent)]' : 'bg-black/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {i < 3 ? (
                                <span className="relative w-[28px] h-[28px] shrink-0" style={{ filter: i === 0 ? 'none' : i === 1 ? 'grayscale(0.4) brightness(1.1)' : 'grayscale(0.6) brightness(0.9)' }}>
                                  <img src="/images/trophy-badge.png" alt="" className="w-full h-full object-contain" />
                                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[var(--text-primary)] translate-y-[-7px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{i + 1}</span>
                                </span>
                              ) : (
                                <span className="text-sm w-[28px] text-center font-black text-[var(--text-subtle)]">#{i + 1}</span>
                              )}
                              <div>
                                <div className="text-sm font-bold text-[var(--text-primary)]">{e ? e.nickname : '—'}</div>
                              </div>
                            </div>
                            <span className="font-black text-[var(--text-accent)] font-mono">{e ? ((e.tournamentScore ?? e.score) || 0) : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
        </div>

        <div className="h-px bg-gradient-to-r from-blue-500 via-yellow-400 to-transparent" />

        <div className="space-y-4">
              {(() => {
                const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const weekScores = leaderboards.filter(l => {
                  if (!l.timestamp) return false;
                  const ts = l.timestamp.toMillis ? l.timestamp.toMillis() : (l.timestamp.seconds * 1000);
                  return ts >= oneWeekAgo;
                });
                if (weekScores.length === 0) return null;
                const uniquePlayers = new Set(weekScores.map(l => l.uid)).size;
                const highScore = Math.max(...weekScores.map(l => l.score || 0));
                const avgScore = Math.round(weekScores.reduce((sum, l) => sum + (l.score || 0), 0) / weekScores.length);
                return (
                  <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] shadow-inner">
                    <h3 className="text-xs font-black uppercase text-[var(--text-muted)] mb-4 flex items-center gap-2 tracking-widest italic">
                      <Calendar className="w-4 h-4" /> {t.weekStats}
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black/40 p-3 rounded-2xl border border-[var(--border-default)] text-center">
                        <div className="text-2xl font-black text-blue-400 font-mono">{uniquePlayers}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{t.weekPlayers}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-[var(--border-default)] text-center">
                        <div className="text-2xl font-black text-[var(--text-accent)] font-mono">{highScore}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{t.weekHighScore}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-[var(--border-default)] text-center">
                        <div className="text-2xl font-black text-emerald-400 font-mono">{avgScore}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter">{t.weekAvgScore}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] space-y-5 shadow-inner">
                  <h3 className="text-sm font-black uppercase text-[var(--text-muted)] flex items-center gap-2 tracking-widest italic">
                    <Medal className="w-4 h-4 text-[var(--text-accent)]" /> {t.standardPrizes}
                  </h3>
                {([1, 2, 3] as const).map(tierNum => {
                  const key = `tier${tierNum}`;
                  const cfg = venueConfig[key] || { prize: '', threshold: 100, mode: 'score' };
                  return (
                    <div key={tierNum} className="bg-black/30 p-4 rounded-2xl border border-[var(--border-default)] space-y-3">
                      <div className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest italic">{t.level} {tierNum}</div>
                      <div className="flex gap-3 items-end">
                        <div className="flex-[3]">
                          <label className="text-[9px] font-bold text-[var(--text-subtle)] uppercase mb-1 block tracking-widest">{t.prize}</label>
                          <input
                            type="text"
                            value={cfg.prize}
                            onChange={(e) => setVenueConfig({ ...venueConfig, [key]: { ...cfg, prize: e.target.value } })}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] shadow-inner text-sm"
                          />
                        </div>
                        <div className="w-[60px]">
                          <label className="text-[9px] font-bold text-[var(--text-subtle)] uppercase mb-1 block tracking-widest">{cfg.mode === 'percentile' ? t.percentileBased : t.points}</label>
                          <input
                            type="number"
                            value={cfg.threshold}
                            onChange={(e) => setVenueConfig({ ...venueConfig, [key]: { ...cfg, threshold: Number(e.target.value) } })}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] shadow-inner text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <div className="w-[52px]">
                          <label className="text-[9px] font-bold text-[var(--text-subtle)] uppercase mb-1 block tracking-widest">{t.mode}</label>
                          <div className="flex rounded-lg overflow-hidden border border-[var(--border-strong)]">
                            <button
                              onClick={() => setVenueConfig({ ...venueConfig, [key]: { ...cfg, mode: 'score' } })}
                              className={`flex-1 py-3 text-sm font-black transition-colors ${cfg.mode === 'score' ? 'bg-[var(--accent-bg)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}
                            >#</button>
                            <button
                              onClick={() => setVenueConfig({ ...venueConfig, [key]: { ...cfg, mode: 'percentile' } })}
                              className={`flex-1 py-3 text-sm font-black transition-colors ${cfg.mode === 'percentile' ? 'bg-[var(--accent-bg)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}
                            >%</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={saveVenueConfig}
                  className="w-full bg-[var(--accent-bg)] text-[var(--text-on-accent)] py-4 rounded-xl font-black active:scale-95 transition-transform uppercase tracking-widest mt-4 shadow-xl"
                >
                  {t.saveConfig}
                </button>
              </div>
        </div>
      </main>
    </div>
  );
}
