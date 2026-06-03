// Game Constants and TypeScript shapes

export type AppScreen = 'start' | 'playing' | 'upgrade';

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
  status: ShipStatus;
}

export interface GameControls {
  isLightPressed: boolean;
  tunedFreq: number;
  pumpQueue: number;
  dockTaps: number;
  fuseFixTaps: number;
}
