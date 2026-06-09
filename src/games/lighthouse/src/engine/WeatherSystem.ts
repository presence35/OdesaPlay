import { Container, Graphics } from 'pixi.js';
import { Weather } from '../types';

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

  private rainDrops: RainDrop[] = [];
  private lightningGfx: Graphics;
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

    this.rainGfx = new Graphics();
    this.container.addChild(this.rainGfx);

    this.lightningGfx = new Graphics();
    this.container.addChild(this.lightningGfx);
  }

  setWeather(w: Weather) {
    this.weather = w;
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
      const seaY = this.height - 60;
      this.fogOverlay.setFillStyle({ color: 0x94a3b8, alpha: 0.8 });
      this.fogOverlay.rect(0, 0, this.width, seaY);
      this.fogOverlay.fill();
      this.fogOverlay.setFillStyle({ color: 0x64748b, alpha: 0.7 });
      this.fogOverlay.rect(0, seaY, this.width, 60);
      this.fogOverlay.fill();
    } else if (this.weather === 'storm') {
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
    this.rainGfx.destroy();
    this.lightningGfx.destroy();
    this.fogOverlay.destroy();
    this.container.destroy({ children: true });
  }
}
