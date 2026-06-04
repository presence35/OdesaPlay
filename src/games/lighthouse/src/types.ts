// Game Constants and TypeScript shapes

declare module '*.png' {
  const value: string;
  export default value;
}

export type AppScreen = 'start' | 'playing' | 'upgrade' | 'gameover';

export interface Upgrades {
  autoFoghorn: boolean;
  tungstenFilament: boolean;
  solarBackup: boolean;
}

export type Weather = 'clear' | 'fog' | 'storm';
export type ShipStatus = 'approaching' | 'cleared' | 'crashed';

export interface Ship {
  id: string;
  distance: number; // 100 (far) to 0 (dock)
  frequency: number; // 88.0 to 108.0
  speed: number;
  lane: number;
  status: ShipStatus;
  shipClass?: 'standard' | 'cargoship' | 'speedboat';
}

export interface ScorePopup {
  id: number;
  text: string;
  distance: number;
  color: string;
}

export interface Drone {
  id: string;
  progress: number; // 0 to 100
  altitude: number; // e.g. 10 to 40
  direction?: number; // 1 (right) or -1 (left)
}

export interface GameControls {
  isLightPressed: boolean;
  tunedFreq: number;
  pumpQueue: number;
  dockTaps: number;
  fuseFixTaps: number;
}
