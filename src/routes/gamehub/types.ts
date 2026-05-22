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
