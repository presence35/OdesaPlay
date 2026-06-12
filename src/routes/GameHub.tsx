/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity, Ticket, Clock, ArrowLeft, ShieldCheck, BarChart2,
  Zap, Lock, Gamepad2, Map as MapIcon, User,
  Volume2, VolumeX, Share2, Mail, Send, Music,
  Trophy, Star, Target, Calendar, AlertTriangle, Users,
  Globe, Palette, Settings, ShoppingCart
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

import TreasureHuntMap from '../components/TreasureHuntMap';
import SalesTool from '../views/SalesTool';
import AdminPanel from '../views/AdminPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import CheckInPrompt from '../components/CheckInPrompt';
import { EASTER_EGG_DEFINITIONS, useEggFindings } from './gamehub/easterEggs';
import LanguageThemeCard from '../components/LanguageThemeCard';
import { Game, Claim, OperationType, NotificationPreferences, VenueTournament, InventoryItem } from './gamehub/types';
import { APP_ID, BADGE_DEFINITIONS, STAR_REWARDS, SHOP_ITEMS } from './gamehub/constants';
import { handleFirestoreError, transliterate, getTier, getLevel, triggerHaptic, calculatePlayerStats, getWeekFilteredLeaderboards, getTimeAgo, calculateSellValue } from './gamehub/utils';
import { renderGameComponent } from './gamehub/GameRenderer';
import ProfileTab from './profile/ProfileTab';
import ShopTab from './profile/ShopTab';
import PrizesTab from './profile/PrizesTab';
import SettingsTab from './profile/SettingsTab';

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
  const [autoPlayMusic, setAutoPlayMusic] = useState(() => {
    return localStorage.getItem('odesa_auto_play_music') !== 'false';
  });
  const isAdmin = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || /^bodi\d+$/i.test(profile.nickname ?? '');
  const { musicEnabled, setMusicEnabled, activeTracks, setActiveTracks, tracks, trackOrder, playMusic, stopMusic, skipTrack, prevTrack, currentTrack, volume, setVolume, markAdvanceIfNearEnd, consumeAdvanceFlag } = useAudio();
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
  const [profileView, setProfileView] = useState<'profile' | 'prizes' | 'shop' | 'settings'>('profile');
  const [tutorialsDismissed, setTutorialsDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('odesa_tutorials') || '[]')); } catch { return new Set<string>(); }
  });
  const dismissTutorial = (key: string) => {
    const next = new Set(tutorialsDismissed);
    next.add(key);
    setTutorialsDismissed(next);
    localStorage.setItem('odesa_tutorials', JSON.stringify([...next]));
  };
  const tutorialMessages: Record<string, string> = {
    home: 'Tap any game card to play!',
    me: 'Tap your avatar or nickname to edit your profile!',
    leaderboard: 'See how you rank against other players!',
    venues: 'Check in at venues to earn rewards!',
  };
  const showTutorial = tutorialMessages[view] && !tutorialsDismissed.has(view);
    const { venues: RESTAURANTS } = useVenues();
  const [venueId, setVenueId] = useState('');
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
  // TEMP DISABLED: const lastPromptedPlaysRef = useRef(0);
  const checkinPromptTriggeredRef = useRef(false);

  const [achievements, setAchievements] = useState<Record<string, { unlockedAt: any }>>({});
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [inventory, setInventory] = useState<Record<string, Record<string, InventoryItem>>>({});
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'week' | 'alert'>('week');
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<string[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});
  const [recruitCount, setRecruitCount] = useState(0);
  const [starHolders, setStarHolders] = useState<any[]>([]);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const { findings: eggFindings } = useEggFindings();
  const [gameNotifications, setGameNotifications] = useState<Set<string>>(new Set());
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('odesa_onboarding_done');
  });
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

  const { requestFS, isWrongOrientation } = useFullscreenOnRotate(!!activeGame, activeGame?.orientation);

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
    
    const unsub1 = venueId ? onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'venueConfigs', venueId), docSnap => {
      if (docSnap.exists()) setVenueConfig(docSnap.data());
    }, error => handleFirestoreError(error, OperationType.GET, `venueConfigs/${venueId}`)) : () => {};
    
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

    const unsubInventory = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'inventory', user.uid), docSnap => {
      if (docSnap.exists()) {
        setInventory(docSnap.data() as Record<string, Record<string, InventoryItem>>);
      }
    }, error => console.warn('inventory listener error:', error));

    const unsub5 = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'profiles'),
        where('referredBy', '==', user.uid)
      ),
      snapshot => setRecruitCount(snapshot.size),
      error => console.warn('recruit count listener error:', error)
    );

    const cutoffDate = new Date(Date.now() - 7 * 86400000);
    const unsubNotif = onSnapshot(
      query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'gameNotifications'), where('uid', '==', user.uid)),
      snap => setGameNotifications(new Set(snap.docs.map(d => d.data().gameId))),
      () => {}
    );

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

    const unsubStars = onSnapshot(
      query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress'),
        orderBy('xp', 'desc'), limit(20)
      ),
      snapshot => {
        const holders = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
        const uids = holders.map(h => h.uid).filter(Boolean);
        if (uids.length > 0) {
          Promise.all(uids.map(uid =>
            getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'profiles', uid))
              .then(d => ({ uid, data: d.exists() ? d.data() : null }))
          )).then(results => {
            const pmap: Record<string, any> = {};
            results.forEach(r => { if (r.data) pmap[r.uid] = r.data; });
            setStarHolders(holders.map(h => ({
              ...h,
              nickname: pmap[h.uid]?.nickname || `HERO_${h.uid.substring(0, 8)}`,
              avatar: pmap[h.uid]?.avatar || '⚓'
            })));
          }).catch(err => console.warn('star holder profiles error:', err));
        } else {
          setStarHolders([]);
        }
      },
      error => handleFirestoreError(error, OperationType.LIST, 'playerProgress')
    );
    
    return () => { unsub1(); unsub2(); unsub3u(); unsub4(); unsub5(); unsubNotif(); unsub6(); unsubStars(); };
  }, [user, venueId]);

  // TEMP DISABLED: auto check-in prompt logic
  // const totalPlays = useMemo(() =>
  //   userLeaderboards.reduce((acc, r) => acc + (r.playCount || 0), 0),
  //   [userLeaderboards]
  // );
  // TEMP DISABLED: auto check-in prompt (re-enable by uncommenting below)
  // useEffect(() => {
  //   if (showCheckInPrompt) return;
  //   if (activeGame) return;
  //   if (checkinPromptTriggeredRef.current) return;
  //   let stored: string | null;
  //   try { stored = localStorage.getItem('odesa_checkins'); } catch { stored = null; }
  //   if (stored && stored !== '{}') return;
  //   if (typeof totalPlays !== 'number' || isNaN(totalPlays) || totalPlays < 3) return;
  //   let lp = lastPromptedPlaysRef.current;
  //   if (lp === 0) {
  //     try { lp = parseInt(localStorage.getItem('odesa_checkin_prompted_at') || '0', 10) || 0; } catch { lp = 0; }
  //   }
  //   if (typeof lp !== 'number' || isNaN(lp) || totalPlays - lp < 3) return;
  //   lastPromptedPlaysRef.current = totalPlays;
  //   checkinPromptTriggeredRef.current = true;
  //   try { localStorage.setItem('odesa_checkin_prompted_at', String(totalPlays)); } catch {}
  //   if (!('permissions' in navigator)) { setShowCheckInPrompt(true); return; }
  //   navigator.permissions.query({ name: 'geolocation' }).then(perm => {
  //     if (perm.state !== 'denied') setShowCheckInPrompt(true);
  //   }).catch(() => setShowCheckInPrompt(true));
  // }, [totalPlays, showCheckInPrompt, activeGame]);

  const handleCheckIn = async (venueId: string) => {
    if (!user) return;
    const uid = user.uid;
    const date = new Date().toISOString().slice(0, 10);
    const docId = `${uid}_${venueId}_${date}`;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'checkins', docId), {
      userId: uid, restaurantId: venueId, mode: 'casual', timestamp: serverTimestamp(), gameScores: []
    }).catch(console.error);
    const stored = JSON.parse(localStorage.getItem('odesa_checkins') || '{}');
    stored[venueId] = { ts: new Date().toISOString(), mode: 'casual' };
    localStorage.setItem('odesa_checkins', JSON.stringify(stored));
    const newXp = xp + STAR_REWARDS.checkin;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', uid), {
      achievements, streak, xp: newXp, prevScores, updatedAt: serverTimestamp()
    }, { merge: true }).catch(console.error);
    setXp(newXp);
    setShowCheckInPrompt(false);
    checkinPromptTriggeredRef.current = false;
    showToast(t.checkinXpEarned);
  };

  const [splashItemVisibility, setSplashItemVisibility] = useState<Record<string, Record<string, boolean>>>(() => {
    try { return JSON.parse(localStorage.getItem('odesa_splash_item_vis') || '{}'); }
    catch { return {}; }
  });

  const toggleSplashItem = (gameId: string, itemId: string) => {
    setSplashItemVisibility(prev => {
      const gameVis = prev[gameId] || {};
      const current = gameVis[itemId] !== false;
      const next = { ...prev, [gameId]: { ...gameVis, [itemId]: !current } };
      localStorage.setItem('odesa_splash_item_vis', JSON.stringify(next));
      return next;
    });
  };

  const ownedSplashItems = useMemo(() => {
    if (!activeGame) return [];
    return SHOP_ITEMS
      .filter(item => item.gameIds.includes(activeGame.id))
      .filter(item => item.cost === 0 || item.gameIds.some(gid => inventory[gid]?.[item.id]))
      .sort((a, b) => a.name.en.localeCompare(b.name.en));
  }, [activeGame, inventory]);

    // Sync config with iframe when settings change
    // TODO: Convert remaining alert() calls to toast notifications
    useEffect(() => {
      // Update global Odesa mock
      if ((window as any).Odesa && (window as any).Odesa._triggerConfig) {
        const items = (activeGame ? ownedSplashItems : []).map((item: any) => ({
          id: item.id,
          icon: item.icon,
          name: item.name[lang as 'en' | 'uk'],
          visible: activeGame ? (splashItemVisibility[activeGame.id]?.[item.id] !== false) : true
        }));
        (window as any).Odesa._triggerConfig({ lang, sfxEnabled, musicEnabled, peace: !((window as any).__alertStatus?.active ?? false), stars: xp, inventory, isAdmin, splashItems: items });
      }
    }, [lang, sfxEnabled, musicEnabled, activeGame, inventory, xp, ownedSplashItems, splashItemVisibility]);

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
          const items = (activeGame ? ownedSplashItems : []).map((item: any) => ({
            id: item.id,
            icon: item.icon,
            name: item.name[lang as 'en' | 'uk'],
            visible: activeGame ? (splashItemVisibility[activeGame.id]?.[item.id] !== false) : true
          }));
          (e.source as WindowProxy).postMessage({
            type: 'ODESAPLAY_CONFIG',
            config: { lang, sfxEnabled, musicEnabled, stars: xp, inventory, isAdmin, splashItems: items }
          }, window.location.origin);
        }
        // Removed legacy iframe sync
      } else if (e.data?.type === 'ODESAPLAY_GAME_STARTED') {
        setGamePlaying(true);
        setGameActive(true);
        if (consumeAdvanceFlag()) skipTrack();
        if (autoPlayMusic && !musicEnabled) {
          setAutoStartedMusic(true);
          setMusicEnabled(true);
        } else {
          setAutoStartedMusic(false);
        }
      } else if (e.data?.type === 'ODESAPLAY_RESTART') {
        setActiveGame(null);
      } else if (e.data?.type === 'ODESAPLAY_EGG_FOUND') {
        handleEggFound(e.data.eggId);
      } else if (e.data?.type === 'ODESAPLAY_TOGGLE_SPLASH_ITEM') {
        if (activeGame) toggleSplashItem(activeGame.id, e.data.itemId);
      } else if (e.data?.type === 'ODESAPLAY_SCORE' || e.data?.type === 'win' || e.data?.type === 'gameOver') {
        setGamePlaying(false);
        setGameActive(false);
        setTournamentPlayId(null);
        markAdvanceIfNearEnd();
        
        if (e.data?.type === 'ODESAPLAY_SCORE') {
          const score = Number(e.data.score);
          if (score <= 0) return;
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

            currentXp += STAR_REWARDS.gamePlayed;
            if (score > oldHighScore) {
              currentXp += STAR_REWARDS.newHighScore;
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
              totalXpGain += STAR_REWARDS.badgeUnlocked;
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
          console.warn('Username reservation skipped:', e);
          setNameError(t.connectionError || 'Connection issue. Try again.');
          return;
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


    const toggleNotify = async (gameId: string) => {
    if (!user) return;
    const uid = user.uid;
    const docId = `${uid}_${gameId}`;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'gameNotifications', docId);
    if (gameNotifications.has(gameId)) {
      await deleteDoc(ref).catch(console.error);
    } else {
      await setDoc(ref, { uid, gameId, createdAt: serverTimestamp() }).catch(console.error);
    }
  };

  const handleEggFound = async (eggId: string) => {
    const eggDef = EASTER_EGG_DEFINITIONS.find(e => e.id === eggId);
    if (!eggDef) return;
    const uid = getUserId();
    const docId = `${uid}_${eggId}`;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'easterEggFindings', docId), {
        uid, eggId, foundAt: serverTimestamp()
      });
      showToast(`🥚 ${eggDef.name[lang]} ${t.eggFoundToast}`);
      triggerHaptic([100, 50, 100]);
    } catch {}
  };

  const handleShopBuy = async (item: { id: string; gameIds: string[]; cost: number }) => {
    if (!user) return;
    if (xp < item.cost) return;
    const newStars = xp - item.cost;
    const inv = { ...inventory };
    for (const gid of item.gameIds) {
      if (!inv[gid]) inv[gid] = {};
      inv[gid][item.id] = { purchasedAt: serverTimestamp(), paidCost: item.cost };
    }
    const uid = user.uid;
    await Promise.all([
      setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', uid), { xp: newStars, updatedAt: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'inventory', uid), inv, { merge: true }),
    ]).catch(e => { showToast('Purchase failed'); console.error(e); });
    setXp(newStars);
    setInventory(inv);
  };

  const handleSellItem = async (item: { id: string; gameIds: string[]; cost: number }) => {
    if (!user) return;
    const inv = { ...inventory };
    let refund = 0;
    for (const gid of item.gameIds) {
      const entry = inv[gid]?.[item.id];
      if (!entry) continue;
      // Handle legacy boolean inventory (pre-sell feature)
      const paidCost = entry === true ? item.cost : entry.paidCost;
      const purchasedAt = entry === true ? null : entry.purchasedAt;
      const result = calculateSellValue(paidCost, purchasedAt);
      if (!result.refund || result.refund <= 0) continue;
      refund = result.refund;
      delete inv[gid][item.id];
      if (Object.keys(inv[gid]).length === 0) delete inv[gid];
    }
    if (!refund || refund <= 0) return;
    const newStars = xp + refund;
    if (!Number.isFinite(newStars)) return;
    const uid = user.uid;
    try {
      await Promise.all([
        setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', uid), { xp: newStars, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'inventory', uid), inv, { merge: true }),
      ]);
    } catch (e) {
      console.error(e);
      return;
    }
    setXp(newStars);
    setInventory(inv);
  };

  const handleWin = async (game: Game | undefined, score: number, tier: number) => {
    if (!user) return;
    if (!venueId) return;
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
    <div className="min-h-screen pb-32 overflow-x-hidden font-sans select-none">
      <AnimatePresence>
        {activeReward && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-0 z-[100] bg-[var(--overlay-bg)] flex flex-col items-center justify-center p-6 select-none"
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
            className="fixed inset-0 z-[60] bg-[var(--bg-primary)] flex flex-col overflow-hidden overscroll-none select-none"
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
              {renderGameComponent(activeGame, lang, sfxEnabled, musicEnabled, setGamePlaying, isAdmin)}
              {isWrongOrientation && (
                <div className="absolute inset-0 z-50 bg-[var(--overlay-bg)] flex flex-col items-center justify-center p-8 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="text-6xl mb-6"
                  >🔄</motion.div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    {activeGame?.orientation === 'landscape' ? t.rotateLandscape : t.rotatePortrait}
                  </h2>
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

      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.5 }}
              className="absolute inset-0 bg-black/40"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[40px] p-8 text-center shadow-2xl"
            >
              <img src="/images/logo_full.png" alt="OdesaPlay" className="h-14 w-auto mx-auto mb-6" />
              <h2 className="text-2xl font-black italic uppercase tracking-tight text-[var(--text-primary)] mb-4">
                {(t as any).onboardingTitle}
              </h2>
              <p className="text-sm font-bold text-[var(--text-muted)] leading-relaxed mb-8">
                {(t as any).onboardingPlay}
              </p>
              <button
                onClick={() => {
                  setShowOnboarding(false);
                  localStorage.setItem('odesa_onboarding_done', 'true');
                }}
                className="w-full py-4 bg-[var(--accent-bg)] text-[var(--text-on-accent)] rounded-2xl font-black uppercase active:scale-95 transition-transform tracking-widest text-lg"
              >
                {(t as any).onboardingCTA}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="px-3 py-1.5 flex justify-between items-center gap-2 fixed w-full top-0 left-0 right-0 bg-[var(--bg-primary)]/95 backdrop-blur-md z-50 border-b border-[var(--border-strong)] shadow-2xl">
        <div onClick={() => setView('home')} className="cursor-pointer shrink-0">
          <img src="/images/logo_full.png" alt="OdesaPlay" className="h-8 w-auto" />
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
            <AnimatePresence>
              {showCheckInPrompt && (
                <CheckInPrompt venues={RESTAURANTS} lang={lang} onCheckin={handleCheckIn} onDismiss={() => { setShowCheckInPrompt(false); checkinPromptTriggeredRef.current = false; }} />
              )}
            </AnimatePresence>
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
                    const venueName = venue ? (venue.name[lang] || venue.name['uk'] || venue.name['en']) : (typeof p.venueId === 'string' ? p.venueId.toUpperCase().replace('_', ' ') : '');
                    const prizeGame = gamesList.find(g => g.id === p.gameTitle || g.title.en === p.gameTitle || g.title.uk === p.gameTitle);
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
                          <div className="absolute inset-0 bg-black/40 z-10 backdrop-blur-[2px]"></div>
                          <div className="absolute bottom-0 inset-x-0 z-20 p-3 flex flex-col gap-2">
                            <div className="bg-[var(--accent-bg)] text-[var(--text-on-accent)] px-4 py-1.5 font-black italic uppercase text-sm tracking-widest shadow-2xl border-2 border-black rounded-xl text-center truncate">
                              {(t as any).comingSoonBanner}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleNotify(game.id); }}
                              className={`w-full py-2 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg border transition-all active:scale-95 ${
                                gameNotifications.has(game.id)
                                  ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                  : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                              }`}
                            >
                              {gameNotifications.has(game.id) ? '🔔 ' + (t as any).notifyOn : '🔔 ' + (t as any).notifyOff}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {showSetup && (
              <div className="space-y-4 pt-2">
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

            {isAdmin && (
              <div className="flex justify-center gap-3 pt-2">
                <button onClick={() => setView('admin')} className="p-3 bg-[var(--bg-secondary)] rounded-full text-[var(--text-accent)] shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Activity className="w-5 h-5" />
                </button>
                <button onClick={() => setView('sales-tool')} className="p-3 bg-[var(--bg-secondary)] rounded-full text-[var(--text-accent)] shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <BarChart2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {view === 'leaderboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {showTutorial && (
              <div className="text-center" onClick={() => dismissTutorial('leaderboard')}>
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center text-[10px] bg-[var(--accent-bg)]/15 text-[var(--text-accent)] px-4 py-2 rounded-full font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                  {tutorialMessages.leaderboard}
                </motion.div>
              </div>
            )}
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

            {starHolders.length > 0 && (
              <div key="star-holders" className="bg-[var(--bg-secondary)]/50 p-5 rounded-3xl border border-[var(--border-default)] space-y-4 shadow-xl">
                <h3 className="text-sm font-black text-[var(--text-muted)] uppercase italic tracking-widest flex items-center gap-2">⭐ {t.starHolders}</h3>
                <div className="space-y-3">
                  {starHolders.map((h, i) => {
                    const isUser = h.uid === getUserId();
                    const level = getLevel(h.xp || 0);
                    return (
                      <div
                        key={h.uid}
                        className={`flex items-center justify-between ${isUser ? 'bg-[var(--accent-bg)]/10 -mx-2 px-2 py-1 rounded-xl border border-[var(--border-accent)]' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg w-6 text-center">
                            {i < 3 ? ['🥇', '🥈', '🥉'][i] : <span className="text-xs font-black text-[var(--text-subtle)]">{i + 1}</span>}
                          </span>
                          <Media src={h.avatar || '⚓'} imgClass="w-5 h-5" textClass="text-lg" />
                          <div className="flex flex-col">
                            <span className="font-bold uppercase text-sm tracking-widest leading-none">{h.nickname}</span>
                            <span className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest leading-none mt-1">{t.level} {level}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-[var(--text-accent)] italic font-mono">{h.xp} ⭐</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {leaderboards.length === 0 && <div className="text-center py-20 text-[var(--text-muted)] italic">{t.noEntries}</div>}
          </motion.div>
        )}

        {view === 'venues' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {showTutorial && (
              <div className="text-center" onClick={() => dismissTutorial('venues')}>
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center text-[10px] bg-[var(--accent-bg)]/15 text-[var(--text-accent)] px-4 py-2 rounded-full font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                  {tutorialMessages.venues}
                </motion.div>
              </div>
            )}
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
              <TreasureHuntMap venues={RESTAURANTS} pendingCheckIn={location.state?.pendingCheckIn} lang={lang} />
          </motion.div>
        )}
        
        {view === 'admin' && (
          <div className="max-w-6xl mx-auto">
            <AdminPanel lang={lang} />
          </div>
        )}

        {view === 'sales-tool' && (
          <SalesTool lang={lang} />
        )}

        {view === 'me' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {showTutorial && (
              <div className="text-center" onClick={() => dismissTutorial('me')}>
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center text-[10px] bg-[var(--accent-bg)]/15 text-[var(--text-accent)] px-4 py-2 rounded-full font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                  {tutorialMessages.me}
                </motion.div>
              </div>
            )}
            {/* Pill-style sub-tab bar */}
            <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl">
              <button
                onClick={() => setProfileView('profile')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 ${profileView === 'profile' ? 'bg-[var(--btn-primary-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <User className="w-3.5 h-3.5" /> {t.profileTab}
              </button>
              <button
                onClick={() => setProfileView('prizes')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 ${profileView === 'prizes' ? 'bg-[var(--btn-primary-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <Ticket className="w-3.5 h-3.5" /> {t.myPrizes}
              </button>
              <button
                onClick={() => setProfileView('shop')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 ${profileView === 'shop' ? 'bg-[var(--btn-primary-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <ShoppingCart className="w-3.5 h-3.5" /> {t.shop}
              </button>
              <button
                onClick={() => setProfileView('settings')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 ${profileView === 'settings' ? 'bg-[var(--btn-primary-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <Settings className="w-3.5 h-3.5" /> {t.settingsTab}
              </button>
            </div>

            {profileView === 'profile' && (
              <ProfileTab
                user={user}
                profile={profile}
                t={t}
                lang={lang}
                isEditing={isEditing}
                editName={editName}
                editAvatar={editAvatar}
                nameError={nameError}
                setIsEditing={setIsEditing}
                setEditName={setEditName}
                setEditAvatar={setEditAvatar}
                setNameError={setNameError}
                saveProfile={saveProfile}
                getUserId={getUserId}
                userLeaderboards={userLeaderboards}
                leaderboards={leaderboards}
                gamesList={gamesList}
                achievements={achievements}
                streak={streak}
                xp={xp}
                inventory={inventory}
                recruitCount={recruitCount}
                eggFindings={eggFindings}
                selectedBadge={selectedBadge}
                newlyUnlockedBadges={newlyUnlockedBadges}
                onSelectBadge={setSelectedBadge}
                onSell={handleSellItem}
              />
            )}

            {profileView === 'prizes' && (
              <PrizesTab
                t={t}
                lang={lang}
                gamesList={gamesList}
                playerPrizes={playerPrizes}
                hasMorePrizes={hasMorePrizes}
                loadingMorePrizes={loadingMorePrizes}
                onLoadMorePrizes={loadMorePrizes}
                RESTAURANTS={RESTAURANTS}
              />
            )}

            {profileView === 'shop' && (
              <ShopTab
                t={t}
                lang={lang}
                stars={xp}
                inventory={inventory}
                onBuy={handleShopBuy}
                onSell={handleSellItem}
              />
            )}

            {profileView === 'settings' && (
              <SettingsTab
                t={t}
                lang={lang}
                user={user}
                notificationPrefs={notificationPrefs}
                isRequestingNotif={isRequestingNotif}
                volume={volume}
                autoPlayMusic={autoPlayMusic}
                musicEnabled={musicEnabled}
                activeTracks={activeTracks}
                currentTrack={currentTrack}
                trackOrder={trackOrder}
                onLangChange={pickLang}
                onNotificationPrefsChange={setNotificationPrefs}
                onVolumeChange={setVolume}
                onAutoPlayMusicChange={setAutoPlayMusic}
                onMusicEnabledChange={setMusicEnabled}
                onActiveTracksChange={setActiveTracks}
                onSkipTrack={skipTrack}
                onPrevTrack={prevTrack}
              />
            )}
          </motion.div>
        )}

      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/90 to-transparent z-50 pointer-events-none">
        <nav className="max-w-[300px] mx-auto w-full pointer-events-auto">
          <div className="bg-[var(--bg-primary)]/80 backdrop-blur-xl border-t-4 border-[var(--accent-bg)] rounded-full p-2 flex justify-between shadow-2xl select-none">
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
