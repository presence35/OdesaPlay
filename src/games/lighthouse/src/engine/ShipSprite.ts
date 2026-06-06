import { Container, Graphics, Text } from 'pixi.js';
import { Ship } from '../types';

const SHIP_HEIGHTS: Record<string, number> = {
  standard: 16,
  speedboat: 14,
  cargoship: 20,
};

export class ShipSprite extends Container {
  ship: Ship;
  hull: Graphics;
  freqLabel: Text;
  crashIcon: Text;

  constructor(ship: Ship) {
    super();
    this.ship = ship;
    this.hull = new Graphics();
    this.addChild(this.hull);

    this.freqLabel = new Text({
      text: '',
      style: {
        fontSize: 11,
        fontFamily: 'monospace',
        fill: 0xfacc15,
        fontWeight: 'bold',
      },
    });
    this.freqLabel.anchor.set(0.5, 0);
    this.freqLabel.y = -18;
    this.addChild(this.freqLabel);

    this.crashIcon = new Text({
      text: '',
      style: { fontSize: 20 },
    });
    this.crashIcon.anchor.set(0.5, 0.5);
    this.crashIcon.visible = false;
    this.addChild(this.crashIcon);

    this.drawShip(ship.shipClass || 'standard');
  }

  drawShip(shipClass: string) {
    const g = this.hull;
    g.clear();
    const h = SHIP_HEIGHTS[shipClass] || 16;
    const w = h * 2.8;

    g.setFillStyle({ color: 0xcbd5e1 });

    if (shipClass === 'speedboat') {
      g.moveTo(w * 0.05, h);
      g.lineTo(w * 0.85, h);
      g.quadraticCurveTo(w * 0.95, h, w, h * 0.5);
      g.lineTo(w * 0.7, h * 0.45);
      g.lineTo(w * 0.55, h * 0.15);
      g.lineTo(w * 0.35, h * 0.15);
      g.lineTo(w * 0.3, h * 0.45);
      g.lineTo(w * 0.05, h * 0.45);
      g.quadraticCurveTo(0, h * 0.6, w * 0.05, h);
      g.fill();
      g.setFillStyle({ color: 0x3b82f6 });
      g.rect(w * 0.4, h * 0.05, w * 0.03, h * 0.35);
      g.fill();
      g.setFillStyle({ color: 0x0f172a });
      g.circle(w * 0.25, h * 0.6, 2);
      g.fill();
      g.circle(w * 0.45, h * 0.6, 2);
      g.fill();
    } else if (shipClass === 'cargoship') {
      g.moveTo(w * 0.05, h);
      g.lineTo(w * 0.95, h);
      g.quadraticCurveTo(w, h, w, h * 0.6);
      g.lineTo(w * 0.9, h * 0.6);
      g.lineTo(w * 0.9, 0);
      g.lineTo(w * 0.75, 0);
      g.lineTo(w * 0.75, h * 0.6);
      g.lineTo(w * 0.15, h * 0.6);
      g.lineTo(w * 0.15, h * 0.3);
      g.lineTo(w * 0.05, h * 0.3);
      g.quadraticCurveTo(0, h * 0.45, w * 0.05, h);
      g.fill();
      g.setFillStyle({ color: 0xeab308 });
      g.rect(w * 0.25, h * 0.35, w * 0.1, h * 0.25);
      g.fill();
      g.setFillStyle({ color: 0xef4444 });
      g.rect(w * 0.4, h * 0.2, w * 0.15, h * 0.4);
      g.fill();
      g.setFillStyle({ color: 0x3b82f6 });
      g.rect(w * 0.6, h * 0.25, w * 0.12, h * 0.35);
      g.fill();
    } else {
      g.moveTo(w * 0.1, h * 0.75);
      g.lineTo(w * 0.9, h * 0.75);
      g.quadraticCurveTo(w * 0.95, h * 0.75, w * 0.95, h * 0.5);
      g.lineTo(w * 0.8, h * 0.5);
      g.lineTo(w * 0.75, h * 0.15);
      g.lineTo(w * 0.4, h * 0.15);
      g.lineTo(w * 0.35, h * 0.5);
      g.lineTo(w * 0.1, h * 0.5);
      g.quadraticCurveTo(w * 0.02, h * 0.5, w * 0.05, h * 0.75);
      g.fill();
      g.setFillStyle({ color: 0xef4444 });
      g.rect(w * 0.5, h * 0.08, w * 0.05, h * 0.35);
      g.fill();
      for (let i = 0; i < 5; i++) {
        const cx = w * 0.15 + i * w * 0.15;
        g.setFillStyle({ color: 0x0f172a });
        g.circle(cx, h * 0.62, 1.5);
        g.fill();
      }
    }
  }

  setCleared() {
    this.hull.alpha = 0.4;
    this.freqLabel.visible = false;
  }

  setCrashed() {
    this.hull.visible = false;
    this.freqLabel.visible = false;
    this.crashIcon.visible = true;
    this.crashIcon.text = '\uD83D\uDCA5';
  }

  removeCrash() {
    this.crashIcon.visible = false;
  }

  updateLabel(show: boolean, freq: number, tunedFreq: number) {
    if (show && this.ship.status === 'approaching') {
      this.freqLabel.visible = true;
      this.freqLabel.text = freq.toFixed(1);
      this.freqLabel.style.fill = Math.abs(freq - tunedFreq) <= 0.6 ? 0x4ade80 : 0xfacc15;
    } else {
      this.freqLabel.visible = false;
    }
  }
}
