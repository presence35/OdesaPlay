export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface Game {
  id: string;
  cat: string;
  title: { en: string; uk: string };
  url: string;
  icon?: string;
  comingSoon?: boolean;
  orientation?: 'portrait' | 'landscape';
}

export interface Claim {
  id?: string;
  code: string;
  venueId: string;
  rewardType: string;
  gameTitle: string;
  score: number;
  tier: number;
  timestamp: any;
  expiresAt: number;
  venue?: string;
  uid: string;
  redeemed?: boolean;
  redeemedAt?: any;
}

export interface PlayerStats {
  totalGamesPlayed: number;
  hasTop3: boolean;
  checkins: number;
  recruits: number;
  marshrutkaHighScore: number;
  droneHighScore: number;
  triviaPercent: number;
  streak: number;
  allVenuesUnlocked: boolean;
  beatHighScoreBy50: boolean;
  highScoreGames: number;
}

export interface TournamentWinner {
  uid: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
  claimCode: string;
  claimExpiresAt: number;
  claimed: boolean;
}

export interface VenueTournament {
  id: string;
  venueId: string;
  venueName: string;
  gameId: string;
  prize: string;
  topWinners: number;
  startedAt: any;
  expiresAt: any;
  status: 'active' | 'ended';
  resolved: boolean;
  winners?: TournamentWinner[];
}

export interface NotificationPreferences {
  droneAlerts: boolean;
  gameReminders: boolean;
  venueSpecials: boolean;
  fcmToken?: string;
  fcmTokenUpdatedAt?: number;
}
