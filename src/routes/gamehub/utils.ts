import { auth, getUserId } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { translations, Language } from '../../language';
import { showToast } from '../../components/Toast';
import { PlayerStats, Game, OperationType, FirestoreErrorInfo } from './types';
import { BADGE_DEFINITIONS, STAR_LEVELS, STAR_REWARDS, APP_ID } from './constants';
import { db } from '../../firebase';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  showToast('Connection error. Please check your connection and try again.');
}

export function transliterate(text: string) {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g'
  };
  return text.toLowerCase().split('').map(char => map[char] || char).join('');
}

export async function shareScore(game: Game, score: number, lang: Language, profile: { nickname: string; avatar: string; referredBy?: string }) {
  const t = translations[lang];
  const shareData = {
    title: 'OdesaPlay',
    text: t.shareText.replace('{score}', score.toString()).replace('{game}', game.title[lang]),
    url: `http://odesaplay.com.ua/${game.id}?r=${profile.nickname ? profile.nickname.toLowerCase().replace(/\s/g, '_') : `hero_${getUserId().substring(0, 8)}`}`
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      showToast('Score copied to clipboard!');
    }
  } catch (err) {
    console.error('Error sharing', err);
  }
}

export function getTier(score: number, gameId: string, venueConfig: any, leaderboards: any[]): number | null {
  for (let t = 3; t >= 1; t--) {
    const cfg = venueConfig[`tier${t}`];
    if (!cfg) continue;
    if (cfg.mode === 'percentile') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const gameScores = leaderboards.filter(l => {
        if (l.gameId !== gameId) return false;
        if (!l.timestamp) return false;
        const ts = l.timestamp.toMillis ? l.timestamp.toMillis() : (l.timestamp.seconds * 1000);
        return ts >= oneWeekAgo;
      });
      const below = gameScores.filter(l => l.score < score).length;
      const pct = gameScores.length > 0 ? (below / gameScores.length) * 100 : 0;
      if (pct >= (100 - Number(cfg.threshold))) return t;
    } else {
      if (score >= Number(cfg.threshold)) return t;
    }
  }
  return null;
}

export function triggerHaptic(pattern: number[] = [50]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

export function calculatePlayerStats(
  leaderboards: any[],
  allProfiles: Record<string, { nickname: string; avatar: string; referredBy?: string }>,
  RESTAURANTS: any[],
  activeGame: Game | null,
  prevScores: Record<string, number>,
  streak: number,
  recruitCount?: number,
): PlayerStats {
  const userId = getUserId();
  const userRecords = leaderboards.filter(l => l.uid === userId);
  const totalGamesPlayed = userRecords.reduce((acc, r) => acc + (r.playCount || 1), 0);
  let checkins = 0;
  try { checkins = Object.keys(JSON.parse(localStorage.getItem('odesa_checkins') || '{}')).length; } catch {}
  const recruits = recruitCount ?? Object.values(allProfiles).filter((p: any) => p.referredBy === userId).length;
  const marshrutkaHighScore = userRecords.filter(l => l.gameId === 'marshrutka').reduce((max, l) => Math.max(max, l.score || 0), 0);
  const droneHighScore = userRecords.filter(l => l.gameId === 'drones').reduce((max, l) => Math.max(max, l.score || 0), 0);
  const lighthouseHighScore = userRecords.filter(l => l.gameId === 'lighthouse').reduce((max, l) => Math.max(max, l.score || 0), 0);
  const shooterHighScore = userRecords.filter(l => l.gameId === 'shooter').reduce((max, l) => Math.max(max, l.score || 0), 0);

  const triviaRecords = userRecords.filter(l => l.gameId === 'trivia');
  let triviaPercent = 0;
  if (triviaRecords.length > 0) {
    const triviaScore = triviaRecords.reduce((max, l) => Math.max(max, l.score || 0), 0);
    triviaPercent = Math.min(100, (triviaScore / 30) * 100);
  }

  let hasTop3 = false;
  let highScoreGames = 0;
  userRecords.forEach(r => {
    const gameRecords = leaderboards.filter(l => l.gameId === r.gameId).sort((a, b) => b.score - a.score);
    const rank = gameRecords.findIndex(l => l.uid === userId) + 1;
    if (rank <= 3 && rank > 0) hasTop3 = true;
    if (rank === 1) highScoreGames++;
  });

  const allVenuesUnlocked = checkins >= RESTAURANTS.length && RESTAURANTS.length > 0;
  let beatHighScoreBy50 = false;
  let beatHighScoreBy100 = false;
  if (activeGame) {
    const prev = prevScores[activeGame.id] || 0;
    if (prev > 0) {
      const currentBest = userRecords.find(l => l.gameId === activeGame.id)?.score || 0;
      if (currentBest > prev * 1.5) beatHighScoreBy50 = true;
      if (currentBest > prev * 2.0) beatHighScoreBy100 = true;
    }
  }

  const uniqueGamesPlayed = new Set(userRecords.map(r => r.gameId)).size;
  const gameIds = [...new Set(userRecords.map(r => r.gameId))];
  let totalScoreSum = 0;
  for (const gid of gameIds) {
    totalScoreSum += userRecords.filter(r => r.gameId === gid).reduce((max, r) => Math.max(max, r.score || 0), 0);
  }
  const activeDays = new Set(userRecords.map(r => {
    if (!r.timestamp) return null;
    const ts = r.timestamp.toMillis ? r.timestamp.toMillis() : (r.timestamp.seconds ? r.timestamp.seconds * 1000 : r.timestamp);
    return new Date(ts).toISOString().slice(0, 10);
  }).filter(Boolean)).size;
  let dailyCheckinCount = 0;
  try {
    const stored = JSON.parse(localStorage.getItem('odesa_checkins') || '{}');
    const today = new Date().toISOString().slice(0, 10);
    dailyCheckinCount = Object.values(stored).filter((v: any) => v?.ts?.startsWith(today)).length;
  } catch {}

  return { totalGamesPlayed, hasTop3, checkins, recruits, marshrutkaHighScore, droneHighScore, triviaPercent, lighthouseHighScore, shooterHighScore, streak, allVenuesUnlocked, beatHighScoreBy50, beatHighScoreBy100, highScoreGames, uniqueGamesPlayed, totalScoreSum, activeDays, dailyCheckinCount };
}

export async function checkAndUnlockBadges(
  uid: string,
  achievements: Record<string, { unlockedAt: any }>,
  xp: number,
  streak: number,
  prevScores: Record<string, number>,
  setNewlyUnlockedBadges: (badges: string[]) => void,
  leaderboards: any[],
  allProfiles: Record<string, { nickname: string; avatar: string; referredBy?: string }>,
  RESTAURANTS: any[],
  activeGame: Game | null,
) {
  const stats = calculatePlayerStats(leaderboards, allProfiles, RESTAURANTS, activeGame, prevScores, streak);
  const newUnlocks: string[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!achievements[badge.id] && badge.condition(stats)) {
      newUnlocks.push(badge.id);
    }
  }

  if (newUnlocks.length > 0) {
    const newAchievements = { ...achievements };
    let totalXpGain = 0;
    for (const badgeId of newUnlocks) {
      newAchievements[badgeId] = { unlockedAt: new Date().toISOString() };
      totalXpGain += STAR_REWARDS.badgeUnlocked;
    }
    const newXp = xp + totalXpGain;

    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', uid), {
      achievements: newAchievements,
      streak,
      xp: newXp,
      prevScores,
      updatedAt: serverTimestamp()
    }, { merge: true });

    setNewlyUnlockedBadges(newUnlocks);
    triggerHaptic([100, 50, 100, 50, 200]);
    setTimeout(() => setNewlyUnlockedBadges([]), 4000);
  }
}

export async function awardStars(
  uid: string,
  amount: number,
  xp: number,
  achievements: Record<string, { unlockedAt: any }>,
  streak: number,
  prevScores: Record<string, number>,
) {
  const newXp = xp + amount;
  await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', uid), {
    achievements,
    streak,
    xp: newXp,
    prevScores,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function updateStreak(
  uid: string,
  streak: number,
  xp: number,
  achievements: Record<string, { unlockedAt: any }>,
  prevScores: Record<string, number>,
  setStreak: (s: number) => void,
) {
  const today = new Date().toISOString().slice(0, 10);
  const lastPlayDate = localStorage.getItem('odesa_lastPlayDate');

  if (lastPlayDate === today) return;

  let newStreak = streak;
  if (lastPlayDate) {
    const last = new Date(lastPlayDate);
    const now = new Date(today);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  localStorage.setItem('odesa_lastPlayDate', today);
  setStreak(newStreak);

  await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playerProgress', uid), {
    achievements,
    streak: newStreak,
    xp,
    prevScores,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function getLevel(stars: number): number {
  let level = 1;
  for (let i = 0; i < STAR_LEVELS.length; i++) {
    if (stars >= STAR_LEVELS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getStarsForCurrentLevel(stars: number): number {
  const level = getLevel(stars);
  return STAR_LEVELS[level - 1] || 0;
}

export function getStarsForNextLevel(stars: number): number {
  const level = getLevel(stars);
  return STAR_LEVELS[level] || STAR_LEVELS[STAR_LEVELS.length - 1];
}

export function getStarsProgress(stars: number): number {
  const current = getStarsForCurrentLevel(stars);
  const next = getStarsForNextLevel(stars);
  if (next === current) return 100;
  return ((stars - current) / (next - current)) * 100;
}

export function getWeekFilteredLeaderboards(leaderboards: any[]) {
  const now = new Date();
  const day = now.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(monday);
  lastWeekStart.setDate(monday.getDate() - 7);
  return leaderboards.filter(l => {
    if (!l.timestamp) return false;
    const ts = l.timestamp.toMillis ? l.timestamp.toMillis() : (l.timestamp.seconds * 1000);
    return ts >= lastWeekStart.getTime() && ts < monday.getTime();
  });
}

export function calculateSellValue(paidCost: number, purchasedAt: any): { weeksOwned: number; lossPercent: number; refund: number } {
  if (!paidCost || !Number.isFinite(paidCost) || paidCost <= 0) return { weeksOwned: 0, lossPercent: 0, refund: 0 };
  if (!purchasedAt) return { weeksOwned: 0, lossPercent: 0, refund: paidCost };
  const purchaseDate = purchasedAt.toDate ? purchasedAt.toDate() : new Date(purchasedAt);
  const msOwned = Date.now() - purchaseDate.getTime();
  const weeksOwned = Math.max(0, Math.floor(msOwned / (7 * 86400000)));
  const lossPercent = Math.min(weeksOwned * 2, 75);
  const refund = Math.max(Math.floor(paidCost * (100 - lossPercent) / 100), Math.ceil(paidCost * 0.25));
  return { weeksOwned, lossPercent, refund };
}

export function getTimeAgo(timestamp: any, lang: Language) {
  const t = translations[lang];
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
}
