import { PlayerStats } from './types';

export const APP_ID = "odesa-gra-prod";

export const BADGE_DEFINITIONS = [
  { id: 'firstBlood', icon: '🩸', condition: (s: PlayerStats) => s.totalGamesPlayed >= 1 },
  { id: 'sharpshooter', icon: '🎯', condition: (s: PlayerStats) => s.hasTop3 },
  { id: 'globetrotter', icon: '🌍', condition: (s: PlayerStats) => s.checkins >= 5 },
  { id: 'recruiter', icon: '📣', condition: (s: PlayerStats) => s.recruits >= 3 },
  { id: 'marshrutkaRider', icon: '🚐', condition: (s: PlayerStats) => s.marshrutkaHighScore >= 50 },
  { id: 'droneSpotter', icon: '/images/drone.png', condition: (s: PlayerStats) => s.droneHighScore >= 50 },
  { id: 'triviaMaster', icon: '📚', condition: (s: PlayerStats) => s.triviaPercent >= 80 },
  { id: 'streakMaster', icon: '🔥', condition: (s: PlayerStats) => s.streak >= 7 },
  { id: 'odesaNative', icon: '🏙️', condition: (s: PlayerStats) => s.allVenuesUnlocked },
  { id: 'comebackKid', icon: '💪', condition: (s: PlayerStats) => s.beatHighScoreBy50 },
  { id: 'doubleThreat', icon: '⚡', condition: (s: PlayerStats) => s.highScoreGames >= 2 },
  { id: 'hatTrick', icon: '🎩', condition: (s: PlayerStats) => s.highScoreGames >= 3 },
];

export const XP_LEVELS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

export const XP_REWARDS = { gamePlayed: 10, newHighScore: 25, checkin: 15, referral: 50, badgeUnlocked: 30 };
