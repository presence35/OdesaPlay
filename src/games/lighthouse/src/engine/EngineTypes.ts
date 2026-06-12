import { Weather, Upgrades, GameControls, Ship } from '../types';

export interface EngineState {
  ships: Ship[];
  score: number;
  timeRemaining: number;
  battery: number;
  heat: number;
  weather: Weather;
  lightOn: boolean;
  fuseBlown: boolean;
  fuseHealth: number;
  isCooledDown: boolean;
  lightningAlpha: number;
  shiftDocked: number;
}

export interface EngineCallbacks {
  onStateUpdate: (state: EngineState) => void;
  onDayEnd: (earnings: number, shiftDocked: number) => void;
}

export interface EngineConfig {
  upgrades: Upgrades;
  globalScore: number;
  totalDockedShips: number;
  isMobile: boolean;
}
