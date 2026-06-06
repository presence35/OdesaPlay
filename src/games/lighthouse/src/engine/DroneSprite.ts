import { Container, Graphics } from 'pixi.js';
import { Drone } from '../types';

export class DroneSprite extends Container {
  drone: Drone;
  body: Graphics;
  prop: Graphics;
  private propAngle = 0;

  constructor(drone: Drone) {
    super();
    this.drone = drone;
    this.body = new Graphics();
    this.prop = new Graphics();
    this.addChild(this.prop);
    this.addChild(this.body);
    this.drawDrone();
  }

  drawDrone() {
    const g = this.body;
    g.clear();
    g.setFillStyle({ color: 0x334155 });
    g.moveTo(0, 0);
    g.lineTo(28, -6);
    g.lineTo(28, 6);
    g.closePath();
    g.fill();
    g.setFillStyle({ color: 0x1e293b });
    g.moveTo(-2, 0);
    g.lineTo(28, 0);
    g.lineTo(26, 3);
    g.lineTo(4, 3);
    g.closePath();
    g.fill();
    g.setFillStyle({ color: 0x475569 });
    g.moveTo(26, -6);
    g.lineTo(29, -9);
    g.lineTo(29, -3);
    g.closePath();
    g.fill();
  }

  update(dt: number) {
    this.propAngle += 0.3 * dt;
    this.prop.clear();
    this.prop.setFillStyle({ color: 0xef4444, alpha: 0.8 });
    const px = 30;
    const py = 0;
    this.prop.ellipse(px, py, 1.5, 4);
    this.prop.fill();
    const cos = Math.cos(this.propAngle);
    const sin = Math.sin(this.propAngle);
    this.prop.setFillStyle({ color: 0xef4444, alpha: 0.6 });
    this.prop.ellipse(px + cos * 3, py + sin * 3, 1, 2);
    this.prop.fill();
    this.prop.ellipse(px - cos * 3, py - sin * 3, 1, 2);
    this.prop.fill();
  }
}
