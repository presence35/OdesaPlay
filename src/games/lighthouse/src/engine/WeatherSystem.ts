import { Container, Graphics } from 'pixi.js';
import { Weather } from '../types';

interface FogParticle {
  x: number;
  y: number;
  vx: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
}

export class WeatherSystem {
  container: Container;
  weather: Weather = 'clear';

  private fogParticles: FogParticle[] = [];
  private rainDrops: RainDrop[] = [];
  private lightningGfx: Graphics;
  private fogGfx: Graphics;
  private rainGfx: Graphics;
  private fogOverlay: Graphics;
  private lightningAlpha = 0;
  private lightningTimer = 0;
  private width = 430;
  private height = 400;

  constructor() {
    this.container = new Container();
    this.container.zIndex = 10;

    this.fogOverlay = new Graphics();
    this.container.addChild(this.fogOverlay);

    this.fogGfx = new Graphics();
    this.container.addChild(this.fogGfx);

    this.rainGfx = new Graphics();
    this.container.addChild(this.rainGfx);

    this.lightningGfx = new Graphics();
    this.container.addChild(this.lightningGfx);
  }

  setWeather(w: Weather) {
    this.weather = w;
    if (w === 'fog' && this.fogParticles.length === 0) {
      for (let i = 0; i < 30; i++) {
        this.fogParticles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height * 0.7,
          vx: 0.2 + Math.random() * 0.3,
          size: 40 + Math.random() * 80,
          alpha: 0.05 + Math.random() * 0.1,
          alphaSpeed: 0.002 + Math.random() * 0.004,
        });
      }
    }
    if (w === 'storm' && this.rainDrops.length === 0) {
      for (let i = 0; i < 80; i++) {
        this.rainDrops.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          speed: 6 + Math.random() * 4,
          length: 8 + Math.random() * 12,
          alpha: 0.15 + Math.random() * 0.2,
        });
      }
    }
    if (w !== 'fog') {
      this.fogParticles = [];
      this.fogGfx.clear();
      this.fogOverlay.clear();
    }
    if (w !== 'storm') {
      this.rainDrops = [];
      this.rainGfx.clear();
    }
  }

  setLightningFlash(alpha: number) {
    this.lightningAlpha = alpha;
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  tick(dt: number) {
    const fps = 60;
    const factor = dt / (1000 / fps);

    this.fogOverlay.clear();

    if (this.weather === 'fog') {
      this.fogOverlay.setFillStyle({ color: 0x94a3b8, alpha: 0.12 });
      this.fogOverlay.rect(0, 0, this.width, this.height);
      this.fogOverlay.fill();

      this.fogGfx.clear();
      for (const p of this.fogParticles) {
        p.x += p.vx * factor;
        p.alpha += p.alphaSpeed * factor;
        if (p.alpha > 0.15 || p.alpha < 0.02) p.alphaSpeed *= -1;
        if (p.x > this.width + p.size) { p.x = -p.size; p.y = Math.random() * this.height * 0.7; }
        this.fogGfx.setFillStyle({ color: 0xcbd5e1, alpha: p.alpha });
        this.fogGfx.ellipse(p.x, p.y, p.size, p.size * 0.4);
        this.fogGfx.fill();
      }
    }

    if (this.weather === 'storm') {
      this.fogOverlay.setFillStyle({ color: 0x1e3a8a, alpha: 0.3 });
      this.fogOverlay.rect(0, 0, this.width, this.height);
      this.fogOverlay.fill();

      this.rainGfx.clear();
      for (const r of this.rainDrops) {
        r.y += r.speed * factor;
        r.x -= 1.5 * factor;
        if (r.y > this.height) { r.y = -r.length; r.x = Math.random() * this.width; }
        this.rainGfx.setStrokeStyle({ color: 0x93c5fd, alpha: r.alpha, width: 1 });
        this.rainGfx.moveTo(r.x, r.y);
        this.rainGfx.lineTo(r.x + 2, r.y + r.length);
        this.rainGfx.stroke();
      }
    }

    if (this.weather === 'storm' && this.lightningAlpha > 0) {
      this.lightningGfx.clear();
      this.lightningGfx.setFillStyle({ color: 0xffffff, alpha: this.lightningAlpha * 0.6 });
      this.lightningGfx.rect(0, 0, this.width, this.height);
      this.lightningGfx.fill();
    } else {
      this.lightningGfx.clear();
    }
  }

  destroy() {
    this.fogGfx.destroy();
    this.rainGfx.destroy();
    this.lightningGfx.destroy();
    this.fogOverlay.destroy();
    this.container.destroy({ children: true });
  }
}
