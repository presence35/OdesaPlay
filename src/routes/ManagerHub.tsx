import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, updateDoc, serverTimestamp, increment, getDoc, addDoc,
  Timestamp, query, where, orderBy, limit
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, getUserId, ensureAnonymousAuth } from '../firebase';
import { useVenues, useActiveTournaments, useTournamentLeaderboard } from '../data/restaurants';
import { getDailyToken } from '../utils/qr';
import { translations, Language } from '../language';
import { showToast } from '../components/Toast';
import { VenueTournament } from './gamehub/types';
import {
  ShieldCheck, BarChart2, Zap, Gamepad2, Clock, Ticket,
  Calendar, X, Trophy, Medal, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('odesa_lang') as Language) || 'uk');
  const [adminTab, setAdminTab] = useState<'live' | 'settings' | 'tournament'>('live');

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
  const [tournamentGame, setTournamentGame] = useState('shooter');
  const [tournamentPrize, setTournamentPrize] = useState('');
  const [tournamentTopWinners, setTournamentTopWinners] = useState(1);
  const { entries: tournamentEntries } = useTournamentLeaderboard(activeTournament?.id || null);
  const [tick, setTick] = useState(0);
  const notifiedManagerRef = useRef<Set<string>>(new Set());

  const GAME_OPTIONS = [
    { id: 'shooter', title: { en: 'Sharpshooter', uk: 'Стрілець' } },
    { id: 'drones', title: { en: 'Drones', uk: 'Дрони' } },
    { id: 'marshrutka', title: { en: 'Marshrutka', uk: 'Маршрутка' } },
    { id: 'trivia', title: { en: 'Trivia', uk: 'Вікторина' } },
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
    showToast(`🏁 Tournament ended! ${activeTournament.prize} winners ready to claim.`);
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
      setAdminTab('live');
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
        expiresAt: Timestamp.fromMillis(now + 3600000),
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
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueTournaments', activeTournament.id),
        { expiresAt: Timestamp.fromMillis(Date.now()) },
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
    if (days > 0) return t.timeAgoDays.replace('{n}', days.toString());
    if (hours > 0) return t.timeAgoHours.replace('{n}', hours.toString());
    if (mins > 0) return t.timeAgoMins.replace('{n}', mins.toString());
    return t.timeAgoJustNow;
  };

  // Loading
  if (resolved === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <ShieldCheck className="w-12 h-12 text-yellow-400 mb-4 animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not activated
  if (!resolved || !restaurant) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center font-sans p-6">
        <div className="max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-slate-500" />
          </div>
          <h1 className="text-2xl font-black italic uppercase text-slate-300">Not Activated</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
            This manager card has not been linked to a restaurant yet. Contact OdesaPlay support.
          </p>
        </div>
      </div>
    );
  }

  const todayToken = getDailyToken(restaurantId);
  const customerQrUrl = `${window.location.origin}/play?r=${restaurantId}&t=${todayToken}`;
  const venueSessions = activeSessions.filter(s => s.venueId === restaurantId);
  const venueClaims = allClaims.filter(c => c.venueId === restaurantId);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans">
      {/* Header */}
      <header className="px-4 py-3 flex justify-between items-center fixed w-full top-0 left-0 right-0 bg-[#0a0a0c]/95 backdrop-blur-md z-50 border-b border-white/10 shadow-2xl">
        <div>
          <h1 className="text-xl font-black italic uppercase text-yellow-400">
            {restaurant.name[lang] || restaurant.name['uk'] || restaurant.name['en']}
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {t.managerHub} • {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
            className="w-8 h-8 flex items-center justify-center rounded-full text-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            {lang === 'uk' ? '🇺🇦' : '🇬🇧'}
          </button>
        </div>
      </header>

      <main className="px-5 py-5 pt-24 max-w-lg mx-auto pb-8">
        {/* Tab Switcher */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6">
          <button
            onClick={() => setAdminTab('live')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${adminTab === 'live' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
          >
            {t.live}
          </button>
          <button
            onClick={() => setAdminTab('tournament')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${adminTab === 'tournament' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
          >
            <Trophy className="w-3 h-3 inline-block -mt-0.5 mr-1" />{t.tournament}
          </button>
          <button
            onClick={() => setAdminTab('settings')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${adminTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
          >
            {t.prizes}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {adminTab === 'live' ? (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Today's Hunt QR */}
              <section className="bg-black/50 p-8 rounded-[32px] border border-white/10 text-center flex flex-col items-center">
                <h2 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-6">Today's Hunt QR</h2>
                <div className="bg-white p-4 rounded-2xl w-fit">
                  <QRCodeSVG value={customerQrUrl} size={200} />
                </div>
                <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold tracking-widest">Token: {todayToken}</p>
              </section>

              {/* Redemption Stats */}
              <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 shadow-inner">
                <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest italic">
                  <BarChart2 className="w-4 h-4" /> {t.redemptionStats}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(venueStats).map(([p, c]) => (
                    <div key={p} className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="text-3xl font-black text-yellow-400 font-mono">{c}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">{p}</div>
                    </div>
                  ))}
                  {Object.keys(venueStats).length === 0 && (
                    <div className="col-span-2 text-center text-slate-600 text-xs py-4 font-bold tracking-widest uppercase">{t.noRedemptions}</div>
                  )}
                </div>
              </div>

              {/* Live Players */}
              <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 tracking-widest italic">
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
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-widest text-center py-4">{t.noEntries}</p>
                ) : (
                  <div className="space-y-2">
                    {venueSessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-black/40 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{s.avatar || '👤'}</span>
                          <div>
                            <div className="text-sm font-bold text-white">{s.nickname}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{s.gameTitle || s.gameId}</div>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
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

              {/* Active Wins */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 tracking-widest italic">
                  <Zap className="w-4 h-4 text-yellow-400" fill="currentColor" /> {t.activeWins}
                </h3>
                {venueClaims.filter(w => !w.redeemed).map(w => (
                  <div key={w.id} className="bg-slate-900/50 p-5 rounded-[24px] border border-white/5 flex justify-between items-center shadow-xl">
                    <div className="min-w-0 mr-3">
                      <div className="text-lg font-black text-yellow-400 leading-none mb-1 uppercase italic truncate">{w.rewardType}</div>
                      <div className="text-sm text-white/80 font-bold leading-none mb-1">{'Player'}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-tighter leading-none mb-1">
                        <span className="truncate">{w.gameTitle}</span>
                        <span>·</span>
                        <span className="shrink-0">{t.level} {w.tier}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">{getTimeAgo(w.timestamp)}</div>
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
                  <div className="py-12 text-center text-slate-700 italic border-2 border-dashed border-white/5 rounded-[32px]">{t.noWinners}</div>
                )}
              </div>

              {/* Redeemed History */}
              <div className="space-y-3 mt-6">
                <h3 className="text-xs font-black uppercase text-slate-600 flex items-center gap-2 tracking-widest italic">
                  <Ticket className="w-4 h-4" /> {t.claimedPrize}
                </h3>
                {venueClaims.filter(w => w.redeemed).length === 0 ? (
                  <div className="py-8 text-center text-slate-700 italic border-2 border-dashed border-white/5 rounded-[32px]">No redeemed prizes yet</div>
                ) : (
                  venueClaims.filter(w => w.redeemed).sort((a: any, b: any) => {
                    const ta = a.redeemedAt?.toMillis ? a.redeemedAt.toMillis() : 0;
                    const tb = b.redeemedAt?.toMillis ? b.redeemedAt.toMillis() : 0;
                    return tb - ta;
                  }).map(w => (
                    <div key={w.id} className="bg-slate-900/30 p-4 rounded-[20px] border border-white/5 flex justify-between items-center opacity-60">
                      <div className="min-w-0 mr-3">
                        <div className="text-base font-black text-slate-400 leading-none mb-1 uppercase italic truncate">{w.rewardType}</div>
                        <div className="text-sm text-slate-500 font-bold leading-none mb-1">{'Player'}</div>
                        <div className="text-[9px] text-slate-600 uppercase font-black tracking-widest mt-1">{getTimeAgo(w.redeemedAt)}</div>
                      </div>
                      <div className="text-[10px] text-green-600 font-black uppercase tracking-widest shrink-0">{t.claimRedeemed}</div>
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
                  <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 shadow-inner">
                    <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest italic">
                      <Calendar className="w-4 h-4" /> {t.weekStats}
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                        <div className="text-2xl font-black text-blue-400 font-mono">{uniquePlayers}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{t.weekPlayers}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                        <div className="text-2xl font-black text-yellow-400 font-mono">{highScore}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{t.weekHighScore}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                        <div className="text-2xl font-black text-emerald-400 font-mono">{avgScore}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{t.weekAvgScore}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          ) : adminTab === 'tournament' ? (
            <motion.div
              key="tournament"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {!activeTournament || activeTournament.status === 'ended' ? (
                <>
                  <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 space-y-5 shadow-inner">
                    <h3 className="text-sm font-black uppercase text-slate-500 flex items-center gap-2 tracking-widest italic">
                      <Trophy className="w-4 h-4 text-yellow-400" /> {t.launchTournament}
                    </h3>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-2 block tracking-widest">{t.prizeLabel}</label>
                      <input
                        type="text"
                        value={tournamentPrize}
                        onChange={e => setTournamentPrize(e.target.value)}
                        placeholder={lang === 'uk' ? 'Напр. Безкоштовна кава' : 'E.g. Free coffee'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-yellow-400 shadow-inner text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-2 block tracking-widest">{t.games}</label>
                      <div className="flex gap-2 flex-wrap">
                        {GAME_OPTIONS.map(g => (
                          <button
                            key={g.id}
                            onClick={() => setTournamentGame(g.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                              tournamentGame === g.id
                                ? 'bg-yellow-400 text-black'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {g.title[lang]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 uppercase mb-2 block tracking-widest">{t.topWinners}</label>
                      <div className="flex gap-2">
                        {[1, 3, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => setTournamentTopWinners(n)}
                            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase transition-all ${
                              tournamentTopWinners === n
                                ? 'bg-yellow-400 text-black'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {n === 1 ? '🥇' : n === 3 ? '🥇🥈🥉' : '🏅 x5'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={launchTournament}
                      disabled={!tournamentPrize.trim()}
                      className="w-full bg-yellow-400 text-black py-4 rounded-xl font-black active:scale-95 transition-transform uppercase tracking-widest mt-2 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t.launch1hButton}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-yellow-400/10 to-orange-400/5 p-6 rounded-[32px] border border-yellow-400/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase text-yellow-400 tracking-widest italic">
                        🏆 {t.tournamentActive}
                      </h3>
                      <button
                        onClick={endTournamentEarly}
                        className="text-[10px] text-red-400 font-bold uppercase tracking-wider underline"
                      >
                        End early
                      </button>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-white">{activeTournament.prize}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                        {GAME_OPTIONS.find(g => g.id === activeTournament.gameId)?.title[lang] || activeTournament.gameId}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-black text-yellow-400 font-mono tabular-nums">
                        {(() => {
                          const diff = Math.max(0, activeTournament.expiresAt?.toMillis() - Date.now());
                          const m = Math.floor(diff / 60000);
                          const s = Math.floor((diff % 60000) / 1000);
                          return `${m}:${s.toString().padStart(2, '0')}`;
                        })()}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">{t.tournamentLeaderboard}</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 shadow-inner">
                    <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest italic">
                      <Medal className="w-4 h-4" /> {t.tournamentLeaderboard}
                      <span className="text-[9px] text-slate-600 ml-auto">{tournamentEntries.length} players</span>
                    </h3>
                    <div className="space-y-2">
                      {tournamentEntries.map((e, i) => {
                        const isWinning = i < activeTournament.topWinners;
                        return (
                          <div
                            key={e.id}
                            className={`flex items-center justify-between p-3 rounded-xl ${
                              isWinning ? 'bg-yellow-400/10 border border-yellow-400/20' : 'bg-black/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm w-5 text-center font-black">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-slate-600">#{i + 1}</span>}
                              </span>
                              <span className="text-lg">{e.avatar || '👤'}</span>
                              <div>
                                <div className="text-sm font-bold text-white">{e.nickname}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                  {isWinning ? (t as any).winningPrize?.replace('{prize}', activeTournament.prize) || 'Winning!' : ''}
                                </div>
                              </div>
                            </div>
                            <span className="font-black text-yellow-400 font-mono">{e.score}</span>
                          </div>
                        );
                      })}
                      {tournamentEntries.length === 0 && (
                        <div className="text-center py-12 text-slate-600 text-xs font-bold uppercase tracking-widest">{t.noEntries}</div>
                      )}
                    </div>
                  </div>

                  {activeTournament.winners && activeTournament.winners.length > 0 && (
                    <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 shadow-inner">
                      <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest italic">
                        <Ticket className="w-4 h-4 text-green-400" /> Winners
                      </h3>
                      <div className="space-y-3">
                        {activeTournament.winners.map(w => (
                          <div key={w.uid} className="bg-black/40 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{w.avatar || '👤'}</span>
                                <div>
                                  <div className="text-sm font-bold text-white">{w.nickname}</div>
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">#{w.rank} · {w.score} pts</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-black text-green-400 font-mono tracking-widest">{w.claimCode}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                  {w.claimed ? 'Redeemed ✓' : 'Pending'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
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
                  <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 shadow-inner">
                    <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest italic">
                      <Calendar className="w-4 h-4" /> {t.weekStats}
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                        <div className="text-2xl font-black text-blue-400 font-mono">{uniquePlayers}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{t.weekPlayers}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                        <div className="text-2xl font-black text-yellow-400 font-mono">{highScore}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{t.weekHighScore}</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                        <div className="text-2xl font-black text-emerald-400 font-mono">{avgScore}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">{t.weekAvgScore}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-slate-900/50 p-6 rounded-[32px] border border-white/5 space-y-4 shadow-inner">
                {([1, 2, 3] as const).map(tierNum => {
                  const key = `tier${tierNum}`;
                  const cfg = venueConfig[key] || { prize: '', threshold: 100, mode: 'score' };
                  return (
                    <div key={tierNum} className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest italic">{t.level} {tierNum}</div>
                      <div className="flex gap-3 items-end">
                        <div className="flex-[3]">
                          <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block tracking-widest">{t.prize}</label>
                          <input
                            type="text"
                            value={cfg.prize}
                            onChange={(e) => setVenueConfig({ ...venueConfig, [key]: { ...cfg, prize: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-yellow-400 shadow-inner text-sm"
                          />
                        </div>
                        <div className="w-[60px]">
                          <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block tracking-widest">{cfg.mode === 'percentile' ? t.percentileBased : t.points}</label>
                          <input
                            type="number"
                            value={cfg.threshold}
                            onChange={(e) => setVenueConfig({ ...venueConfig, [key]: { ...cfg, threshold: Number(e.target.value) } })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-yellow-400 shadow-inner text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <div className="w-[52px]">
                          <label className="text-[9px] font-bold text-slate-600 uppercase mb-1 block tracking-widest">{t.mode}</label>
                          <div className="flex rounded-lg overflow-hidden border border-slate-700">
                            <button
                              onClick={() => setVenueConfig({ ...venueConfig, [key]: { ...cfg, mode: 'score' } })}
                              className={`flex-1 py-3 text-sm font-black transition-colors ${cfg.mode === 'score' ? 'bg-yellow-400 text-black' : 'bg-slate-900 text-slate-500'}`}
                            >#</button>
                            <button
                              onClick={() => setVenueConfig({ ...venueConfig, [key]: { ...cfg, mode: 'percentile' } })}
                              className={`flex-1 py-3 text-sm font-black transition-colors ${cfg.mode === 'percentile' ? 'bg-yellow-400 text-black' : 'bg-slate-900 text-slate-500'}`}
                            >%</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={saveVenueConfig}
                  className="w-full bg-yellow-400 text-black py-4 rounded-xl font-black active:scale-95 transition-transform uppercase tracking-widest mt-4 shadow-xl"
                >
                  {t.saveConfig}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
