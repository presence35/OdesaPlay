import type { Container } from 'pixi.js';

export type Weapon = 'water' | 'banana' | 'ak47';

export interface Vehicle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  originalSpeed: number;
  speedBoost: number;
  type: 'car' | 'motorcycle';
  isNoisy: boolean;
  isSilent: boolean;
  status: 'normal' | 'watered' | 'banana-stopped' | 'exploded';
  color: string;
  direction: 1 | -1; // 1 = right, -1 = left
  waterLevel: number;
  opacity: number;
  bananaHits: number;
  lane: 0 | 1;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'water' | 'explosion' | 'banana';
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  type: 'water' | 'banana' | 'bullet';
  container: Container;
}

export interface GameState {
  silenceLevel: number;
  score: number;
  vehicles: Vehicle[];
  particles: Particle[];
  projectiles: Projectile[];
  weapon: Weapon;
  timeLeft: number;
  gameOver: boolean;
  isShooting: boolean;
}

