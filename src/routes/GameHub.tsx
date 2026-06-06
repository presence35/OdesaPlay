/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Activity, Ticket, Clock, ArrowLeft, ShieldCheck, BarChart2,
  Zap, X, Lock, Gamepad2, Map as MapIcon, User, Pencil,
  Volume2, VolumeX, Share2, Mail, Send, Music, SkipForward, SkipBack, Sun, Moon,
   Trophy, Flame, Star, Award, Target, Calendar, Bell, BellOff, AlertTriangle, Users,
   Globe, Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from "qrcode.react";
import {
  collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, updateDoc,
  serverTimestamp, increment, getDoc, getDocs, query, where, orderBy, limit, startAfter
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, auth, getUserId, ensureAnonymousAuth, requestFcmToken, onForegroundMessage, syncNotificationSubscriptions } from '../firebase';
import { translations, Language } from '../language';
import { useAudio, TrackKey } from '../utils/audio';
import { suspendAudioContext, pauseAllSounds, resumeAllSounds } from '../utils/audioContext';
import { useFullscreenOnRotate } from '../utils/fullscreen';
import { useVenues, useActiveTournaments, useTournamentLeaderboard } from '../data/restaurants';
import { showToast } from '../components/Toast';

const TreasureHuntMap = lazy(() => import('../components/TreasureHuntMap'));
const AdminPanel = lazy(() => import('../views/AdminPanel'));
const SalesTool = lazy(() => import('../views/SalesTool'));
import LoadingSpinner from '../components/LoadingSpinner';
import LanguageThemeCard from '../components/LanguageThemeCard';
import { Game, Claim, OperationType, NotificationPreferences, VenueTournament } from './gamehub/types';
import { APP_ID, BADGE_DEFINITIONS, XP_REWARDS } from './gamehub/constants';
import { handleFirestoreError, transliterate, shareScore, getTier, triggerHaptic, calculatePlayerStats, getLevel, getXpForCurrentLevel, getXpForNextLevel, getXpProgress, getWeekFilteredLeaderboards, getTimeAgo } from './gamehub/utils';
import { renderGameComponent } from './gamehub/GameRenderer';
import { useTheme } from '../contexts/ThemeContext';
const AVATARS = ["⚓", "🛸", "⚔️", "🥟", "🥨", "🐈", "🍉", "🎖️"];

function Media({ src, imgClass, textClass }: { src: string; imgClass?: string; textClass?: string }) {
  if (src.startsWith('/') || src.startsWith('.')) {
    return <img src={src} alt="" className={`object-contain ${imgClass || ''}`} />;
  }
  return <span className={textClass}>{src}</span>;
}

export default function GameHub({ initialView = 'home' }: { initialView?: 'home' | 'venues' | 'me' | 'leaderboard' | 'admin-panel' | 'admin-login' | 'sales-tool' }) {
  const [status, setStatus] = useState({ loading: true, error: null as string | null });
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const userIdRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ nickname: string, avatar: string, referredBy?: string }>(() => {
    const cached = localStorage.getItem('odesa_profile');
    return cached ? JSON.parse(cached) : { nickname: '', avatar: '⚓' };
  });
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('odesa_lang') as Language) || 'uk';
  });
  const [sfxEnabled, setSfxEnabled] = useState(() => {
    return localStorage.getItem('odesa_sfx') !== 'false';
  });
  const { family, setFamily, mode, toggleMode } = useTheme();
  const [autoPlayMusic, setAutoPlayMusic] = useState(() => {
    return localStorage.getItem('odesa_auto_play_music') !== 'false';
  });
  const pickTheme = (f: 'odesa' | 'ukraine') => { setFamily(f); };
  const isAdmin = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || /^bodi\d+$/i.test(profile.nickname ?? '');
  const { musicEnabled, setMusicEnabled, activeTracks, setActiveTracks, tracks, trackOrder, playMusic, stopMusic, skipTrack, prevTrack, currentTrack, volume, setVolume } = useAudio();
  const musicEnabledRef = useRef(musicEnabled);
  useEffect(() => { musicEnabledRef.current = musicEnabled; }, [musicEnabled]);
  const showSetup = true;
  const pickLang = (l: Language) => {
    setLang(l);
  };
  const toggleMusic = () => {
    if (activeTracks.length === 0) {
      setActiveTracks(Object.keys(tracks) as TrackKey[]);
      setMusicEnabled(true);
    } else {
      setMusicEnabled(!musicEnabled);
    }
  };

  useEffect(() => {
    localStorage.setItem('odesa_lang', lang);
    window.dispatchEvent(new CustomEvent('odesa:langchange'));
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('odesa_sfx', String(sfxEnabled));
  }, [sfxEnabled]);

  useEffect(() => {
    localStorage.setItem('odesa_auto_play_music', String(autoPlayMusic));
  }, [autoPlayMusic]);

  const [view, setView] = useState<'home' | 'venues' | 'me' | 'leaderboard' | 'admin' | 'sales-tool'>(
    initialView === 'admin-panel' ? 'admin' :
    initialView === 'sales-tool' ? 'sales-tool' :
    initialView as 'home' | 'venues' | 'me' | 'leaderboard'
  );
  const { venues: RESTAURANTS } = useVenues();
  const [venueId, setVenueId] = useState('central_cafe');
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [leaderboards, setLeaderboards] = useState<any[]>([]);
  const [userLeaderboards, setUserLeaderboards] = useState<any[]>([]);
  const [venueConfig, setVenueConfig] = useState<any>({ 
    tier1: { prize: "Free Tea", threshold: 100, mode: "score" },
    tier2: { prize: "Free Fries", threshold: 125, mode: "score" },
    tier3: { prize: "15% Discount", threshold: 150, mode: "score" }
  });
  const [activeReward, setActiveReward] = useState<Claim | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);

  const [gamePlaying, setGamePlaying] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [autoStartedMusic, setAutoStartedMusic] = useState(false);

  const [achievements, setAchievements] = useState<Record<string, { unlockedAt: any }>>({});
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'week' | 'alert'>('week');
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<string[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});
  const [recruitCount, setRecruitCount] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    droneAlerts: false, gameReminders: false, venueSpecials: false, tournamentLaunches: false
  });
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);

  // Tournament
  const { tournaments: activeTournaments } = useActiveTournaments();
  const [tournamentPlayId, setTournamentPlayId] = useState<string | null>(null);
  const { entries: tournamentEntries } = useTournamentLeaderboard(tournamentPlayId);
  const [tournamentEntryMap, setTournamentEntryMap] = useState<Record<string, any[]>>({});
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    activeTournaments.forEach(t => {
      const unsub = onSnapshot(
        query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards'), where('tournamentId', '==', t.id)),
        snap => {
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
          all.sort((a, b) => ((b.tournamentScore ?? b.score) || 0) - ((a.tournamentScore ?? a.score) || 0));
          setTournamentEntryMap(prev => ({ ...prev, [t.id]: all.slice(0, 50) }));
        },
        err => console.error('tournament leaderboard error', err)
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [activeTournaments]);
  const notifiedTournamentsRef = useRef<Set<string>>(new Set());
  const [recentPrizes, setRecentPrizes] = useState<any[]>([]);
  const [olderPrizes, setOlderPrizes] = useState<any[]>([]);
  const [hasMorePrizes, setHasMorePrizes] = useState(true);
  const [loadingMorePrizes, setLoadingMorePrizes] = useState(false);
  const lastPrizeDocRef = useRef<any>(null);
  const playerPrizes = [...recentPrizes, ...olderPrizes];
  const tournamentWins = playerPrizes.filter(p => p.tournamentId && !p.redeemed && p.expiresAt > Date.now());
  const loadMorePrizes = async () => {
    if (!lastPrizeDocRef.current || loadingMorePrizes) return;
    setLoadingMorePrizes(true);
    try {
      const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'claims'),
        where('uid', '==', user?.uid || ''),
        orderBy('timestamp', 'desc'),
        startAfter(lastPrizeDocRef.current),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const more = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOlderPrizes(prev => [...prev, ...more]);
      lastPrizeDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMorePrizes(snapshot.docs.length === 20);
    } catch (e) {
      console.warn('load more prizes error:', e);
    }
    setLoadingMorePrizes(false);
  };
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (activeTournaments.length === 0) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [activeTournaments.length]);

  useEffect(() => {
    if (!activeGame) {
      setGamePlaying(false);
      setGameActive(false);
      setShowQuitConfirm(false);
      if (autoStartedMusic) {
        stopMusic();
        setMusicEnabled(false);
        setAutoStartedMusic(false);
      }
      if ((window as any).Odesa && typeof (window as any).Odesa._triggerStop === 'function') {
        (window as any).Odesa._triggerStop();
      }
    }
  }, [activeGame, autoStartedMusic]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('odesa:game', { detail: { playing: gamePlaying } }));
  }, [gamePlaying]);

  useEffect(() => {
    if (musicEnabled && activeTracks.length > 0) {
      playMusic();
    } else {
      stopMusic();
    }
  }, [musicEnabled, activeTracks]);

  const { requestFS, isLandscape, isFullscreen, isWrongOrientation } = useFullscreenOnRotate(!!activeGame, activeGame?.orientation);

  const [isLandscapeMode, setIsLandscapeMode] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsMobileDevice(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscapeMode(window.matchMedia('(orientation: landscape)').matches);
    };

    const screenOrientation = (screen as any).orientation || (screen as any).msOrientation || null;
    if (screenOrientation?.addEventListener) {
      screenOrientation.addEventListener('change', checkOrientation);
    } else {
      window.matchMedia('(orientation: landscape)').addEventListener('change', checkOrientation);
    }
    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => {
      if (screenOrientation?.removeEventListener) {
        screenOrientation.removeEventListener('change', checkOrientation);
      } else {
        window.matchMedia('(orientation: landscape)').removeEventListener('change', checkOrientation);
      }
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Profile Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('⚓');
  const [nameError, setNameError] = useState('');

  const t = translations[lang];

  useEffect(() => {
    fetch('./games.json?t=' + Date.now())
      .then(r => r.json())
      .then((d: Game[]) => {
        const sortedGames = d.sort((a, b) => {
          if (a.comingSoon === b.comingSoon) return 0;
          return a.comingSoon ? 1 : -1;
        });
        setGamesList(sortedGames);
      })
      .catch((e) => console.error('Failed to load games', e));
      
    const params = new URLSearchParams(window.location.search);
    if (params.get('v')) setVenueId(params.get('v')!);
    if (params.get('r')) sessionStorage.setItem('odesa_referral', params.get('r')!);

    const gameFromParam = params.get('game');
    const gameFromPath = location.pathname.replace(/^\//, '');
    const validGameIds = ['drones','trivia','lighthouse','marshrutka','football','shooter'];
    const gameId = (gameFromParam && validGameIds.includes(gameFromParam))
      ? gameFromParam
      : (validGameIds.includes(gameFromPath) ? gameFromPath : null);

    if (gameId) {
      fetch('./games.json?t=' + Date.now())
        .then(r => r.json())
        .then((d: Game[]) => {
          const game = d.find(g => g.id === gameId && !g.comingSoon);
          if (game) { setActiveGame(game); requestFS(); }
        })
        .catch(console.error);
    }
    
    const unsubscribeAuth = onAuthStateChanged(auth, async u => {
      if (u) {
        await u.getIdToken(true);
        userIdRef.current = u.uid;
      } else {
        ensureAnonymousAuth().catch(console.error);
        userIdRef.current = null;
      }
      setUser(u);
      setStatus({ loading: false, error: null });
    });
    
    return () => unsubscribeAuth();
  }, []);

  // Poll alert status from server for alertId tagging on scores
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch('/api/alert-status');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        (window as any).__alertStatus = { active: data.active, lastUpdate: data.lastUpdate };
      } catch { /* server might be down, ignore */ }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Handle Profile Data
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', user?.uid), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data() as { nickname: string; avatar: string; referredBy?: string; notifications?: NotificationPreferences };
        setProfile(data);
        localStorage.setItem('odesa_profile', JSON.stringify(data));
        setEditName(data.nickname);
        setEditAvatar(data.avatar);
        if (data.notifications) setNotificationPrefs(data.notifications);
      } else {
        setEditName(`HERO_${getUserId().substring(0,8)}`);
      }
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, `profiles/${user?.uid}`);
    });
    return () => unsub();
  }, [user]);

  // Record referral immediately on first open (not waiting for first game)
  useEffect(() => {
    if (!user) return;
    const refCode = sessionStorage.getItem('odesa_referral');
    const userId = getUserId();
    if (refCode && refCode !== userId) {
      getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', userId)).then(profileSnap => {
        const profileData = profileSnap.data() as { referredBy?: string } | undefined;
        if (profileSnap.exists() && profileData?.referredBy) return;

        addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'referralEvents'), {
          referrerId: refCode,
          visitorId: userId,
          type: 'click',
          source: 'link_open',
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent.slice(0, 200)
        }).catch(console.error);
      }).catch(console.error);
    }
  }, [user]);

  // Database Listeners (Venue & Claims)
  useEffect(() => {
    if (!user) return;
    
    const unsub1 = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueConfigs', venueId), docSnap => {
      if (docSnap.exists()) setVenueConfig(docSnap.data());
    }, error => handleFirestoreError(error, OperationType.GET, `venueConfigs/${venueId}`));
    
    const unsub2 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards'),
        orderBy('score', 'desc'), limit(42)
      ),
      snapshot => {
        setLeaderboards(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      },
      error => handleFirestoreError(error, OperationType.LIST, 'leaderboards')
    );

    const unsub3u = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards'),
        where('uid', '==', user.uid)
      ),
      snapshot => {
        setUserLeaderboards(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      },
      error => handleFirestoreError(error, OperationType.LIST, 'leaderboards')
    );

    const unsub4 = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', user.uid), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAchievements(data.achievements || {});
        setStreak(data.streak || 0);
        setXp(data.xp || 0);
        setPrevScores(data.prevScores || {});
      }
    }, error => console.warn('playerProgress listener error:', error));

    const unsub5 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'profiles'),
        where('referredBy', '==', user.uid)
      ),
      snapshot => setRecruitCount(snapshot.size),
      error => console.warn('recruit count listener error:', error)
    );

    const cutoffDate = new Date(Date.now() - 7 * 86400000);
    const unsub6 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'claims'),
        where('uid', '==', user.uid),
        where('timestamp', '>=', cutoffDate),
        orderBy('timestamp', 'desc')
      ),
      snapshot => {
        const recent = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecentPrizes(recent);
        lastPrizeDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      },
      error => console.warn('player prizes listener error:', error)
    );
    
    return () => { unsub1(); unsub2(); unsub3u(); unsub4(); unsub5(); unsub6(); };
  }, [user, venueId]);

    // Sync config with iframe when settings change
    // TODO: Convert remaining alert() calls to toast notifications
    useEffect(() => {
      // Update global Odesa mock
      if ((window as any).Odesa && (window as any).Odesa._triggerConfig) {
        (window as any).Odesa._triggerConfig({ lang, sfxEnabled, musicEnabled, credits: 100 });
      }
    }, [lang, sfxEnabled, musicEnabled, activeGame]);

  useEffect(() => {
    if (activeGame || activeReward) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100dvh';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.height = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.height = 'unset';
    };
  }, [activeGame, activeReward]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'ODESAPLAY_READY') {
        if (e.source) {
          (e.source as WindowProxy).postMessage({
            type: 'ODESAPLAY_CONFIG',
            config: { lang, sfxEnabled, musicEnabled, credits: 100 }
          }, window.location.origin);
        }
        // Removed legacy iframe sync
      } else if (e.data?.type === 'ODESAPLAY_GAME_STARTED') {
        setGamePlaying(true);
        setGameActive(true);
        if (autoPlayMusic && !musicEnabled) {
          setAutoStartedMusic(true);
          setMusicEnabled(true);
        } else {
          setAutoStartedMusic(false);
        }
      } else if (e.data?.type === 'ODESAPLAY_RESTART') {
        setActiveGame(null);
      } else if (e.data?.type === 'ODESAPLAY_SCORE' || e.data?.type === 'win' || e.data?.type === 'gameOver') {
        setGamePlaying(false);
        setGameActive(false);
        setTournamentPlayId(null);
        
        if (e.data?.type === 'ODESAPLAY_SCORE') {
          const score = Number(e.data.score);
          const gameId = activeGame?.id || e.data.gameId;
          const game = gamesList.find(g => g.id === gameId);
        
        const userId = userIdRef.current || getUserId();
        if (game && score >= 0) {
          // Handle Referral on First Game Play
          const ref = sessionStorage.getItem('odesa_referral');
          if (ref && ref !== userId && !profile.referredBy) {
             const userGames = leaderboards.filter(l => l.uid === userId);
             if (userGames.length === 0) {
               setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', userId), {
                 referredBy: ref,
                 updatedAt: serverTimestamp()
               }, { merge: true }).catch(err => console.error('failed recording referral', err));
                addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'referralEvents'), {
                  referrerId: ref,
                  visitorId: userId,
                  type: 'conversion',
                  gameId: gameId,
                  venueId,
                  timestamp: serverTimestamp()
                }).catch(console.error);
             }
          }

          const recordId = `${userId}_${gameId}`;
          const currentRecord = leaderboards.find(l => l.id === recordId);
          const oldHighScore = currentRecord?.score || 0;
          
          const alertStatus = (window as any).__alertStatus;
          const alertId = alertStatus?.active ? (alertStatus?.lastUpdate || Date.now()) : null;

          const updateData: any = {
            uid: userId,
            nickname: profile.nickname || `HERO_${userId.substring(0,8)}`,
            avatar: profile.avatar || '⚓',
            gameId,
            venueId,
            playCount: increment(1)
          };

          if (alertId) updateData.alertId = alertId;

          if (tournamentPlayId) {
            updateData.tournamentId = tournamentPlayId;
            updateData.tournamentScore = score;
          }

          updateData.score = !currentRecord || score > currentRecord.score ? score : currentRecord.score;
          updateData.timestamp = serverTimestamp();

          setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards', recordId), updateData, { merge: true }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, `leaderboards/${recordId}`);
          });

          setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', userId), {
            lastPlayedAt: serverTimestamp()
          }, { merge: true }).catch(console.error);

          (async () => {
            let currentXp = xp;
            let currentStreak = streak;
            let currentAchievements = { ...achievements };
            const currentPrevScores = { ...prevScores, [gameId]: score };

            currentXp += XP_REWARDS.gamePlayed;
            if (score > oldHighScore) {
              currentXp += XP_REWARDS.newHighScore;
            }

            const today = new Date().toISOString().slice(0, 10);
            const lastPlayDate = localStorage.getItem('odesa_lastPlayDate');
            if (lastPlayDate !== today) {
              if (lastPlayDate) {
                const last = new Date(lastPlayDate);
                const now = new Date(today);
                const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
                currentStreak = diffDays === 1 ? streak + 1 : (diffDays > 1 ? 1 : streak);
              } else {
                currentStreak = 1;
              }
              localStorage.setItem('odesa_lastPlayDate', today);
              setStreak(currentStreak);
            }

            const playerStats = calculatePlayerStats(leaderboards, {} as Record<string, { nickname: string; avatar: string; referredBy?: string }>, RESTAURANTS, activeGame, currentPrevScores, currentStreak, recruitCount);
            const newUnlocks: string[] = [];
            for (const badge of BADGE_DEFINITIONS) {
              if (!currentAchievements[badge.id] && badge.condition(playerStats)) {
                newUnlocks.push(badge.id);
              }
            }
            let totalXpGain = 0;
            for (const badgeId of newUnlocks) {
              currentAchievements[badgeId] = { unlockedAt: new Date().toISOString() };
              totalXpGain += XP_REWARDS.badgeUnlocked;
            }
            currentXp += totalXpGain;

            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', userId), {
              achievements: currentAchievements,
              streak: currentStreak,
              xp: currentXp,
              prevScores: currentPrevScores,
              updatedAt: serverTimestamp()
            }, { merge: true });

            setPrevScores(currentPrevScores);
            setXp(currentXp);

            if (newUnlocks.length > 0) {
              setNewlyUnlockedBadges(newUnlocks);
              triggerHaptic([100, 50, 100, 50, 200]);
              setTimeout(() => setNewlyUnlockedBadges([]), 4000);
            }
          })();
        }

        const tier = getTier(score, gameId, venueConfig, leaderboards);
        if (tier) handleWin(game, score, tier);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    }, [gamesList, venueConfig, lang, venueId, user, sfxEnabled, musicEnabled, autoStartedMusic, leaderboards, profile, activeGame, xp, prevScores, streak, achievements, RESTAURANTS, tournamentPlayId]);

  useEffect(() => {
    if (!activeReward) return;
    const timer = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          setActiveReward(null);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeReward]);

  // Active game session tracking
  useEffect(() => {
    if (!activeGame || !user) return;
    const userId = getUserId();
    const sessionRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'activeSessions', userId);
    setDoc(sessionRef, {
      userId,
      nickname: profile.nickname || `HERO_${userId.substring(0,8)}`,
      avatar: profile.avatar || '⚓',
      gameId: activeGame.id,
      gameTitle: activeGame.title[lang],
      venueId,
      startedAt: serverTimestamp(),
      lastHeartbeat: serverTimestamp(),
      active: true,
    }).catch(console.error);

    let heartbeatCount = 0;
    const heartbeat = setInterval(() => {
      heartbeatCount++;
      if (heartbeatCount % 4 === 0) {
        updateDoc(sessionRef, { lastHeartbeat: serverTimestamp() }).catch(console.error);
      }
    }, 30000);

    const handleBeforeUnload = () => {
      clearInterval(heartbeat);
      const firestoreDbId = (db as any)._databaseId?.database || 'ai-studio-2a6d6b8a-4e14-4fbf-a82e-397e0cd65800';
      fetch(`https://firestore.googleapis.com/v1/projects/${db.app.options.projectId}/databases/${firestoreDbId}/documents/artifacts/${APP_ID}/public/data/activeSessions/${userId}`, {
        method: 'DELETE',
        keepalive: true
      }).catch(e => console.warn('[GameHub] Failed to cleanup active session on unload', e));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const triggerPause = () => {
      (window as any).Odesa?._triggerPause?.();
      stopMusic();
      pauseAllSounds();
      suspendAudioContext();
    };
    const triggerResume = () => {
      (window as any).Odesa?._triggerResume?.();
      resumeAllSounds();
      if (musicEnabledRef.current) playMusic(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateDoc(sessionRef, { active: false }).catch(console.error);
        triggerPause();
      } else if (document.visibilityState === 'visible') {
        updateDoc(sessionRef, { active: true, lastHeartbeat: serverTimestamp() }).catch(console.error);
        triggerResume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBlur = () => triggerPause();
    const handleFocus = () => triggerResume();
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      clearInterval(heartbeat);
      deleteDoc(sessionRef).catch(console.error);
    };
  }, [activeGame, user]);

  // Block swipe-back gesture while game is active
  useEffect(() => {
    if (!activeGame) return;

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && e.touches[0].clientX < 30) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, [activeGame]);

  // Foreground push notification toast
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload.notification?.title || 'OdesaPlay';
      const body = payload.notification?.body || '';
      showToast(`${title}: ${body}`);
    });
    return unsub;
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    const uid = user.uid;
    setNameError('');
    const cleanName = editName.trim().substring(0, 15);
    const lockId = transliterate(cleanName).replace(/\s/g, '_').replace(/[^a-z0-9_]/g, '');
    
    if (cleanName.length < 3) return setNameError(t.nameTooShort);

    try {
      const currentNormalized = transliterate(profile.nickname || '').replace(/\s/g, '_').replace(/[^a-z0-9_]/g, '');
      
      if (currentNormalized !== lockId) {
        try {
          const nameDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'usernames', lockId);
          const nameDoc = await getDoc(nameDocRef);
          
          if (nameDoc.exists() && nameDoc.data()?.uid !== uid) {
            setNameError(t.nameTaken);
            return;
          }
          
          await setDoc(nameDocRef, { 
            uid,
            original: cleanName 
          });
        } catch (e: any) {
          console.warn('Username reservation skipped (likely permission issue):', e);
        }
      }
      
      const updateData: any = {
        nickname: cleanName,
        avatar: editAvatar,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', uid), updateData, { merge: true });
      
      localStorage.setItem('odesa_profile', JSON.stringify({ nickname: cleanName, avatar: editAvatar }));
      setIsEditing(false);
    } catch (e: any) {
      console.error('Profile save error:', e);
      setNameError(e.message);
      handleFirestoreError(e, OperationType.WRITE, `profiles/${uid}`);
    }
  };


  const handleWin = async (game: Game | undefined, score: number, tier: number) => {
    if (!user) return;
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const prize = venueConfig[`tier${tier}`]?.prize || 'Prize';
    const claim: Claim = { 
      code, 
      venueId, 
      rewardType: prize, 
      gameTitle: game?.title[lang] || 'Game', 
      score, 
      tier, 
      timestamp: serverTimestamp(), 
      expiresAt: Date.now() + 300000,
      uid: getUserId(),
      nickname: profile.nickname || `HERO_${getUserId().substring(0,8)}`
    };
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'claims'), claim);
      setActiveReward({...claim, venue: venueId.toUpperCase().replace('_',' ')});
      setTimeLeft(300);
      setActiveGame(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'claims');
    }
  };

  // Auto-resolve tournament
  const resolveTournament = async (tourney: VenueTournament) => {
    if (tourney.resolved || tourney.status !== 'active') return;
    const now = Date.now();
    if (tourney.expiresAt?.toMillis() + 300000 > now) return;
    try {
      const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboards'),
        where('tournamentId', '==', tourney.id)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => ((b.tournamentScore ?? b.score) || 0) - ((a.tournamentScore ?? a.score) || 0));
      const top = docs.slice(0, tourney.topWinners);
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
          venueId: tourney.venueId,
          rewardType: tourney.prize,
          gameTitle: tourney.gameId,
          score: w.score,
          tier: 0,
          timestamp: serverTimestamp(),
          expiresAt: w.claimExpiresAt,
          uid: w.uid,
          nickname: w.nickname,
          tournamentId: tourney.id,
        });
      }
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueTournaments', tourney.id), {
        resolved: true,
        status: 'ended',
        winners,
      }, { merge: true });
      if (winners.some(w => w.uid === getUserId())) {
        const myWin = winners.find(w => w.uid === getUserId());
        const msg = t.tournamentWon.replace('{prize}', tourney.prize).replace('{venue}', tourney.venueName);
        showToast(`🎉 ${msg}`);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(t.tournamentWonTitle, { body: msg, icon: '/favicon.png' });
        }
      }
    } catch (e) {
      console.error('Failed to resolve tournament', e);
    }
  };

  // Auto-resolve effect: check all active tournaments
  useEffect(() => {
    if (activeTournaments.length === 0) return;
    const checkAndResolve = () => {
      for (const tourney of activeTournaments) {
        if (tourney.expiresAt?.toMillis() + 300000 <= Date.now() && !tourney.resolved) {
          resolveTournament(tourney);
        }
      }
    };
    checkAndResolve();
    const interval = setInterval(checkAndResolve, 30000);
    return () => clearInterval(interval);
  }, [activeTournaments]);

  // Tournament end notification effect
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    for (const tourney of activeTournaments) {
      if (!tourney.resolved || !tourney.winners || tourney.winners.length === 0) continue;
      if (notifiedTournamentsRef.current.has(tourney.id)) continue;
      if (tourney.winners.some(w => w.uid === userId)) {
        notifiedTournamentsRef.current.add(tourney.id);
        const msg = t.tournamentWon.replace('{prize}', tourney.prize).replace('{venue}', tourney.venueName);
        showToast(`🎉 ${msg}`);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(t.tournamentWonTitle, { body: msg, icon: '/favicon.png' });
        }
      }
    }
  }, [activeTournaments, t]);

  return (
    <div className="min-h-screen pb-32 overflow-x-hidden font-sans">
      <AnimatePresence>
        {activeReward && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-0 z-[100] bg-[var(--overlay-bg)] flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-sm bg-gradient-to-b from-[var(--accent-bg)] to-[var(--accent-bg)]/80 text-[var(--text-on-accent)] rounded-[40px] p-8 text-center shadow-2xl relative overflow-hidden">
              <Ticket className="w-16 h-16 mx-auto mb-4" fill="currentColor" />
              <h2 className="text-3xl font-black italic mb-4 uppercase leading-none">{t.notice}</h2>
              <div className="border-y-2 border-[var(--border-default)]/20 py-6 mb-6">
                <h3 className="text-3xl font-black tracking-tighter leading-none mb-1 uppercase italic">{activeReward.rewardType}</h3>
                <p className="text-[10px] font-black opacity-60 uppercase">{activeReward.venue}</p>
              </div>
              <div className="text-6xl font-mono font-black tracking-[0.2em] mb-4">{activeReward.code}</div>
              <p className="text-xs font-bold mb-8 italic flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" /> {t.expires}: {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
              </p>
              <button onClick={() => setActiveReward(null)} className="w-full py-4 bg-[var(--btn-primary-bg)] text-[var(--text-on-accent)] rounded-2xl font-black uppercase active:scale-95 transition-transform tracking-widest">{t.close}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeGame && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-0 z-[60] bg-[var(--bg-primary)] flex flex-col overflow-hidden overscroll-none"
          >
            <header className="px-3 py-1.5 flex justify-between items-center border-b border-[var(--border-strong)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-4">
                <button onClick={() => gameActive ? setShowQuitConfirm(true) : (setActiveGame(null), setTournamentPlayId(null))} className="flex items-center gap-2 text-[var(--text-error)] hover:text-[var(--text-error)] text-xs font-bold uppercase tracking-widest transition-colors">
                  <span className="text-sm">🏠</span> {t.quit}
                </button>
                {gameActive && isAdmin && (
                  <button 
                    onClick={() => {
                      if ((window as any).Odesa?._triggerStop) {
                        (window as any).Odesa._triggerStop();
                      }
                    }} 
                    className="flex items-center gap-1.5 text-[var(--text-subtle)] hover:text-[var(--text-primary)] text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    <span className="text-sm">🏁</span> End
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSfxEnabled(!sfxEnabled)} 
                  className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${sfxEnabled ? 'text-[var(--text-success)] hover:text-[var(--text-success)] bg-[var(--text-success)]/10' : 'text-[var(--text-error)] hover:text-[var(--text-error)] bg-[var(--text-error)]/10'}`}
                  title={sfxEnabled ? "SFX On" : "SFX Off"}
                >
                  {sfxEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setMusicEnabled(!musicEnabled)} 
                  className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${musicEnabled ? 'text-[var(--text-success)] hover:text-[var(--text-success)] bg-[var(--text-success)]/10' : 'text-[var(--text-error)] hover:text-[var(--text-error)] bg-[var(--text-error)]/10'}`}
                  title={musicEnabled ? "Music On" : "Music Off"}
                >
                  <Music className="w-5 h-5" />
                </button>
              </div>

            </header>
            <div className="flex-1 relative flex flex-col">
              {renderGameComponent(activeGame, lang, sfxEnabled, musicEnabled, setGamePlaying)}
              {isWrongOrientation && (
                <div className="absolute inset-0 z-50 bg-[var(--overlay-bg)] flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-6xl mb-6">🔄</div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {activeGame?.orientation === 'landscape' ? t.rotateLandscape : t.rotatePortrait}
                  </h2>
                  <p className="text-lg text-[var(--text-primary)]/70 max-w-xs">
                    {activeGame?.orientation === 'landscape' ? t.rotateLandscapeDesc : t.rotatePortraitDesc}
                  </p>
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuitConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[var(--overlay-bg)] flex items-center justify-center p-6"
            onClick={() => setShowQuitConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-3xl p-8 text-center shadow-2xl"
            >
              <h3 className="text-xl font-black italic uppercase text-[var(--text-primary)] mb-2">{t.quitConfirm}</h3>
              <p className="text-sm text-[var(--text-subtle)] mb-8">{t.quitConfirmMsg}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowQuitConfirm(false)} 
                  className="flex-1 py-4 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-2xl font-black uppercase active:scale-95 transition-transform tracking-widest"
                >
                  {t.cancel}
                </button>
                  <button 
                    onClick={() => { setShowQuitConfirm(false); setActiveGame(null); setTournamentPlayId(null); }} 
                    className="flex-1 py-4 bg-[var(--text-error)] text-[var(--text-primary)] rounded-2xl font-black uppercase active:scale-95 transition-transform tracking-widest"
                  >
                    {t.yesQuit}
                  </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!activeGame && isMobileDevice && isLandscapeMode && (
        <div className="fixed inset-0 z-[55] bg-[var(--overlay-bg)] flex flex-col items-center justify-center p-8 text-center">
          <div className="text-6xl mb-6">🔄</div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{t.rotatePortrait}</h2>
          <p className="text-lg text-[var(--text-primary)]/70 max-w-xs">{t.rotatePortraitDesc}</p>
        </div>
      )}

      <header className="px-3 py-1.5 flex justify-between items-center gap-2 fixed w-full top-0 left-0 right-0 bg-[var(--bg-primary)]/95 backdrop-blur-md z-50 border-b border-[var(--border-strong)] shadow-2xl">
        <div onClick={() => setView('home')} className="cursor-pointer shrink-0">
          <img src="/images/logo_full.png" alt="OdesaPlay" className="h-8 w-auto" />
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => setFamily('odesa')} className="group p-0 border-0 bg-transparent cursor-pointer">
            <img src="/images/odesa.png" className={`w-6 h-6 transition-all rounded-sm ${family === 'odesa' ? 'ring-1 ring-[var(--btn-primary-bg)]' : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'}`} alt="Odesa" />
          </button>
          <button onClick={() => setFamily('ukraine')} className="group p-0 border-0 bg-transparent cursor-pointer">
            <img src="/images/ukraine.png" className={`w-6 h-6 transition-all rounded-sm ${family === 'ukraine' ? 'ring-1 ring-[var(--btn-primary-bg)]' : 'opacity-50 grayscale hover:opacity-80 hover:grayscale-0'}`} alt="Ukraine" />
          </button>
          <button onClick={toggleMode} className={`w-6 h-6 rounded flex items-center justify-center transition-all ${mode === 'dark' ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-50 hover:opacity-80'}`}>
            {mode === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleMusic}
            className={`p-1.5 rounded-full transition-colors relative ${musicEnabled ? 'text-[var(--text-success)] hover:text-[var(--text-success)] bg-[var(--text-success)]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)]'}`}
            title="Toggle Music"
          >
            <Music className="w-5 h-5" />
            {!musicEnabled && (
              <svg className="absolute inset-0 w-full h-full text-[var(--text-error)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className={`px-5 py-5 pt-14 sm:pt-14 ${view === 'admin' ? 'max-w-full' : 'max-w-lg mx-auto'}`}>
        {view === 'home' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {showSetup && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-left space-y-4">
                    <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[var(--text-accent)]" /> {t.themeLanguageInverse}
                    </h3>
                    <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-[32px] border border-[var(--border-strong)] shadow-xl">
                      <LanguageThemeCard lang={lang} onLangChange={pickLang} t={t} variant="language" />
                    </div>
                  </div>
                  <div className="text-left space-y-4">
                    <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                      <Palette className="w-4 h-4 text-[var(--text-accent)]" /> {t.themeTheme}
                    </h3>
                    <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-[32px] border border-[var(--border-strong)] shadow-xl">
                      <LanguageThemeCard lang={lang} onLangChange={pickLang} t={t} variant="theme" />
                    </div>
                  </div>
                </div>
                <p className="text-[9px] text-[var(--text-subtle)] text-center font-bold tracking-wide">
                  {t.themeProfileNote}
                </p>
              </div>
            )}
            {/* Active Tournaments — one-liner linking to venues tab */}
            {activeTournaments.length > 0 && (
              <button onClick={() => setView('venues')} className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[var(--btn-primary-bg)]/20 to-[var(--accent-bg)]/20 p-4 rounded-[24px] border border-[var(--accent-border)] cursor-pointer active:scale-[0.97] transition-transform shadow-lg shadow-[var(--accent-bg)]/20">
                <Trophy className="w-6 h-6 text-[var(--text-accent)] shrink-0" />
                <span className="font-black text-[var(--text-accent)]">{activeTournaments.length} {activeTournaments.length === 1 ? t.liveTournament : t.liveTournaments}...</span>
              </button>
            )}

            {/* You Won section */}
            {tournamentWins.length > 0 && (
              <section>
                <h2 className="text-lg font-black uppercase italic tracking-tight mb-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[var(--text-accent)]" />
                  {t.notice}
                </h2>
                <div className="space-y-3">
                  {tournamentWins.map(p => {
                    const venue = RESTAURANTS.find((v: any) => v.id === p.venueId);
                    const venueName = venue ? venue.name[lang] : (typeof p.venueId === 'string' ? p.venueId.toUpperCase().replace('_', ' ') : '');
                    const prizeGame = gamesList.find(g => g.id === p.gameTitle || g.title[lang] === p.gameTitle);
                    return (
                      <div
                        key={p.id}
                        onClick={() => setActiveReward(p)}
                        className="bg-gradient-to-br from-[var(--btn-primary-bg)]/20 to-[var(--accent-bg)]/10 p-5 rounded-[24px] border border-[var(--accent-border)] cursor-pointer active:scale-95 transition-transform shadow-lg shadow-[var(--accent-bg)]/20"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏆</span>
                            <div>
                              <div className="text-[10px] font-black text-[var(--text-success)] uppercase tracking-widest">{t.tournament}</div>
                              <div className="text-lg font-black text-[var(--text-primary)] leading-tight">{p.rewardType}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-[var(--text-success)] font-mono tracking-widest">{p.code}</div>
                            <div className="text-[8px] text-[var(--text-success)]/70 font-black uppercase tracking-wider">{t.expiresInHours.replace('{h}', `${Math.max(1, Math.ceil((p.expiresAt - Date.now()) / 3600000))}`)}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-subtle)]">
                            {prizeGame?.icon && <img src={prizeGame.icon} alt="" className="w-4 h-4 object-contain" />}
                            {prizeGame?.title[lang] || p.gameTitle}
                            <span className="text-[var(--text-subtle)]">·</span>
                            {venueName}
                          </div>
                          <div className="text-[9px] text-[var(--text-accent)] font-black uppercase tracking-wider">
                            {p.score} {p.score === 1 ? 'pt' : 'pts'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {['arcade', 'history', 'odesa', 'venues'].map(cat => (
              <section key={cat} className={gamesList.filter(g => g.cat === cat).length === 0 ? 'hidden' : ''}>
                <div className="grid grid-cols-1 gap-4 pb-4">
                  {gamesList.filter(g => g.cat === cat).map(game => (
                    <div 
                      key={game.id} 
                      onClick={() => { if (game.comingSoon) return; if ((game as any).isRoute) { setView('venues'); return; } const mt = activeTournaments.find(t => t.gameId === game.id && t.venueId === venueId); if (mt) setTournamentPlayId(mt.id); setActiveGame(game); requestFS(); }} 
                      className={`game-card w-full aspect-[4/5] rounded-[32px] relative overflow-hidden shadow-2xl border-none flex items-center justify-center bg-transparent ${game.comingSoon ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer transition-transform active:scale-95'}`}
                    >
                      <img 
                        src={(game as any).isRoute ? undefined : `/games/${game.id}/poster.png`}
                        alt={game.title[lang]} 
                        className={`absolute inset-0 w-full h-full object-contain ${(game as any).isRoute ? 'hidden' : ''}`}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                      {(game as any).isRoute && (
                        <div className="text-center p-4 space-y-3">
                          <MapIcon className="w-10 h-10 text-[var(--text-accent)] mx-auto" />
                          <h2 className="text-xl font-black italic uppercase text-[var(--text-primary)] leading-tight">{game.title[lang]}</h2>
                        </div>
                      )}
                      {game.comingSoon && (
                        <>
                          <div className="absolute inset-0 bg-[var(--overlay-bg)] z-10 backdrop-blur-[2px]"></div>
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[var(--accent-bg)] text-[var(--text-on-accent)] px-4 py-1.5 font-black italic uppercase text-sm tracking-widest shadow-2xl border-2 border-[var(--border-default)] rounded-xl w-3/5 text-center truncate">
                            {(t as any).comingSoonBanner}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Gradient hint for scroll */}
            <div className="h-24 -mt-8 bg-gradient-to-t from-[var(--bg-primary)] to-transparent relative z-10" />
            
            <div className="flex flex-col gap-4 pt-4 pb-8 -mt-16 relative z-20">
              <div className="bg-[var(--bg-primary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] flex flex-col items-center justify-center gap-5 text-center shadow-lg relative overflow-hidden">
                 <div className="p-3 bg-white rounded-3xl drop-shadow-xl inline-block w-fit">
                   <QRCodeSVG value={`http://odesaplay.com.ua?r=${profile.nickname ? profile.nickname.toLowerCase().replace(/\s/g, '_') : `hero_${getUserId().substring(0, 8)}`}`} size={140} level="M" />
                 </div>
                 
                 <span className="text-[10px] text-[var(--text-muted)] select-all font-mono opacity-80 truncate max-w-full">http://odesaplay.com.ua?r={profile.nickname ? profile.nickname.toLowerCase().replace(/\s/g, '_') : `hero_${getUserId().substring(0, 8)}`}</span>
                 
                 <div 
                    className="flex flex-row items-center justify-between px-4 py-2 bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-strong)] rounded-full cursor-pointer transition-all active:scale-95 group"
onClick={() => {
                         const refCode = profile.nickname ? profile.nickname.toLowerCase().replace(/\s/g, '_') : `hero_${getUserId().substring(0, 8)}`;
                         const url = `http://odesaplay.com.ua?r=${refCode}`;
                         const shareText = t.shareMessage.replace('{url}', url);
                        if (navigator.share) {
                          navigator.share({ title: 'OdesaPlay', text: shareText, url }).catch(() => {
                             navigator.clipboard.writeText(shareText).then(() => showToast('Copied!')).catch(console.error);
                          });
                        } else {
                          navigator.clipboard.writeText(shareText).then(() => showToast('Copied to clipboard!')).catch(console.error);
                        }
                    }}
                 >
                   <p className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)]">{t.scanToPlay}</p>
                   <div className="p-2 bg-[var(--accent-bg)] text-[var(--text-on-accent)] rounded-full ml-4 drop-shadow-md group-hover:scale-105 transition-transform">
                     <Share2 className="w-4 h-4" />
                   </div>
                 </div>
              </div>
              <div className="bg-[var(--bg-primary)]/50 p-6 rounded-[32px] border border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg">
                <p className="text-xs font-bold leading-normal tracking-tight text-[var(--text-subtle)] flex-1">{t.contactText}</p>
                <div className="flex gap-3 shrink-0">
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
          </motion.div>
        )}

        {view === 'leaderboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase italic tracking-tight">{t.leaderboard}</h2>
              <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl">
                <button 
                  onClick={() => setLeaderboardFilter('week')} 
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${leaderboardFilter === 'week' ? 'bg-[var(--btn-primary-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
                >{t.lastWeek}</button>
                <button 
                  onClick={() => setLeaderboardFilter('all')} 
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${leaderboardFilter === 'all' ? 'bg-[var(--btn-primary-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
                >{t.allTime}</button>
                <button 
                  onClick={() => setLeaderboardFilter('alert')} 
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1 ${leaderboardFilter === 'alert' ? 'bg-[var(--text-error)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
                ><AlertTriangle className="w-3 h-3" /> ALERT</button>
              </div>
            </div>
            {gamesList.map(game => {
              const filteredLb = leaderboardFilter === 'week' ? getWeekFilteredLeaderboards(leaderboards) : leaderboardFilter === 'alert' ? leaderboards.filter(l => l.alertId) : leaderboards;
              const records = filteredLb.filter(l => l.gameId === game.id).sort((a, b) => b.score - a.score).slice(0, 21);
              if (records.length === 0) return null;
              const userRecord = records.find(r => r.uid === getUserId());
              const userRank = userRecord ? records.findIndex(r => r.uid === getUserId()) + 1 : null;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={game.id} className="bg-[var(--bg-secondary)]/50 p-5 rounded-3xl border border-[var(--border-default)] space-y-4 shadow-xl">
                  <h3 className="text-sm font-black text-[var(--text-muted)] uppercase italic tracking-widest flex items-center gap-2">{game.icon && <img src={game.icon} alt="" className="w-5 h-5 object-contain" />}{game.title[lang]}</h3>
                  <div className="space-y-3">
                    {records.map((r, i) => {
                      const isUser = r.uid === getUserId();
                      return (
                        <div 
                          key={r.id} 
                          className={`flex items-center justify-between ${isUser ? 'bg-[var(--accent-bg)]/10 -mx-2 px-2 py-1 rounded-xl border border-[var(--border-accent)]' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg w-6 text-center">
                              {i < 3 ? medals[i] : <span className="text-xs font-black text-[var(--text-subtle)]">{i + 1}</span>}
                            </span>
                            <Media src={r.avatar || '⚓'} imgClass="w-5 h-5" textClass="text-lg" />
                            <div className="flex flex-col">
                              <span className="font-bold uppercase text-sm tracking-widest leading-none">{r.nickname}</span>
                              <span className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest leading-none mt-1">{getTimeAgo(r.timestamp, lang)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-[var(--text-accent)] italic font-mono">{r.score}</span>
                          </div>
                        </div>
                      );
                    })}
                    {userRank && userRank > 21 && (
                      <div className="border-t border-[var(--border-strong)] pt-3 mt-3">
                        {(() => {
                          const allGameRecords = filteredLb.filter(l => l.gameId === game.id).sort((a, b) => b.score - a.score);
                          const actualRank = allGameRecords.findIndex(r => r.uid === getUserId()) + 1;
                          const record = allGameRecords.find(r => r.uid === getUserId());
                          if (!record) return null;
                          return (
                            <div className="flex items-center justify-between bg-[var(--accent-bg)]/10 px-3 py-2 rounded-xl border border-[var(--border-accent)]">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-[var(--text-muted)] w-6 text-center">#{actualRank}</span>
                                <Media src={record.avatar || '⚓'} imgClass="w-5 h-5" textClass="text-lg" />
                                <div className="flex flex-col">
                                  <span className="font-bold uppercase text-sm tracking-widest leading-none text-[var(--text-accent)]">{t.you}</span>
                                </div>
                              </div>
                              <span className="font-black text-[var(--text-accent)] italic font-mono">{record.score}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {leaderboards.length === 0 && <div className="text-center py-20 text-[var(--text-muted)] italic">{t.noEntries}</div>}
          </motion.div>
        )}

        {view === 'venues' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
             {/* Active Tournaments */}
             {activeTournaments.length > 0 && (
               <section>
                 <h2 className="text-lg font-black uppercase italic tracking-tight mb-3 flex items-center gap-2">
                   <Trophy className="w-5 h-5 text-[var(--text-accent)]" />
                   <span className="text-[9px] font-black bg-[var(--text-success)]/15 text-[var(--text-success)] px-2 py-0.5 rounded-full tracking-widest whitespace-nowrap">{activeTournaments.length} {activeTournaments.length === 1 ? t.liveTournament : t.liveTournaments}</span>
                   {t.activeTournaments}
                 </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {activeTournaments.map(tourney => {
                      const tourneyGame = gamesList.find(g => g.id === tourney.gameId);
                      const entries = tournamentEntryMap[tourney.id] || [];
                      const playerEntry = entries.find(e => e.uid === getUserId());
                      const playerRank = playerEntry ? entries.findIndex(e => e.uid === getUserId()) + 1 : null;
                      const isWinning = playerRank !== null && playerRank <= tourney.topWinners;
                      return (
                        <div
                          key={tourney.id}
                          onClick={() => {
                            if (tourneyGame) {
                              setTournamentPlayId(tourney.id);
                              setActiveGame(tourneyGame);
                              requestFS();
                            }
                          }}
                          className="bg-gradient-to-br from-[var(--btn-primary-bg)]/10 to-[var(--accent-bg)]/5 p-4 rounded-[24px] border border-[var(--accent-border)] cursor-pointer active:scale-95 transition-transform"
                        >
                          <div className="text-[10px] font-black text-[var(--text-accent)] text-center uppercase tracking-widest mb-1 line-clamp-2 h-8 overflow-hidden leading-[14px]">{tourney.venueName}</div>
                          <div className="text-base font-black text-[var(--text-primary)] leading-tight mb-2">{tourney.prize}</div>
                          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-bold mb-2">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{entries.length}</span>
                            {playerRank !== null && (
                              <span className={`text-[11px] font-black ${isWinning ? 'text-[var(--text-accent)]' : 'text-[var(--text-muted)]'}`}>
                                #{playerRank}{isWinning ? ' 🏆' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                            <div className="flex items-center gap-1">
                              {tourneyGame?.icon && <img src={tourneyGame.icon} alt="" className="w-3.5 h-3.5 object-contain" />}
                              <span className="text-[9px] font-bold text-[var(--text-subtle)]">{tourneyGame?.title[lang] || tourney.gameId}</span>
                            </div>
                            <span className="text-[11px] text-[var(--text-accent)] font-bold font-mono tabular-nums">
                              {(() => {
                                const diff = Math.max(0, tourney.expiresAt?.toMillis() - Date.now());
                                const totalMins = Math.floor(diff / 60000);
                                return `${Math.floor(totalMins / 60)}:${(totalMins % 60).toString().padStart(2, '0')}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}

             <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2">{t.cityHunt}</h2>
             <Suspense fallback={<LoadingSpinner icon={MapIcon} />}><TreasureHuntMap venues={RESTAURANTS} pendingCheckIn={location.state?.pendingCheckIn} lang={lang} /></Suspense>
          </motion.div>
        )}
        
        {view === 'admin' && (
          <div className="max-w-6xl mx-auto">
            <Suspense fallback={null}><AdminPanel lang={lang} /></Suspense>
          </div>
        )}

        {view === 'sales-tool' && (
          <Suspense fallback={null}><SalesTool lang={lang} /></Suspense>
        )}

        {view === 'me' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase italic tracking-tight">{t.profile}</h2>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <button onClick={() => setView('admin')} className="p-2 bg-[var(--bg-secondary)] rounded-full text-[var(--text-accent)]">
                      <Activity className="w-5 h-5" />
                    </button>
                    <button onClick={() => setView('sales-tool')} className="p-2 bg-[var(--bg-secondary)] rounded-full text-[var(--text-accent)]">
                      <BarChart2 className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-[var(--bg-secondary)] rounded-full text-[var(--text-accent)]">
                  {isEditing ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {!isEditing ? (
              <div className="text-center py-6 space-y-6">
                <div 
                  className="w-24 h-24 bg-gradient-to-tr from-[var(--btn-primary-bg)] to-[var(--accent-bg)] rounded-full mx-auto p-1 shadow-2xl cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setIsEditing(true)}
                >
                  <div className="w-full h-full bg-[var(--bg-primary)] rounded-full flex items-center justify-center"><Media src={profile.avatar} imgClass="w-10 h-10" textClass="text-4xl" /></div>
                </div>
                <div 
                  className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                  onClick={() => setIsEditing(true)}
                >
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-accent)]">{profile.nickname || `HERO_${getUserId().substring(0,8)}`}</h3>
                  <p className="text-[var(--text-muted)] font-bold text-[10px] uppercase tracking-widest mt-1">{t.rank}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-left">
                  <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
                    <div className="text-lg font-black text-[var(--text-accent)] italic">
                      {userLeaderboards.reduce((acc, curr) => acc + (curr.playCount || 1), 0)}
                    </div>
                    <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none mt-1.5">{t.gamesPlayed}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
                    <div className="text-lg font-black text-[var(--text-accent)] italic">
                      {(() => { try { return Object.keys(JSON.parse(localStorage.getItem('odesa_checkins') || '{}')).length; } catch { return 0; }})()}
                    </div>
                    <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none mt-1.5">{t.cityHunt}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
                    <div className="text-lg font-black text-[var(--text-success)] italic">
                      {recruitCount}
                    </div>
                    <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none mt-1.5">{t.recruits}</div>
                  </div>
                </div>

                {/* Streak & XP Row */}
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl flex items-center gap-3">
                    <Flame className={`w-6 h-6 ${streak > 0 ? 'text-[var(--text-accent)]' : 'text-[var(--text-subtle)]'}`} />
                    <div>
                      <div className="text-lg font-black text-[var(--text-accent)] italic">{streak} {streak === 1 ? t.day : t.days}</div>
                      <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none">{t.streak}</div>
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-lg font-black text-[var(--text-accent)] italic">{t.playerLevel} {getLevel(xp)}</div>
                      <div className="text-[8px] font-black text-[var(--text-muted)] uppercase">{xp} XP</div>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[var(--accent-bg)] to-[var(--accent-bg)] rounded-full transition-all duration-500" 
                        style={{ width: `${getXpProgress(xp)}%` }}
                      />
                    </div>
                    <div className="text-[8px] font-black text-[var(--text-muted)] tracking-tighter leading-none mt-1">{getXpForNextLevel(xp) - xp} {t.xpToNext}</div>
                  </div>
                </div>



                {/* My Prizes */}
                  <div className="mt-8 text-left space-y-4">
                    <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-[var(--text-accent)]" /> {t.myPrizes}{playerPrizes.length > 0 && <span className="text-[var(--text-muted)] ml-1">({playerPrizes.filter(p => !p.redeemed && p.expiresAt > Date.now()).length}/{playerPrizes.length})</span>}
                    </h3>
                    {playerPrizes.length === 0 ? (
                      <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.noPrizes}</div>
                    ) : (
                    <>
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                      {[...playerPrizes].sort((a: any, b: any) => {
                        const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
                        const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
                        return tb - ta;
                      }).map(p => {
                        const expired = p.expiresAt < Date.now();
                        const redeemed = p.redeemed;
                        const venue = RESTAURANTS.find((v: any) => v.id === p.venueId);
                        const venueName = venue ? venue.name[lang] : (typeof p.venueId === 'string' ? p.venueId.toUpperCase().replace('_', ' ') : '');
                        const prizeGame = gamesList.find(g => g.id === p.gameTitle || g.title[lang] === p.gameTitle);
                        return (
                          <div key={p.id} className="bg-[var(--bg-secondary)]/50 p-4 rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                            <div>
                              <div className="text-sm font-black text-[var(--text-accent)]">{p.rewardType}</div>
                              <div className="text-[10px] text-[var(--text-subtle)] font-bold mt-0.5 flex items-center gap-1.5">{prizeGame?.icon && <img src={prizeGame.icon} alt="" className="w-4 h-4 object-contain" />}{p.gameTitle} • {p.score} {p.score === 1 ? 'pt' : 'pts'}</div>
                              <div className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-0.5">{venueName}</div>
                            </div>
                            <div className="text-right">
                              {p.code && !redeemed && (
                                <div className="text-lg font-black text-[var(--text-success)] font-mono tracking-widest">{p.code}</div>
                              )}
                              <div className={`text-[9px] font-black uppercase tracking-widest ${
                                redeemed ? 'text-[var(--text-muted)]' : expired ? 'text-[var(--text-error)]' : 'text-[var(--text-success)]'
                              }`}>
                                {redeemed ? t.claimRedeemed : expired ? `${t.claimExpired} ${getTimeAgo(p.timestamp, lang)}` : p.tournamentId ? t.expiresInHours.replace('{h}', `${Math.max(1, Math.ceil((p.expiresAt - Date.now()) / 3600000))}`) : t.claimCode.replace('{code}', p.code || '')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {hasMorePrizes && (
                      <button
                        onClick={loadMorePrizes}
                        disabled={loadingMorePrizes}
                        className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors bg-[var(--bg-secondary)]/30 rounded-xl border border-[var(--border-default)] disabled:opacity-50"
                      >
                        {loadingMorePrizes ? 'Loading...' : t.loadAll}
                      </button>
                    )}
                    </>
                    )}
                  </div>

                {/* Profile High Scores */}
                <div className="mt-8 text-left space-y-4">
                  <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[var(--text-accent)]" /> {t.highScores}</h3>
                  {userLeaderboards.map(r => {
                    const game = gamesList.find(g => g.id === r.gameId);
                    if (!game) return null;
                    const allGameRecords = leaderboards.filter(l => l.gameId === game.id).sort((a, b) => b.score - a.score);
                    const rank = allGameRecords.findIndex(l => l.uid === getUserId()) + 1;
                    const totalPlayers = allGameRecords.length;
                    
                    return (
                      <div key={r.id} className="bg-[var(--bg-secondary)]/50 p-4 rounded-2xl border border-[var(--border-default)] flex justify-between items-center shadow-xl">
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-xs tracking-widest flex items-center gap-1.5 text-[var(--text-primary)]">{game.icon && <img src={game.icon} alt="" className="w-4 h-4 object-contain" />}{game.title[lang]}</span>
                          <span className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mt-1">
                            {getTimeAgo(r.timestamp, lang)} • {r.playCount || 1} PLAYS • RANK: {rank}/{totalPlayers}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-[var(--text-accent)] italic font-mono">{r.score}</span>
                          <button onClick={() => shareScore(game, r.score, lang, profile)} className="text-[var(--text-subtle)] hover:text-[var(--text-accent)] transition-colors p-1" title={t.share}>
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {userLeaderboards.length === 0 && (
                     <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.noEntries}</div>
                  )}
                </div>

                {/* Badges */}
                <div className="mt-8 text-left space-y-4">
                  <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                    <Award className="w-4 h-4 text-[var(--text-accent)]" /> {t.badges}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_DEFINITIONS.map(badge => {
                      const unlocked = !!achievements[badge.id];
                      const justUnlocked = newlyUnlockedBadges.includes(badge.id);
                      return (
                        <div 
                          key={badge.id} 
                          onClick={() => setSelectedBadge(badge.id)}
                          className={`rounded-lg flex items-center justify-center p-1 transition-all cursor-pointer ${
                            unlocked 
                              ? justUnlocked 
                                ? 'bg-[var(--accent-bg)]/20 border-2 border-[var(--accent-bg)] animate-pulse' 
                                : selectedBadge === badge.id ? 'bg-[var(--bg-elevated)]/80 border-2 border-[var(--border-strong)]' : 'bg-[var(--bg-elevated)]/80 border-2 border-[var(--border-strong)]' 
                              : 'bg-[var(--bg-secondary)]/30 border-2 border-[var(--border-default)] opacity-40'
                          }`}
                        >
                          <Media src={badge.icon} imgClass={`w-4 h-4 ${unlocked ? '' : 'grayscale'}`} textClass={`text-base ${unlocked ? '' : 'grayscale'}`} />
                          {justUnlocked && (
                            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--accent-bg)] rounded-full animate-ping" />
                          )}
                          {unlocked && !justUnlocked && (
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--text-success)] rounded-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(achievements).length === 0 && (
                    <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.noBadges}</div>
                  )}
                  {(() => {
                    if (!selectedBadge) {
                      return (
                        <div className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)] p-5 text-center">
                          <span className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-widest">Tap a badge to learn more</span>
                        </div>
                      );
                    }
                    const badgeDef = BADGE_DEFINITIONS.find(b => b.id === selectedBadge);
                    if (!badgeDef) return null;
                    const unlocked = !!achievements[selectedBadge];
                    const badgeLabel = (t as any).badge[selectedBadge];
                    return (
                      <div className="w-full bg-[var(--bg-elevated)]/80 rounded-2xl border border-[var(--border-strong)] p-4 text-left space-y-2">
                        <div className="flex items-center gap-2">
                          <Media src={badgeDef.icon} imgClass="w-4 h-4" textClass="text-base" />
                          <span className="text-sm font-black uppercase text-[var(--text-primary)] tracking-wider">{badgeLabel?.name || selectedBadge}</span>
                        </div>
                        <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{badgeLabel?.desc || ''}</p>
                        {unlocked ? (
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                            {(() => { const d = Math.floor((Date.now() - new Date(achievements[selectedBadge].unlockedAt).getTime()) / 86400000); return `Awarded ${d} ${d === 1 ? 'day' : 'days'} ago`; })()}
                          </p>
                        ) : (
                          <p className="text-[10px] text-[var(--text-subtle)] uppercase tracking-wider font-bold">Not yet unlocked</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Notification Settings */}
                <div className="mt-8 text-left space-y-4">
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
                            disabled={isRequestingNotif}
                            onClick={async () => {
                              const newPrefs = { ...notificationPrefs, [key]: !enabled };
                              if (newPrefs[key] && !newPrefs.fcmToken) {
                                setIsRequestingNotif(true);
                                try {
                                  const token = await requestFcmToken();
                                  if (!token) {
                                    showToast('Notification permission denied');
                                    setIsRequestingNotif(false);
                                    return;
                                  }
                                  newPrefs.fcmToken = token;
                                  newPrefs.fcmTokenUpdatedAt = Date.now();
                                } catch (e) {
                                  showToast('Notification error: ' + (e instanceof Error ? e.message : 'unknown'));
                                  setIsRequestingNotif(false);
                                  return;
                                }
                                setIsRequestingNotif(false);
                              }
                              setNotificationPrefs(newPrefs);
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
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${enabled ? 'bg-[var(--text-success)]/20 text-[var(--text-success)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'} ${isRequestingNotif ? 'opacity-50' : ''}`}
                          >
                            {enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Music Settings */}
                <div className="mt-8 text-left space-y-4">
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
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-20 h-1.5 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--text-accent)]"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAutoPlayMusic(!autoPlayMusic)}
                          className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${autoPlayMusic ? 'text-[var(--text-success)]' : 'text-[var(--text-error)]'}`}
                        >
                          {t.autoPlayMusic} {autoPlayMusic ? 'ON' : 'OFF'}
                        </button>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { if (!musicEnabled) setMusicEnabled(true); prevTrack(); }} 
                            className={`p-2 rounded-full flex items-center justify-center active:scale-90 transition-transform ${musicEnabled ? 'bg-[var(--text-success)] text-[var(--text-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}
                          >
                            <SkipBack className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { if (!musicEnabled) setMusicEnabled(true); skipTrack(); }} 
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
                              setActiveTracks(activeTracks.filter(t => t !== key));
                            } else {
                              setActiveTracks([...activeTracks, key as TrackKey]);
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

                {/* Language & Theme Settings */}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="text-left space-y-4">
                    <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[var(--text-accent)]" /> {t.themeLanguageInverse}
                    </h3>
                    <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-[32px] border border-[var(--border-strong)] shadow-xl">
                      <LanguageThemeCard lang={lang} onLangChange={pickLang} t={t} variant="language" />
                    </div>
                  </div>
                  <div className="text-left space-y-4">
                    <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
                      <Palette className="w-4 h-4 text-[var(--text-accent)]" /> {t.themeTheme}
                    </h3>
                    <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-[32px] border border-[var(--border-strong)] shadow-xl">
                      <LanguageThemeCard lang={lang} onLangChange={pickLang} t={t} variant="theme" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--bg-secondary)]/50 p-6 rounded-3xl border border-[var(--border-default)] space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-3 tracking-widest">{t.chooseHero}</label>
                  <div className="grid grid-cols-4 gap-4">
                    {AVATARS.map(a => (
                      <div key={a} onClick={() => setEditAvatar(a)} className={`h-12 flex items-center justify-center rounded-2xl cursor-pointer transition-transform hover:scale-110 ${editAvatar === a ? 'border-2 border-[var(--accent-bg)] bg-[var(--accent-bg)]/10' : 'bg-[var(--bg-elevated)]/40'}`}>
                        <Media src={a} imgClass="w-7 h-7" textClass="text-2xl" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-2 tracking-widest">{t.cityNickname}</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-4 text-[var(--text-primary)] font-black italic outline-none focus:border-[var(--accent-bg)]" placeholder={t.nicknamePlaceholder} maxLength={15} />
                  {nameError && <p className="text-[var(--text-error)] text-[10px] mt-2 font-bold uppercase">{nameError}</p>}
                </div>
                <button onClick={saveProfile} className="w-full bg-[var(--btn-primary-bg)] text-[var(--text-primary)] py-4 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-[var(--accent-bg)]/30">{t.saveProfile}</button>
              </motion.div>
            )}
          </motion.div>
        )}

      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/90 to-transparent z-50 pointer-events-none">
        <nav className="max-w-[300px] mx-auto w-full pointer-events-auto">
          <div className="bg-[var(--bg-primary)]/80 backdrop-blur-xl border-t-4 border-[var(--accent-bg)] rounded-full p-2 flex justify-between shadow-2xl">
            <button onClick={() => setView('home')} className={`flex-1 py-2 flex flex-col items-center justify-center rounded-full transition-all ${view === 'home' ? 'bg-[var(--text-primary)]/10 text-[var(--text-accent)]' : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'}`}>
              <Gamepad2 className="w-6 h-6 backface-hidden" />
            </button>
            <button onClick={() => setView('leaderboard')} className={`flex-1 py-2 flex flex-col items-center justify-center rounded-full transition-all ${view === 'leaderboard' ? 'bg-[var(--text-primary)]/10 text-[var(--text-accent)]' : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'}`}>
              <BarChart2 className="w-6 h-6 backface-hidden" />
            </button>
            <button onClick={() => setView('venues')} className={`flex-1 py-2 flex flex-col items-center justify-center rounded-full transition-all ${view === 'venues' ? 'bg-[var(--text-primary)]/10 text-[var(--text-accent)]' : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'}`}>
              <MapIcon className="w-6 h-6 backface-hidden" />
            </button>
            <button onClick={() => setView('me')} className={`flex-1 py-2 flex flex-col items-center justify-center rounded-full transition-all ${view === 'me' ? 'bg-[var(--text-primary)]/10 text-[var(--text-accent)]' : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'}`}>
              <User className="w-6 h-6 backface-hidden" />
            </button>
          </div>
        </nav>
      </div>

    </div>
  );
}
