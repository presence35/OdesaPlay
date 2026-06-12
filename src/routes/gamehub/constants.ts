import { PlayerStats } from './types';

export const APP_ID = "odesa-gra-prod";

export const BADGE_DEFINITIONS = [
  { id: 'firstBlood', icon: '🩸', condition: (s: PlayerStats) => s.totalGamesPlayed >= 1 },
  { id: 'sharpshooter', icon: '🎯', condition: (s: PlayerStats) => s.hasTop3 },
  { id: 'globetrotter', icon: '🌍', condition: (s: PlayerStats) => s.checkins >= 5 },
  { id: 'recruiter', icon: '📣', condition: (s: PlayerStats) => s.recruits >= 3 },
  { id: 'marshrutkaRider', icon: '🚐', condition: (s: PlayerStats) => s.marshrutkaHighScore >= 50 },
  { id: 'droneSpotter', icon: '/images/drone.png', condition: (s: PlayerStats) => s.droneHighScore >= 50 },
  { id: 'lighthouseKeeper', icon: '/images/lighthouse.png', condition: (s: PlayerStats) => s.lighthouseHighScore >= 100 },
  { id: 'triviaMaster', icon: '📚', condition: (s: PlayerStats) => s.triviaPercent >= 80 },
  { id: 'streakMaster', icon: '🔥', condition: (s: PlayerStats) => s.streak >= 7 },
  { id: 'odesaNative', icon: '🏙️', condition: (s: PlayerStats) => s.allVenuesUnlocked },
  { id: 'comebackKid', icon: '💪', condition: (s: PlayerStats) => s.beatHighScoreBy50 },
  { id: 'doubleThreat', icon: '⚡', condition: (s: PlayerStats) => s.highScoreGames >= 2 },
  { id: 'hatTrick', icon: '🎩', condition: (s: PlayerStats) => s.highScoreGames >= 3 },
  { id: 'dedicated', icon: '🎮', condition: (s: PlayerStats) => s.totalGamesPlayed >= 25 },
  { id: 'century', icon: '💯', condition: (s: PlayerStats) => s.totalGamesPlayed >= 100 },
  { id: 'odessaAddict', icon: '🕹️', condition: (s: PlayerStats) => s.totalGamesPlayed >= 500 },
  { id: 'regular', icon: '☕', condition: (s: PlayerStats) => s.checkins >= 10 },
  { id: 'loyalPatron', icon: '🏆', condition: (s: PlayerStats) => s.checkins >= 25 },
  { id: 'odessaRoyalty', icon: '👑', condition: (s: PlayerStats) => s.checkins >= 50 },
  { id: 'buddy', icon: '🤝', condition: (s: PlayerStats) => s.recruits >= 1 },
  { id: 'networker', icon: '🌐', condition: (s: PlayerStats) => s.recruits >= 5 },
  { id: 'superstar', icon: '⭐', condition: (s: PlayerStats) => s.recruits >= 15 },
  { id: 'onARoll', icon: '🎲', condition: (s: PlayerStats) => s.streak >= 3 },
  { id: 'unstoppable', icon: '🛡️', condition: (s: PlayerStats) => s.streak >= 14 },
  { id: 'eternal', icon: '♾️', condition: (s: PlayerStats) => s.streak >= 30 },
  { id: 'droneAce', icon: '✈️', condition: (s: PlayerStats) => s.droneHighScore >= 1000 },
  { id: 'droneGod', icon: '🤖', condition: (s: PlayerStats) => s.droneHighScore >= 2000 },
  { id: 'marshrutkaChamp', icon: '🏎️', condition: (s: PlayerStats) => s.marshrutkaHighScore >= 1000 },
  { id: 'marshrutkaLegend', icon: '🏁', condition: (s: PlayerStats) => s.marshrutkaHighScore >= 2000 },
  { id: 'lighthouseGuardian', icon: '🗼', condition: (s: PlayerStats) => s.lighthouseHighScore >= 500 },
  { id: 'lighthouseTitan', icon: '🏗️', condition: (s: PlayerStats) => s.lighthouseHighScore >= 1000 },
  { id: 'triviaScholar', icon: '📖', condition: (s: PlayerStats) => s.triviaPercent >= 90 },
  { id: 'perfectScore', icon: '💯', condition: (s: PlayerStats) => s.triviaPercent >= 100 },
  { id: 'silentGuardian', icon: '🎯', condition: (s: PlayerStats) => s.shooterHighScore >= 100 },
  { id: 'peaceMaker', icon: '🕊️', condition: (s: PlayerStats) => s.shooterHighScore >= 80 },
  { id: 'risingStar', icon: '🌟', condition: (s: PlayerStats) => s.highScoreGames >= 1 },
  { id: 'quadThreat', icon: '🔱', condition: (s: PlayerStats) => s.highScoreGames >= 4 },
  { id: 'grandSlam', icon: '🏅', condition: (s: PlayerStats) => s.highScoreGames >= 5 },
  { id: 'jackOfAllTrades', icon: '🃏', condition: (s: PlayerStats) => s.uniqueGamesPlayed >= 5 },
  { id: 'darkHorse', icon: '🐎', condition: (s: PlayerStats) => s.beatHighScoreBy100 },
  { id: 'partyAnimal', icon: '🎉', condition: (s: PlayerStats) => s.activeDays >= 30 },
  { id: 'nightOwl', icon: '🦉', condition: (s: PlayerStats) => s.dailyCheckinCount >= 3 },
];

export const STAR_LEVELS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

export const STAR_REWARDS = { gamePlayed: 10, newHighScore: 25, checkin: 15, referral: 50, badgeUnlocked: 30 };

export interface ShopItem {
  id: string;
  gameIds: string[];
  name: { en: string; uk: string };
  desc: { en: string; uk: string };
  cost: number;
  icon: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'boost2', gameIds: ['marshrutka'], name: { en: 'Speed Boost +2', uk: 'Прискорення +2' }, desc: { en: 'Permanent +2 km/h baseline speed', uk: 'Постійне +2 км/год до швидкості' }, cost: 50, icon: '🔥' },
  { id: 'boost5', gameIds: ['marshrutka'], name: { en: 'Speed Boost +5', uk: 'Прискорення +5' }, desc: { en: 'Permanent +5 km/h baseline speed', uk: 'Постійне +5 км/год до швидкості' }, cost: 250, icon: '🔥🔥' },
  { id: 'boost10', gameIds: ['marshrutka'], name: { en: 'Speed Boost +10', uk: 'Прискорення +10' }, desc: { en: 'Permanent +10 km/h baseline speed', uk: 'Постійне +10 км/год до швидкості' }, cost: 500, icon: '🔥🔥🔥' },
  { id: 'magnet', gameIds: ['marshrutka'], name: { en: 'Flower Magnet', uk: 'Магніт для квітів' }, desc: { en: 'Flowers drift toward your bus', uk: 'Квіти притягуються до маршрутки' }, cost: 150, icon: '🧲' },
  { id: 'extendedShift', gameIds: ['lighthouse'], name: { en: 'Extended Shift', uk: 'Подовжена зміна' }, desc: { en: '+30 seconds per day', uk: '+30 секунд до дня' }, cost: 200, icon: '⏱️' },
  { id: 'autoRepair', gameIds: ['lighthouse'], name: { en: 'Auto-Repair', uk: 'Авторемонт' }, desc: { en: 'Fuse slowly repairs itself', uk: 'Запобіжник повільно лагодиться сам' }, cost: 300, icon: '🔧' },
  { id: 'autoFoghorn', gameIds: ['lighthouse'], name: { en: 'Auto Foghorn', uk: 'Авто-Туман' }, desc: { en: 'Slows down lost ships in deep fog', uk: 'Уповільнює кораблі в тумані' }, cost: 150, icon: '📯' },
  { id: 'tungstenFilament', gameIds: ['lighthouse'], name: { en: 'Tungsten Bulb', uk: 'Вольфрамова лампа' }, desc: { en: 'Slows main light overheat rate', uk: 'Сповільнює перегрів лампи' }, cost: 300, icon: '💡' },
  { id: 'solarBackup', gameIds: ['lighthouse'], name: { en: 'Storm Battery', uk: 'Штормовий акумулятор' }, desc: { en: 'Preserves power during storms', uk: 'Зберігає енергію під час шторму' }, cost: 500, icon: '🔋' },
  { id: 'widerSpray', gameIds: ['drones'], name: { en: 'Wider Spray', uk: 'Широкий спрей' }, desc: { en: 'Larger drone hitbox', uk: 'Більша зона ураження' }, cost: 200, icon: '💦' },
  { id: 'coolDown', gameIds: ['drones'], name: { en: 'Cool Down', uk: 'Охолодження' }, desc: { en: 'Faster fire rate', uk: 'Швидша стрільба' }, cost: 300, icon: '❄️' },
  { id: 'lifeline50', gameIds: ['trivia'], name: { en: '50/50 Lifeline', uk: 'Підказка 50/50' }, desc: { en: 'Remove 2 wrong answers once per game', uk: 'Прибрати 2 неправильні відповіді раз за гру' }, cost: 100, icon: '💡' },
];
