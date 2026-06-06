import { Container, Graphics, Text } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  decay: number;
}

interface ScorePopup {
  id: number;
  text: string;
  x: number;
  y: number;
  color: number;
  life: number;
  maxLife: number;
  textObj: Text | null;
}

export class ParticleSystem {
  container: Container;
  private particles: Particle[] = [];
  private popups: ScorePopup[] = [];
  private gfx: Graphics;

  constructor() {
    this.container = new Container();
    this.container.zIndex = 50;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  emit(x: number, y: number, count: number, color: number, speed = 3, size = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 1,
        maxLife: 1,
        size: size * (0.5 + Math.random()),
        color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03,
      });
    }
  }

  addPopup(text: string, x: number, y: number, color: number) {
    const popup: ScorePopup = {
      id: Date.now() + Math.random(),
      text,
      x, y,
      color,
      life: 1,
      maxLife: 1,
      textObj: null,
    };
    popup.textObj = new Text({
      text,
      style: {
        fontSize: 18,
        fontFamily: 'monospace',
        fill: color,
        fontWeight: 'bold',
      },
    });
    popup.textObj.anchor.set(0.5, 0.5);
    popup.textObj.x = x;
    popup.textObj.y = y;
    this.container.addChild(popup.textObj);
    this.popups.push(popup);
  }

  tick(dt: number) {
    const fps = 60;
    const factor = dt / (1000 / fps);

    this.gfx.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * factor;
      p.y += p.vy * factor;
      p.vy += 0.05 * factor;
      p.life -= p.decay * factor;
      p.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      this.gfx.setFillStyle({ color: p.color, alpha: p.alpha });
      this.gfx.circle(p.x, p.y, p.size * p.life);
      this.gfx.fill();
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= 0.015 * factor;
      if (p.textObj) {
        p.textObj.y = p.y - (1 - p.life) * 30;
        p.textObj.alpha = Math.max(0, p.life);
      }
      if (p.life <= 0) {
        if (p.textObj) {
          this.container.removeChild(p.textObj);
          p.textObj.destroy();
        }
        this.popups.splice(i, 1);
      }
    }
  }

  destroy() {
    for (const p of this.popups) {
      if (p.textObj) {
        this.container.removeChild(p.textObj);
        p.textObj.destroy();
      }
    }
    this.gfx.destroy();
    this.container.destroy({ children: true });
  }
}
