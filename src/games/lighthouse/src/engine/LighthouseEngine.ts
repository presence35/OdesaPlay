import { Application, Container, Graphics } from 'pixi.js';
import { Weather, GameControls, Upgrades, Ship, Drone, ShipStatus } from '../types';
import { ShipSprite } from './ShipSprite';
import { WeatherSystem } from './WeatherSystem';
import { DroneSprite } from './DroneSprite';
import { ParticleSystem } from './ParticleSystem';
import { EngineState, EngineCallbacks, EngineConfig } from './EngineTypes';
import { audio } from '../audio';

const TICK_MS = 50;
const DAY_DURATION = 120_000;
const SHIP_LANE_Y = [60, 78, 96];

export class LighthouseEngine {
  app: Application;
  private containerRef: HTMLDivElement;
  private controlsRef: React.MutableRefObject<GameControls>;
  private callbacks: EngineCallbacks | null = null;
  private config: EngineConfig | null = null;

  private bgLayer: Container;
  private entityLayer: Container;
  private weatherSys: WeatherSystem;
  private particles: ParticleSystem;
  private droneSprites: Map<string, DroneSprite> = new Map();

  private shipSprites: Map<string, ShipSprite> = new Map();
  private drones: Drone[] = [];
  private state: EngineState;
  private stateDirty = false;

  private weatherTimer = 0;
  private weatherManuallyCycled = false;
  private timeSinceLastFailure = 0;
  private nextFailureTarget = 30000 + Math.random() * 12000;
  private shipIdCounter = 0;

  constructor(
    container: HTMLDivElement,
    controlsRef: React.MutableRefObject<GameControls>,
  ) {
    this.containerRef = container;
    this.controlsRef = controlsRef;

    this.state = {
      ships: [],
      score: 0,
      timeRemaining: DAY_DURATION,
      battery: 100,
      heat: 0,
      weather: 'clear',
      lightOn: false,
      fuseBlown: false,
      fuseHealth: 10,
      isCooledDown: false,
      lightningAlpha: 0,
      shiftDocked: 0,
    };

    this.app = new Application();

    this.bgLayer = new Container();
    this.bgLayer.zIndex = 0;
    this.entityLayer = new Container();
    this.entityLayer.zIndex = 20;
    this.weatherSys = new WeatherSystem();
    this.particles = new ParticleSystem();
  }

  async init(callbacks: EngineCallbacks, config: EngineConfig) {
    this.callbacks = callbacks;
    this.config = config;

    const w = this.containerRef.clientWidth || 430;
    const h = this.containerRef.clientHeight || 400;

    await this.app.init({
      width: w,
      height: h,
      background: 0x0a1128,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    this.app.stage.sortableChildren = true;
    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.weatherSys.container);
    this.app.stage.addChild(this.entityLayer);
    this.app.stage.addChild(this.particles.container);

    this.weatherSys.resize(w, h);
    this.drawBackground(w, h);

    this.containerRef.appendChild(this.app.canvas as HTMLCanvasElement);

    this.app.ticker.add((ticker) => {
      const dt = ticker.deltaTime * (1000 / 60);
      this.tick(dt);
    });
  }

  private drawBackground(w: number, h: number) {
    const bg = new Graphics();
    bg.setFillStyle({ color: 0x0a1128 });
    bg.rect(0, 0, w, h);
    bg.fill();
    const seaY = h - 60;
    bg.setFillStyle({ color: 0x050b14 });
    bg.rect(0, seaY, w, 60);
    bg.fill();
    bg.setStrokeStyle({ color: 0x1e293b, width: 1 });
    bg.moveTo(0, seaY);
    bg.lineTo(w, seaY);
    bg.stroke();
    this.bgLayer.addChild(bg);

    const stars = new Graphics();
    for (let i = 0; i < 30; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * seaY * 0.7;
      stars.setFillStyle({ color: 0xffffff, alpha: 0.3 + Math.random() * 0.5 });
      stars.circle(sx, sy, 0.5 + Math.random() * 0.5);
      stars.fill();
    }
    this.bgLayer.addChild(stars);

    const seaLine = new Graphics();
    for (let i = 0; i < 20; i++) {
      const lx = Math.random() * w;
      seaLine.setStrokeStyle({ color: 0x1e293b, alpha: 0.3, width: 1 });
      seaLine.moveTo(lx, seaY + 5);
      seaLine.lineTo(lx + 15, seaY + 5);
      seaLine.stroke();
    }
    this.bgLayer.addChild(seaLine);
  }

  start() {
    this.state = {
      ships: [],
      score: 0,
      timeRemaining: DAY_DURATION,
      battery: 100,
      heat: 0,
      weather: 'clear',
      lightOn: false,
      fuseBlown: false,
      fuseHealth: 10,
      isCooledDown: false,
      lightningAlpha: 0,
      shiftDocked: 0,
    };
    this.weatherTimer = 0;
    this.weatherManuallyCycled = false;
    this.timeSinceLastFailure = 0;
    this.nextFailureTarget = 30000 + Math.random() * 12000;
    this.shipIdCounter = 0;
    this.drones = [];
    this.droneSprites.clear();
    this.entityLayer.removeChildren();
    this.weatherSys.setWeather('clear');
    this.emitState();
  }

  stop() {
    this.app.ticker.stop();
  }

  cycleWeather() {
    this.weatherManuallyCycled = true;
    const next: Weather = this.state.weather === 'clear'
      ? 'fog' : this.state.weather === 'fog' ? 'storm' : 'clear';
    this.state.weather = next;
    this.weatherSys.setWeather(next);
    audio.setWeather(next);
    if (next === 'fog' || next === 'storm') audio.playFoghorn();
    this.stateDirty = true;
  }

  private tick(dt: number) {
    const s = this.state;
    const c = this.controlsRef.current;
    const upgrades = this.config?.upgrades || { autoFoghorn: false, tungstenFilament: false, solarBackup: false };
    const totalDockedShips = this.config?.totalDockedShips || 0;
    const globalScore = this.config?.globalScore || 0;

    // --- Time ---
    s.timeRemaining = Math.max(0, s.timeRemaining - TICK_MS);
    if (s.timeRemaining <= 0) {
      this.callbacks?.onDayEnd(s.score, s.shiftDocked);
      return;
    }

    // --- Weather ---
    this.weatherTimer += TICK_MS;
    if (!this.weatherManuallyCycled) {
      if (this.weatherTimer > 30000 && this.weatherTimer <= 65000 && s.weather !== 'fog' && s.weather !== 'storm') {
        s.weather = Math.random() < 0.4 ? 'storm' : 'fog';
        this.weatherSys.setWeather(s.weather);
        audio.playFoghorn();
        audio.setWeather(s.weather);
      }
      if (this.weatherTimer > 65000 && s.weather !== 'storm') {
        s.weather = 'storm';
        this.weatherSys.setWeather('storm');
        audio.playFoghorn();
        audio.setWeather('storm');
      }
    }

    // --- Lightning ---
    if (s.weather === 'storm') {
      if (s.lightningAlpha > 0) {
        s.lightningAlpha = Math.max(0, s.lightningAlpha - 0.05);
        this.weatherSys.setLightningFlash(s.lightningAlpha);
      } else if (Math.random() < 0.005) {
        s.lightningAlpha = 0.8;
        this.weatherSys.setLightningFlash(0.8);
        setTimeout(() => audio.playThunder(), 100 + Math.random() * 320);
      }
    }

    // --- Weather particles ---
    this.weatherSys.tick(dt);

    // --- Drones ---
    const timeElapsed = DAY_DURATION - s.timeRemaining;
    this.updateDrones(timeElapsed, dt);

    // --- Fuse / System Failure ---
    if (s.fuseBlown) {
      s.lightOn = false;
      if (c.fuseFixTaps > 0) {
        s.fuseHealth -= c.fuseFixTaps;
        if (s.fuseHealth <= 0) {
          s.fuseBlown = false;
        }
      }
    } else {
      this.timeSinceLastFailure += TICK_MS;
      if (this.timeSinceLastFailure >= this.nextFailureTarget) {
        s.fuseBlown = true;
        s.fuseHealth = 3 + Math.floor(Math.random() * 8);
        this.timeSinceLastFailure = 0;
        this.nextFailureTarget = 30000 + Math.random() * 12000;
        audio.playSpark();
      }

      if (c.pumpQueue > 0) {
        s.battery = Math.min(100, s.battery + c.pumpQueue);
      }

      if (c.isLightPressed && s.battery > 0 && !s.isCooledDown) {
        if (!s.lightOn) audio.playLightToggle(true);
        s.lightOn = true;
        const drainRate = upgrades.solarBackup && s.weather === 'storm' ? 0.2 : 0.5;
        s.battery = Math.max(0, s.battery - drainRate);
        const heatRate = upgrades.tungstenFilament ? 0.3 : 0.6;
        s.heat += heatRate;
        if (s.heat >= 100) {
          s.isCooledDown = true;
          s.lightOn = false;
          audio.playLightToggle(false);
        }
      } else {
        if (s.lightOn) audio.playLightToggle(false);
        s.lightOn = false;
        s.heat = Math.max(0, s.heat - 0.9);
        if (s.heat <= 0) s.isCooledDown = false;
      }
    }

    // --- Ships ---
    this.processShips(c, upgrades, totalDockedShips, globalScore);

    // --- Spawn ---
    this.spawnShips();

    // --- Reset action queues ---
    c.pumpQueue = 0;
    c.dockTaps = 0;
    c.fuseFixTaps = 0;

    // --- Particles ---
    this.particles.tick(dt);

    this.stateDirty = true;
    this.emitState();
  }

  private processShips(c: GameControls, upgrades: Upgrades, totalDockedShips: number, globalScore: number) {
    const s = this.state;
    const lightOn = s.lightOn;
    const weather = s.weather;

    s.ships = s.ships.filter(ship => {
      if ((ship.status === 'crashed' || ship.status === 'cleared') && ship.distance < -15) {
        const sp = this.shipSprites.get(ship.id);
        if (sp) {
          this.entityLayer.removeChild(sp);
          this.shipSprites.delete(ship.id);
        }
        return false;
      }
      return true;
    });

    // Dock
    if (c.dockTaps > 0) {
      const dockable = s.ships.filter(ship => ship.status === 'approaching' && ship.distance < 85 && ship.distance > 0);
      if (dockable.length > 0) {
        const match = dockable.find(ship => Math.abs(ship.frequency - c.tunedFreq) <= 0.6);
        if (match) {
          const diff = Math.abs(match.frequency - c.tunedFreq);
          match.status = 'cleared' as ShipStatus;
          s.shiftDocked += 1;
          let perfectPoints = 150;
          let okPoints = 75;
          if (match.shipClass === 'cargoship') { perfectPoints = 250; okPoints = 125; }
          if (match.shipClass === 'speedboat') { perfectPoints = 100; okPoints = 50; }
          const earned = diff < 0.1 ? perfectPoints : okPoints;
          s.score += earned;
          audio.playDock(diff >= 0.1);
          const sp = this.shipSprites.get(match.id);
          if (sp) sp.setCleared();
          const px = this.shipToScreenX(match);
          const py = SHIP_LANE_Y[match.lane] || 60;
          this.particles.emit(px, py, 8, 0x4ade80, 2, 2);
          this.particles.addPopup(`+${earned}`, px, py - 15, diff < 0.1 ? 0x4ade80 : 0xfacc15);
        } else {
          audio.playError();
        }
      }
    }

    // Move ships
    for (const ship of s.ships) {
      if (ship.status === 'approaching') {
        let speed = 0.2;
        if (ship.shipClass === 'cargoship') speed = 0.12;
        if (ship.shipClass === 'speedboat') speed = 0.35;
        if (weather === 'fog') speed *= (upgrades.autoFoghorn ? 0.75 : 2.0);
        if (weather === 'storm') speed *= 2.5;
        if (lightOn) speed *= 0.3;
        ship.distance -= speed;

        if (ship.distance <= 0) {
          ship.status = 'crashed' as ShipStatus;
          audio.playError();
          let penalty = 100;
          if (totalDockedShips + s.shiftDocked < 3) {
            const potentialTotal = globalScore + s.score - penalty;
            if (potentialTotal < 0) penalty = Math.max(0, globalScore + s.score);
          }
          s.score -= penalty;
          if (penalty > 0) {
            const px = this.shipToScreenX(ship);
            const py = SHIP_LANE_Y[ship.lane] || 60;
            this.particles.addPopup(`-${penalty}`, px, py - 15, 0xdc2626);
            this.particles.emit(px, py, 12, 0xef4444, 3, 3);
          }
          const sp = this.shipSprites.get(ship.id);
          if (sp) sp.setCrashed();
          if (globalScore + s.score < 0 && (totalDockedShips + s.shiftDocked) >= 3) {
            this.callbacks?.onDayEnd(s.score, s.shiftDocked);
            return;
          }
        }
      } else {
        ship.distance -= 1.0;
      }
    }

    // Update sprite positions
    for (const ship of s.ships) {
      const sp = this.shipSprites.get(ship.id);
      if (!sp) continue;
      const px = this.shipToScreenX(ship);
      const py = SHIP_LANE_Y[ship.lane] || 60;
      sp.x = px;
      sp.y = py;
      sp.scale.set(1 - (ship.lane || 0) * 0.15);
      sp.updateLabel(ship.status === 'approaching' && ship.distance < 85, ship.frequency, c.tunedFreq);
      if (ship.status === 'cleared') {
        sp.alpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
      }
    }

    this.stateDirty = true;
  }

  private shipToScreenX(ship: Ship): number {
    const w = this.containerRef.clientWidth || 430;
    const rightEdge = w * 0.85;
    const leftEdge = w * 0.15;
    return leftEdge + (ship.distance / 100) * rightEdge;
  }

  private spawnShips() {
    const s = this.state;
    const activeApproach = s.ships.filter(ship => ship.status === 'approaching');
    const lanes = [0, 1, 2];
    const availableLanes = lanes.filter(lane => {
      const inLane = activeApproach.filter(ship => ship.lane === lane);
      return inLane.every(ship => ship.distance < 80);
    });

    if (activeApproach.length < 4 && availableLanes.length > 0) {
      const spawnChance = activeApproach.length === 0 ? 0.05 : 0.015;
      if (Math.random() < spawnChance) {
        const pickedLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const randClass = Math.random();
        const shipClass = randClass < 0.2 ? 'cargoship' : (randClass < 0.4 ? 'speedboat' : 'standard');
        const id = `ship-${this.shipIdCounter++}`;
        const newShip: Ship = {
          id,
          distance: 100,
          frequency: 80.0 + (Math.floor(Math.random() * 41) * 0.5),
          speed: 0.2,
          lane: pickedLane,
          status: 'approaching',
          shipClass,
        };
        s.ships.push(newShip);
        const sprite = new ShipSprite(newShip);
        sprite.x = this.shipToScreenX(newShip);
        sprite.y = SHIP_LANE_Y[pickedLane] || 60;
        this.entityLayer.addChild(sprite);
        this.shipSprites.set(id, sprite);
      }
    }
  }

  private updateDrones(timeElapsed: number, dt: number) {
    if (timeElapsed < 10000 && this.drones.length === 0) return;

    if (this.drones.length === 0) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      const drone: Drone = {
        id: `drone-${Date.now()}`,
        progress: dir === 1 ? -20 : 120,
        altitude: 10 + Math.random() * 30,
        direction: dir,
      };
      this.drones.push(drone);
      const ds = new DroneSprite(drone);
      this.entityLayer.addChild(ds);
      this.droneSprites.set(drone.id, ds);
    }

    for (const drone of this.drones) {
      const ds = this.droneSprites.get(drone.id);
      if (!ds) continue;
      const w = this.containerRef.clientWidth || 430;
      const h = this.containerRef.clientHeight || 400;

      const speed = 0.03 * dt;
      if (drone.direction === 1) {
        drone.progress += speed;
      } else {
        drone.progress -= speed;
      }

      const px = (drone.progress / 100) * w;
      const py = (drone.altitude / 100) * h;
      ds.x = px;
      ds.y = py;
      ds.scale.set(drone.direction === 1 ? 1 : -1, 1);
      ds.update(dt);

      if (drone.progress > 130 || drone.progress < -30) {
        this.drones = [];
        this.entityLayer.removeChild(ds);
        this.droneSprites.delete(drone.id);
      }
    }
  }

  private emitState() {
    if (!this.stateDirty) return;
    this.stateDirty = false;
    this.callbacks?.onStateUpdate({ ...this.state });
  }

  resize() {
    const w = this.containerRef.clientWidth || 430;
    const h = this.containerRef.clientHeight || 400;
    this.app.renderer.resize(w, h);
    this.weatherSys.resize(w, h);
  }

  destroy() {
    this.app.ticker.destroy();
    this.weatherSys.destroy();
    this.particles.destroy();
    for (const sp of this.shipSprites.values()) {
      this.entityLayer.removeChild(sp);
      sp.destroy({ children: true });
    }
    for (const ds of this.droneSprites.values()) {
      this.entityLayer.removeChild(ds);
      ds.destroy({ children: true });
    }
    this.shipSprites.clear();
    this.droneSprites.clear();
    this.entityLayer.removeChildren();
    this.bgLayer.removeChildren();
    if (this.app.canvas && this.app.canvas.parentElement) {
      this.app.canvas.parentElement.removeChild(this.app.canvas as HTMLCanvasElement);
    }
    this.app.destroy();
  }
}
