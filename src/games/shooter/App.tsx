import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameState, Vehicle, Particle, Weapon, Projectile } from './types';
import { Droplet, Banana } from 'lucide-react';
import { sounds } from './sounds';
import { TRANSLATIONS, Lang } from './translations';
import { showToast } from '../../components/Toast';
import { ObjectPool } from '../../utils/objectPool';
import GameEndScreen from '../GameEndScreen';

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const STREET_Y_MIN = 350;
const STREET_Y_MAX = 500;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const noiseBarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLParagraphElement>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    silenceLevel: 100,
    score: 0,
    vehicles: [],
    particles: [],
    projectiles: [],
    weapon: 'water',
    timeLeft: 60,
    gameOver: false,
    isShooting: false,
  });
  
  const stateRef = useRef<GameState>(gameState);
  const mouseRef = useRef({ x: 0, y: 0 });
  
  const isPaidUser = true; // Unlocked for testing!
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const recoveringRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [lang, setLang] = useState<Lang>('uk');
  const langRef = useRef<Lang>(lang);
  langRef.current = lang;
  const t = TRANSLATIONS[lang];
  
  const resetGame = () => {
    sounds.stopAll();
    const newState: GameState = {
      silenceLevel: 100, score: 0, vehicles: [], particles: [], projectiles: [],
      weapon: 'water', timeLeft: 60, gameOver: false, isShooting: false,
    };
    stateRef.current = newState;
    setGameState(newState);
    startedRef.current = true;
    setStarted(true);
    setPixiVersion(v => v + 1);
    sounds.init();
    sounds.startBackground();
    window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, window.location.origin);
  };
  
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [pixiVersion, setPixiVersion] = useState(0);
  
  // Pixi refs
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const vehiclePoolRef = useRef<ObjectPool<PIXI.Container> | null>(null);
  const projectilePoolRef = useRef<ObjectPool<PIXI.Container> | null>(null);
  const visualsRef = useRef(new Map<string, PIXI.Container>());
  const particleGfxRef = useRef<PIXI.Graphics | null>(null);
  const texturesRef = useRef<Record<string, PIXI.Texture>>({});
  
  const layersRef = useRef({
    background: new PIXI.Container(),
    road: new PIXI.Container(),
    entity: new PIXI.Container(),
    particle: new PIXI.Container(),
    effects: new PIXI.Container(),
    foreground: new PIXI.Container(),
    uiAim: new PIXI.Container()
  });

  useEffect(() => {
    if (window.Odesa?.getConfig) {
      const config = window.Odesa.getConfig();
      if (config) {
        setLang(config.lang === 'uk' ? 'uk' : 'en');
        if (typeof config.sfxEnabled === 'boolean') {
          sounds.setSfxEnabled(config.sfxEnabled);
        }
      }
    }
    if (window.Odesa?.onConfig) {
      window.Odesa.onConfig((config: any) => {
        setLang(config.lang === 'uk' ? 'uk' : 'en');
        if (typeof config.sfxEnabled === 'boolean') {
          sounds.setSfxEnabled(config.sfxEnabled);
        }
      });
    }
    if (window.Odesa?.onStop) {
      window.Odesa.onStop(() => {
        stateRef.current.gameOver = true;
        setGameState({ ...stateRef.current });
        if (window.Odesa?.gameOver) window.Odesa.gameOver(stateRef.current.score);
        setStarted(false);
      });
    }
    if (window.Odesa?.ready) window.Odesa.ready();
    if (window.Odesa?.onPause) {
      window.Odesa.onPause(() => {
        if (startedRef.current && !stateRef.current.gameOver) {
          pausedRef.current = true;
          setPaused(true);
        }
      });
    }
    if (window.Odesa?.onResume) {
      window.Odesa.onResume(() => {
        if (pausedRef.current) {
          pausedRef.current = false;
          setPaused(false);
        }
      });
    }
  }, []);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let app: PIXI.Application | null = null;
    let isDestroyed = false;
    let appInitialized = false;

    (async () => {
      visualsRef.current.clear();
      particleGfxRef.current = null;
      projectilePoolRef.current?.destroyAll(c => c.destroy());
      vehiclePoolRef.current?.destroyAll(c => c.destroy());
      const makeVContainer = () => {
        const c = new PIXI.Container();
        const s = new PIXI.Sprite(); s.anchor.set(0.5); s.label = 'body'; c.addChild(s);
        const makeWheel = (label: string) => {
          const s = new PIXI.Sprite();
          s.anchor.set(0.5);
          s.label = label;
          return s;
        };
        c.addChild(makeWheel('wheelFront'));
        c.addChild(makeWheel('wheelRear'));
        const it = new PIXI.Text({ text: '', style: { fill: 0xffffff, fontSize: 30 }}); it.anchor.set(0.5); it.label = 'icon'; c.addChild(it);
        const nt = new PIXI.Text({ text: '🔊', style: { fill: 0xffffff, fontSize: 30 }}); nt.anchor.set(0.5); nt.label = 'noise'; c.addChild(nt);
        const wbg = new PIXI.Graphics(); wbg.label = 'waterbg'; c.addChild(wbg);
        const wb = new PIXI.Graphics(); wb.label = 'waterbar'; c.addChild(wb);
        return c;
      };
      const resetV = (c: PIXI.Container) => { c.visible = false; c.alpha = 1; };
      vehiclePoolRef.current = new ObjectPool(makeVContainer, resetV, 20);

      const makePContainer = () => new PIXI.Container();
      const resetP = (c: PIXI.Container) => { c.removeChildren(); c.visible = false; };
      projectilePoolRef.current = new ObjectPool(makePContainer, resetP, 30);

      layersRef.current = {
        background: new PIXI.Container(),
        road: new PIXI.Container(),
        entity: new PIXI.Container(),
        particle: new PIXI.Container(),
        effects: new PIXI.Container(),
        foreground: new PIXI.Container(),
        uiAim: new PIXI.Container(),
      };

      app = new PIXI.Application();
      await app.init({
        resizeTo: parent,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        antialias: false,
        backgroundAlpha: 0,
        premultipliedAlpha: false,
      });
      appInitialized = true;

      if (isDestroyed) {
        app.destroy(true, { children: true });
        return;
      }

      parent.appendChild(app.canvas);
      pixiAppRef.current = app;

      const layers = layersRef.current;
      app.stage.addChild(
        layers.background,
        layers.road,
        layers.entity,
        layers.particle,
        layers.effects,
        layers.foreground,
        layers.uiAim
      );

      // WebGL context loss — destroy and re-create the app
      const handleContextLost = (e: Event) => {
        e.preventDefault();
        if (recoveringRef.current) return;
        recoveringRef.current = true;
        if (app?.ticker) app.ticker.stop();
        setRecovering(true);
        setPixiVersion(v => v + 1);
      };
      (app.canvas as HTMLCanvasElement).addEventListener('webglcontextlost', handleContextLost);

      // Load textures directly using native Image API
      const textureUrls: Record<string, string> = {
        bg: '/games/shooter/opera.png',
        car: '/games/shooter/bmw1.png',
        blueCar: '/games/shooter/mercedes1.png',
        bike: '/games/shooter/bike1.png',
        redBike: '/games/shooter/bike2.png',
        wheelFront: '/games/shooter/bmw1_wheel_front.png',
        wheelBack: '/games/shooter/bmw1_wheel_back.png',
        ak47: '/games/shooter/ak47.png',
        ak47_top: '/games/shooter/ak47_top.png',
      };
      const loadedTextures: Record<string, PIXI.Texture> = {};
      for (const [alias, url] of Object.entries(textureUrls)) {
        try {
          const img = new Image();
          img.src = url;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
          });
          loadedTextures[alias] = PIXI.Texture.from(img);
        } catch (e) {
          console.warn(`[Shooter] Failed to load texture: ${url}`, e);
          loadedTextures[alias] = PIXI.Texture.WHITE;
        }
      }
      texturesRef.current = loadedTextures;
      
      if (isDestroyed) return;
      setAssetsLoaded(true);
      if (isDestroyed) return;
      setRecovering(false);
      recoveringRef.current = false;

      // Reusable graphics
      const bgSprite = new PIXI.Sprite(texturesRef.current.bg);
      bgSprite.anchor.set(0.5, 1.0);
      layers.background.addChild(bgSprite);

      const roadGfx = new PIXI.Graphics();
      layers.road.addChild(roadGfx);

      const foregroundGfx = new PIXI.Graphics();
      layers.foreground.addChild(foregroundGfx);

      const ak47TopSprite = new PIXI.Sprite(texturesRef.current.ak47_top);
      ak47TopSprite.anchor.set(0.5, 0.5);
      layers.foreground.addChild(ak47TopSprite);

      const coffeeText = new PIXI.Text({ text: '☕', style: { fill: 0xffffff } });
      const crossText = new PIXI.Text({ text: '🥐', style: { fill: 0xffffff } });
      coffeeText.anchor.set(0.5);
      crossText.anchor.set(0.5);
      layers.foreground.addChild(coffeeText, crossText);

      const aimWeaponSprite = new PIXI.Sprite();
      aimWeaponSprite.anchor.set(0.5, 0.5);
      aimWeaponSprite.visible = false;
      const aimWeaponText = new PIXI.Text({ text: '🔫', style: { fill: 0xffffff, fontSize: 80 } });
      aimWeaponText.anchor.set(0.5, 0.5);
      layers.uiAim.addChild(aimWeaponSprite, aimWeaponText);

      const crosshair = new PIXI.Graphics();
      layers.uiAim.addChild(crosshair);

      let spawnTimer = 3.0;
      let shootTimer = 0;

      // Handle Resize bounds
      const handleResize = () => {
        const w = app.screen.width;
        const h = app.screen.height;
        const cx = w / 2;
        const skyHeight = h * 0.38;
        const sidewalkHeight = Math.min(35, h * 0.05);

        if (bgSprite.texture) {
          const scale = Math.max(w / bgSprite.texture.width, skyHeight / bgSprite.texture.height);
          bgSprite.scale.set(scale);
          bgSprite.x = cx;
          bgSprite.y = skyHeight;
        }

        // Road
        roadGfx.clear();
        roadGfx.rect(0, skyHeight, w, h - sidewalkHeight - skyHeight).fill({ color: 0x555555 });
        for (let i = 0; i < w; i += 80) {
          roadGfx.rect(i, skyHeight + (h - sidewalkHeight - skyHeight) * 0.45, 40, 10).fill({ color: 0xffffff });
        }
        // Sidewalk
        roadGfx.rect(0, h - sidewalkHeight, w, sidewalkHeight).fill({ color: 0x888888 });
        roadGfx.rect(0, h - sidewalkHeight, w, 2).fill({ color: 0xcccccc });

        // Foreground
        foregroundGfx.clear();
        const tableRx = Math.min(200, w * 0.25);
        const tableRy = Math.min(80, h * 0.15);
        foregroundGfx.ellipse(cx, h + tableRy * 0.4, tableRx, tableRy);
        foregroundGfx.fill({ color: 0x8B4513 });

        ak47TopSprite.visible = stateRef.current.weapon === 'ak47';
        if (ak47TopSprite.visible && texturesRef.current.ak47_top) {
          const drawH = tableRy * 1.6;
          ak47TopSprite.height = drawH;
          ak47TopSprite.scale.x = ak47TopSprite.scale.y;
          ak47TopSprite.x = cx;
          ak47TopSprite.y = h + tableRy * 0.4;
        }

        const itemSize = Math.round(tableRy * 0.65);
        const itemY = h - tableRy * 0.3;
        coffeeText.style.fontSize = itemSize;
        coffeeText.x = cx - tableRx * 0.4;
        coffeeText.y = itemY;
        
        crossText.style.fontSize = itemSize;
        crossText.x = cx + tableRx * 0.2;
        crossText.y = itemY;
      };

      app.renderer.on('resize', handleResize);
      handleResize(); // Initial setup

      // Physics/Logic step functions (ported from old game loop)
      const updatePhysics = (dt: number) => {
        const state = stateRef.current;
        if (state.gameOver) return;
        
        const w = app.screen.width;
        const h = app.screen.height;

        state.timeLeft -= dt;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          state.gameOver = true;
          sounds.stopAll();
          setGameState({ ...state });
          if (window.Odesa) (window.Odesa as any).gameOver(state.score);
          return;
        }

        spawnTimer += dt;
        if (spawnTimer > 2.5) {
          spawnTimer = 0;
          spawnVehicle(state, w, h);
        }

        if (state.isShooting) {
          shootTimer += dt;
          const gunY = h - Math.min(50, h * 0.1);
          if (state.weapon === 'water' && shootTimer > 0.05) {
            shootTimer = 0;
            spawnProjectile('water', w / 2, gunY, mouseRef.current.x, mouseRef.current.y);
          } else if (state.weapon === 'ak47' && shootTimer > 0.1) {
            shootTimer = 0;
            spawnProjectile('bullet', w / 2, gunY, mouseRef.current.x + (Math.random()*40-20), mouseRef.current.y + (Math.random()*40-20));
          }
        }

        for (let i = state.projectiles.length - 1; i >= 0; i--) {
          const p = state.projectiles[i];
          const dist = Math.max(10, Math.hypot(p.targetX - p.startX, p.targetY - p.startY));
          p.progress += (p.speed * dt) / dist;
          
          if (p.progress >= 1) {
            p.x = p.targetX;
            p.y = p.targetY;
            handleProjectileHit(p, state);
            projectilePoolRef.current!.release(p.container);
            state.projectiles.splice(i, 1);
            continue;
          }

          if (p.type === 'banana') {
            const dx = p.targetX - p.startX;
            const dy = p.targetY - p.startY;
            p.x = p.startX + dx * p.progress;
            p.y = p.startY + dy * p.progress - Math.sin(p.progress * Math.PI) * 150;
            if (handleProjectileHit(p, state)) {
              projectilePoolRef.current!.release(p.container);
              state.projectiles.splice(i, 1);
              continue;
            }
          } else {
            p.x = p.startX + (p.targetX - p.startX) * p.progress;
            p.y = p.startY + (p.targetY - p.startY) * p.progress;
          }
        }

        state.vehicles.forEach(v => {
          if (v.status === 'banana-stopped' || v.status === 'exploded') {
            v.speed = 0;
            v.speedBoost = 0;
            v.opacity -= dt * 0.5;
          } else if (v.status === 'watered') {
            v.speed = Math.max(20, v.speed - 100 * dt);
            v.speedBoost = 0;
            v.opacity -= dt * 0.5;
          }

          if (v.isNoisy && v.status === 'normal') {
            if (v.speedBoost > 0) {
              v.speedBoost -= dt;
              if (v.speedBoost <= 0) {
                v.speed = v.originalSpeed;
                v.speedBoost = 0;
              }
            } else if (Math.random() < 0.008) {
              v.speedBoost = 0.6 + Math.random() * 0.6;
              v.speed = v.originalSpeed * (1.6 + Math.random() * 0.6);
            }
          }
          
          v.x += v.speed * v.direction * dt;

          // Vehicle collision avoidance
          if (v.status === 'normal') {
            for (const other of state.vehicles) {
              if (other === v || other.status !== 'normal' || other.lane !== v.lane || other.direction !== v.direction) continue;
              const gap = v.direction === 1 ? other.x - v.x : v.x - other.x;
              const safeGap = (v.width + other.width) / 2 + 20;
              if (gap > 0 && gap < safeGap * 3) {
                const t = Math.max(0, gap / (safeGap * 3));
                v.speed = Math.max(v.speed - 300 * dt * (1 - t * 0.9), 15);
              } else if (gap < 0 && -gap < safeGap * 3) {
                const t = Math.max(0, -gap / (safeGap * 3));
                v.speed = Math.min(v.speed + 200 * dt * (1 - t * 0.9), v.originalSpeed * 1.5);
              }
            }
          }

          const isOnScreen = v.x > -v.width && v.x < w + v.width;
          
          if (v.isNoisy && v.status === 'normal' && isOnScreen) {
            sounds.startEngine(v.id, v.type);
          } else {
            sounds.stopEngine(v.id);
          }

          if (!v.isNoisy && !v.isSilent && v.status === 'normal' && isOnScreen && Math.random() < 0.005) {
            sounds.playCarEngine();
          }
        });

        state.vehicles = state.vehicles.filter(v => 
          v.opacity > 0 &&
          ((v.direction === 1 && v.x < w + 200) || 
           (v.direction === -1 && v.x > -200))
        );
        sounds.pruneEngines(new Set(state.vehicles.map(v => v.id)));

        state.particles.forEach(p => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
        });
        state.particles = state.particles.filter(p => p.life > 0);

        sounds.setScore(state.silenceLevel);
        const _t = TRANSLATIONS[langRef.current];
        if (scoreRef.current) scoreRef.current.innerText = `${_t.score}: ${Math.floor(state.score)}`;
        if (noiseBarRef.current) noiseBarRef.current.style.width = `${Math.max(0, Math.min(100, 100 - state.silenceLevel))}%`;
        if (timeRef.current) timeRef.current.innerText = `${Math.ceil(state.timeLeft)}`;
      };

      const syncVisuals = (dt: number) => {
        const state = stateRef.current;
        const w = app.screen.width;
        const h = app.screen.height;

        // Sync Vehicles (pooled)
        const vPool = vehiclePoolRef.current;
        const usedV = new Set<PIXI.Container>();
        state.vehicles.forEach(v => {
          let vContainer = visualsRef.current.get(v.id);
          if (!vContainer) {
            vContainer = vPool!.acquire();
            layers.entity.addChild(vContainer);
            visualsRef.current.set(v.id, vContainer);
          }
          usedV.add(vContainer);

          vContainer.x = v.x;
          vContainer.y = v.y;
          vContainer.alpha = Math.max(0, v.opacity);
          
          const body = vContainer.getChildByLabel('body') as PIXI.Sprite;
          const textureMap: any = {
            motorcycle: { true: 'redBike', false: 'bike' },
            car: { true: 'blueCar', false: 'car' }
          };
          const texAlias = textureMap[v.type][String(v.isNoisy)] || 'car';
          body.texture = texturesRef.current[texAlias];
          
          let drawH = 0, drawW = 0;
          if (body.texture) {
            drawH = v.type === 'motorcycle' ? 63 : 60;
            drawW = body.texture.width * (drawH / body.texture.height);
            body.width = drawW;
            body.height = drawH;
            
            body.scale.x = Math.abs(body.scale.x) * (v.direction === 1 ? -1 : 1);

            const wheelFront = vContainer.getChildByLabel('wheelFront') as PIXI.Sprite;
            const wheelRear = vContainer.getChildByLabel('wheelRear') as PIXI.Sprite;
            if (texAlias === 'car') {
              wheelFront.texture = texturesRef.current.wheelFront;
              wheelRear.texture = texturesRef.current.wheelBack;
              wheelFront.visible = true;
              wheelRear.visible = true;
            } else {
              wheelFront.texture = PIXI.Texture.EMPTY;
              wheelRear.texture = PIXI.Texture.EMPTY;
            }
            if (texAlias === 'car') {
              const carTex = texturesRef.current.car;
              const wheelScale = drawH / Math.max(carTex.height, 1);
              wheelFront.scale.set(wheelScale);
              wheelRear.scale.set(wheelScale);
            }
            const frontFracX = v.type === 'car' ? 0.17 : 0.10;
            const rearFracX = v.type === 'car' ? 0.79 : 0.90;
            const wheelFracY = 0.80;
            const frontCenterX = (frontFracX - 0.5) * drawW;
            const rearCenterX = (rearFracX - 0.5) * drawW;
            const wheelCenterY = (wheelFracY - 0.5) * drawH;
            wheelFront.x = frontCenterX * (v.direction === 1 ? -1 : 1);
            wheelFront.y = wheelCenterY;
            wheelRear.x = (rearCenterX + 1) * (v.direction === 1 ? -1 : 1);
            wheelRear.y = wheelCenterY - 2;
            wheelFront.rotation += v.speed * dt * 0.04 * v.direction;
            wheelRear.rotation += v.speed * dt * 0.04 * v.direction;
          }

          const icon = vContainer.getChildByLabel('icon') as PIXI.Text;
          const bananaUp = v.type === 'motorcycle' ? 20 : 10;
          if (v.status === 'banana-stopped') {
            icon.text = '🍌'; icon.style.fontSize = 30;
            icon.x = (v.direction === 1 ? -1 : 1) * (drawW / 2 + 5);
            icon.y = drawH / 2 - bananaUp;
          } else if (v.status === 'exploded') {
            icon.text = '💥'; icon.style.fontSize = 50; icon.y = -20;
          } else if (v.bananaHits > 0) {
            icon.text = '🍌'; icon.style.fontSize = 24;
            icon.x = (v.direction === 1 ? -1 : 1) * drawW / 2;
            icon.y = drawH / 2 - bananaUp;
          } else {
            icon.text = '';
          }

          const noise = vContainer.getChildByLabel('noise') as PIXI.Text;
          if (v.isNoisy && v.status === 'normal') {
            noise.visible = true;
            noise.y = -40;
            noise.x = v.direction === -1 ? -15 : 15;
            noise.scale.x = v.direction === -1 ? -1 : 1;
          } else {
            noise.visible = false;
          }
          
          const waterBg = vContainer.getChildByLabel('waterbg') as PIXI.Graphics;
          const waterBar = vContainer.getChildByLabel('waterbar') as PIXI.Graphics;
          if (v.waterLevel > 0 && v.status === 'normal') {
            waterBg.visible = waterBar.visible = true;
            waterBg.clear().rect(-v.width/2, -v.height/2 - 20, v.width, 8).fill({ color: 0x000000, alpha: 0.6 });
            waterBar.clear().rect(-v.width/2, -v.height/2 - 20, v.width * (v.waterLevel / 100), 8).fill({ color: 0x00BFFF });
          } else {
            waterBg.visible = waterBar.visible = false;
          }
        });

        for (const [id, c] of visualsRef.current.entries()) {
          if (!usedV.has(c)) {
            layers.entity.removeChild(c);
            vPool!.release(c);
            visualsRef.current.delete(id);
          }
        }

        // Sync Projectiles (pooled)
        state.projectiles.forEach(p => {
          p.container.visible = true;
          p.container.x = p.x;
          p.container.y = p.y;
          if (p.type === 'banana') {
            p.container.rotation = p.progress * Math.PI * 8;
          } else if (p.type === 'bullet') {
            p.container.rotation = Math.atan2(p.targetY - p.startY, p.targetX - p.startX);
          } else {
            p.container.rotation = 0;
          }
        });

        // Sync Particles (batched single Graphics)
        let batchP = particleGfxRef.current;
        if (!batchP) {
          batchP = new PIXI.Graphics();
          layers.particle.addChild(batchP);
          particleGfxRef.current = batchP;
        }
        batchP.clear();
        state.particles.forEach(p => {
          batchP!.circle(p.x, p.y, p.size).fill({ color: p.color as any, alpha: Math.max(0, p.life / p.maxLife) });
        });

        // Crosshair & Aim weapon
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const cx = w / 2;
        const gunY = h - Math.min(50, h * 0.1);

        crosshair.clear();
        crosshair.circle(mx, my, 20).stroke({ 
          width: 3, 
          color: state.weapon === 'water' ? 0x00FFFF : state.weapon === 'banana' ? 0xFFFF00 : 0xFF0000 
        });
        crosshair.moveTo(mx - 30, my).lineTo(mx + 30, my);
        crosshair.moveTo(mx, my - 30).lineTo(mx, my + 30);
        crosshair.stroke();

        const angle = Math.atan2(Math.min(my - gunY, 0), mx - cx);
        aimWeaponSprite.x = cx;
        aimWeaponSprite.y = gunY;
        aimWeaponText.x = cx;
        aimWeaponText.y = gunY;

        if (state.weapon === 'ak47') {
          aimWeaponText.visible = false;
          aimWeaponSprite.visible = true;
          aimWeaponSprite.texture = texturesRef.current.ak47;
          if (aimWeaponSprite.texture) {
            const drawH = 40;
            aimWeaponSprite.height = drawH;
            aimWeaponSprite.scale.x = aimWeaponSprite.scale.y;
          }
          aimWeaponSprite.rotation = angle;
          aimWeaponSprite.scale.y = Math.abs(aimWeaponSprite.scale.y) * (mx < cx ? -1 : 1);
        } else if (state.weapon === 'water') {
          aimWeaponSprite.visible = false;
          aimWeaponText.visible = true;
          aimWeaponText.rotation = angle + Math.PI;
          aimWeaponText.scale.y = mx > cx ? -1 : 1;
        } else {
          aimWeaponSprite.visible = false;
          aimWeaponText.visible = false;
        }
      };

      // Ticker Loop
      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000;
        const running = startedRef.current && !pausedRef.current;
        if (running) {
          updatePhysics(dt);
        }
        syncVisuals(running ? dt : 0);
      });
      app.ticker.maxFPS = 60;

    })();

    return () => {
      sounds.stopAll();
      isDestroyed = true;
      pixiAppRef.current = null;
      vehiclePoolRef.current?.destroyAll(c => c.destroy());
      vehiclePoolRef.current = null;
      projectilePoolRef.current?.destroyAll(c => c.destroy());
      projectilePoolRef.current = null;
      if (app) {
        if (appInitialized) {
          try {
            app.destroy(true, { children: true });
          } catch (e) {
            console.warn('[Shooter] Error destroying Pixi app:', e);
          }
        } else {
          try {
            (app as any).renderer?.destroy(true);
          } catch {}
        }
      }
    };
  }, [pixiVersion]);

  const spawnVehicle = (state: GameState, w: number, h: number) => {
    const isNoisy = state.vehicles.length === 0 ? true : Math.random() > 0.5;
    const isSilent = !isNoisy && Math.random() > 0.5;
    const isMotorcycle = Math.random() > 0.5;
    
    const skyHeight = h * 0.38;
    const sidewalkHeight = Math.min(35, h * 0.05);
    const streetHeight = h - sidewalkHeight - skyHeight;

    const laneCenters = [
      skyHeight + streetHeight * 0.2,
      skyHeight + streetHeight * 0.7
    ];

    const active = state.vehicles.filter(v => v.status === 'normal');

    // Helper function to check if a vehicle type is too close to spawn point in a lane
    const isTooClose = (lane: number, type: 'car' | 'motorcycle', spawnX: number, threshold: number = 200): boolean => {
        return active.some(v => 
            v.lane === lane && 
            v.type === type && 
            Math.abs(v.x - spawnX) < threshold
        );
    };

    const firstLane = Math.random() > 0.5 ? 0 : 1;
    const lanes = [firstLane, firstLane === 0 ? 1 : 0];

    let lane = -1;
    for (const l of lanes) {
        const dir = l === 0 ? 1 : -1;
        const spawnX = dir === 1 ? -100 : w + 100;
        if (isMotorcycle) {
            // Check if lane is clear for motorcycle: no bikes too close, no cars too close (exclusivity)
            if (!isTooClose(l, 'motorcycle', spawnX, 150) && !isTooClose(l, 'car', spawnX, 200)) {
                lane = l; 
                break; 
            }
        } else {
            // Check if lane is clear for car: no cars too close, no bikes too close (exclusivity)
            if (!isTooClose(l, 'car', spawnX, 150) && !isTooClose(l, 'motorcycle', spawnX, 200)) {
                lane = l; 
                break; 
            }
        }
    }

    if (lane === -1) return;

    const direction = lane === 0 ? 1 : -1;

    let y = laneCenters[lane];
    const bikesInThisLane = active.filter(v => v.lane === lane && v.type === 'motorcycle').length;
    if (isMotorcycle) {
      const side = bikesInThisLane % 2 === 0 ? -1 : 1;
      const tier = Math.floor(bikesInThisLane / 2);
      y += side * (12 + tier * 8);
    }

    const speed = (isNoisy ? 150 : 80) + Math.random() * 50;
    state.vehicles.push({
      id: Math.random().toString(),
      x: direction === 1 ? -100 : w + 100,
      y,
      width: isMotorcycle ? 60 : 100,
      height: isMotorcycle ? 40 : 50,
      speed,
      originalSpeed: speed,
      speedBoost: 0,
      type: isMotorcycle ? 'motorcycle' : 'car',
      isNoisy,
      isSilent,
      status: 'normal',
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      direction,
      waterLevel: 0,
      opacity: 1,
      bananaHits: 0,
      lane: lane as 0 | 1
    });
    if (isMotorcycle) sounds.playMotorcycleWizz();
    else sounds.playCarPassing();
  };

  const spawnProjectile = (type: string, startX: number, startY: number, targetX: number, targetY: number) => {
    const state = stateRef.current;
    const container = projectilePoolRef.current!.acquire();
    container.visible = false;
    container.rotation = 0;
    layersRef.current.entity.addChild(container);
    if (type === 'water') {
      const g = new PIXI.Graphics();
      g.circle(0, 0, 4).fill({ color: 0x00BFFF });
      container.addChild(g);
    } else if (type === 'bullet') {
      const g = new PIXI.Graphics();
      g.rect(-5, -2, 10, 4).fill({ color: 0xFFD700 });
      container.addChild(g);
    } else if (type === 'banana') {
      const t = new PIXI.Text({ text: '🍌', style: { fontSize: 30 }});
      t.anchor.set(0.5);
      container.addChild(t);
    }
    state.projectiles.push({
      id: Math.random().toString(),
      x: startX,
      y: startY,
      startX,
      startY,
      targetX,
      targetY,
      progress: 0,
      speed: type === 'banana' ? 800 : type === 'bullet' ? 2000 : 1500,
      type: type as any,
      container,
    });
    if (type === 'banana') sounds.playBananaThrow();
    else if (type === 'bullet') sounds.playAK47();
    else if (type === 'water' && Math.random() > 0.8) sounds.playWater();
  };

  const handleProjectileHit = (p: Projectile, state: GameState) => {
    let hitSomething = false;
    for (let i = state.vehicles.length - 1; i >= 0; i--) {
      const v = state.vehicles[i];
      const halfW = p.type === 'banana' ? 25 : (v.width / 2) + 40;
      const halfH = p.type === 'banana' ? 25 : (v.height / 2) + 40;
      
      const tailX = v.x + (v.direction === 1 ? -v.width / 2 : v.width / 2);
      const hitX = p.type === 'banana' ? tailX : p.x;
      const hitY = p.type === 'banana' ? v.y + v.height / 2 : p.y;
      const centerX = p.type === 'banana' ? tailX : v.x;
      const centerY = p.type === 'banana' ? v.y + v.height / 2 : v.y;
      
      if (p.x >= centerX - halfW && p.x <= centerX + halfW && p.y >= centerY - halfH && p.y <= centerY + halfH) {
        if (v.status !== 'normal') continue;

        hitSomething = true;
        if (v.isNoisy) {
          if (p.type === 'water') {
            v.waterLevel += 20;
            if (v.waterLevel >= 100) {
              v.status = 'watered';
              state.score += 1;
              createParticles(state, v.x, v.y, 'water');
            } else {
              createParticles(state, p.x, p.y, 'water');
            }
          } else if (p.type === 'banana') {
            v.bananaHits += 1;
            if (v.bananaHits >= 2) {
              v.status = 'banana-stopped';
              state.score += 1;
              createParticles(state, hitX, hitY, 'banana');
              sounds.playBananaHit();
            } else {
              createParticles(state, hitX, hitY, 'banana');
              sounds.playBananaHit();
            }
          } else if (p.type === 'bullet') {
            v.status = 'exploded';
            state.score += 1;
            createParticles(state, v.x, v.y, 'explosion');
            sounds.playExplosion();
          }
        } else {
          state.score = Math.max(0, state.score - 2);
          sounds.playError();
          if (p.type === 'water') {
            v.waterLevel += 20;
            if (v.waterLevel >= 100) v.status = 'watered';
            createParticles(state, p.x, p.y, 'water');
          } else if (p.type === 'banana') {
            v.bananaHits += 1;
            if (v.bananaHits >= 2) v.status = 'banana-stopped';
            createParticles(state, hitX, hitY, 'banana');
          } else if (p.type === 'bullet') {
            v.status = 'exploded';
            createParticles(state, p.x, p.y, 'explosion');
            sounds.playExplosion();
          }
        }
        break;
      }
    }

    if (!hitSomething) {
      createParticles(state, p.x, p.y, p.type === 'water' ? 'water' : p.type === 'banana' ? 'banana' : 'explosion');
    }
    return hitSomething;
  };

  const createParticles = (state: GameState, x: number, y: number, type: 'water' | 'explosion' | 'banana') => {
    const count = type === 'explosion' ? 50 : type === 'water' ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (type === 'explosion' ? 200 : 100);
      state.particles.push({
        id: Math.random().toString(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: type === 'explosion' ? 1.0 : 0.5,
        maxLife: type === 'explosion' ? 1.0 : 0.5,
        color: type === 'water' ? '#00BFFF' : type === 'banana' ? '#FFD700' : (Math.random() > 0.5 ? '#FF4500' : '#FFD700'),
        size: Math.random() * (type === 'explosion' ? 8 : 4) + 2,
        type
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stateRef.current.gameOver) return;
    sounds.init();
    handlePointerMove(e);
    const state = stateRef.current;
    state.isShooting = true;

    if (state.weapon === 'banana') {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const w = pixiAppRef.current?.screen.width || window.innerWidth;
      const h = pixiAppRef.current?.screen.height || window.innerHeight;
      const gunY = h - Math.min(50, h * 0.1);
      spawnProjectile('banana', w / 2, gunY, mx, my);
    }
    setGameState({ ...state });
  };

  const handlePointerUp = () => {
    const state = stateRef.current;
    state.isShooting = false;
    setGameState({ ...state });
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden touch-none"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="fixed inset-0 z-[100] hidden portrait:flex flex-col items-center justify-center bg-black text-white p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">{t.rotateDevice}</h2>
        <p className="text-xl opacity-80">{t.rotateDesc}</p>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 md:-translate-x-0 md:left-4 p-2 px-4 bg-black/60 rounded-xl backdrop-blur-sm border border-white/20 select-none pointer-events-none flex flex-col items-center min-w-[120px]">
        <p ref={scoreRef} className="text-xl font-bold text-yellow-400 tracking-wider pt-1">{t.score}: {Math.floor(gameState.score)}</p>
        <div className="w-full h-1 bg-gray-700 rounded overflow-hidden mt-1 opacity-80" title={t.noiseLevel}>
          <div ref={noiseBarRef} className="h-full bg-red-400" style={{ width: `${Math.max(0, Math.min(100, 100 - gameState.silenceLevel))}%` }} />
        </div>
      </div>

      <div className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center bg-black/60 rounded-full backdrop-blur-sm border border-white/20 select-none pointer-events-none">
        <p ref={timeRef} className="text-xl font-bold text-white pt-1">{Math.ceil(gameState.timeLeft)}</p>
      </div>

      {gameState.gameOver && (
        <GameEndScreen
          score={gameState.score}
          imageSrc="/games/shooter/bike1.png"
          title={{ win: t.gameOver, lose: t.gameOver }}
          subtitle={t.finalScore}
          onPlayAgain={resetGame}
          onQuit={() => window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, window.location.origin)}
          t={{ playAgain: t.playAgain, tryAgain: t.playAgain }}
        />
      )}

      {paused && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="text-white text-5xl font-black tracking-widest drop-shadow-lg select-none">PAUSED</div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex gap-2 pointer-events-auto z-10">
        <button 
          onPointerDown={(e) => { e.stopPropagation(); stateRef.current.weapon = 'water'; setGameState({...stateRef.current}); sounds.init(); sounds.playUnlock(); }}
          className={`px-3 py-2 rounded-lg border-2 flex items-center justify-center transition-all ${
            gameState.weapon === 'water' ? 'bg-blue-500/80 border-blue-300 transform scale-110' : 'bg-black/50 border-white/20 hover:bg-black/70'
          }`}
          title={t.waterGun}
        >
          <Droplet className={gameState.weapon === 'water' ? 'text-white' : 'text-blue-300'} size={20} />
        </button>
        
        <button 
          onPointerDown={(e) => { e.stopPropagation(); stateRef.current.weapon = 'banana'; setGameState({...stateRef.current}); sounds.init(); sounds.playUnlock(); }}
          className={`px-3 py-2 rounded-lg border-2 flex items-center justify-center transition-all ${
            gameState.weapon === 'banana' ? 'bg-yellow-500/80 border-yellow-300 transform scale-110' : 'bg-black/50 border-white/20 hover:bg-black/70'
          }`}
          title={t.banana}
        >
          <Banana className={gameState.weapon === 'banana' ? 'text-white' : 'text-yellow-300'} size={20} />
        </button>
        
        <button 
          onPointerDown={(e) => { 
            e.stopPropagation();
            sounds.init();
            if (isPaidUser) {
              stateRef.current.weapon = 'ak47'; setGameState({...stateRef.current}); sounds.playUnlock();
            } else {
              showToast(t.paidOnlyAlert);
            }
          }}
          className={`px-3 py-2 rounded-lg border-2 flex items-center justify-center transition-all ${
            gameState.weapon === 'ak47' ? 'bg-red-500/80 border-red-300 transform scale-110' : 'bg-black/50 border-white/20 hover:bg-black/70'
          } ${!isPaidUser ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
          title={isPaidUser ? t.ak47 : t.locked}
        >
          <img src="/games/shooter/ak47.png" className={`w-5 h-5 object-contain ${gameState.weapon === 'ak47' ? '' : 'opacity-60 grayscale'}`} alt="AK-47" />
        </button>
      </div>

      {!started && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-50 pointer-events-auto">
          <h1 className="text-6xl font-bold mb-4">{t.title}</h1>
          <p className="text-xl mb-8 opacity-80">{t.subtitle}</p>
          {assetsLoaded ? (
            <button 
              onPointerDown={() => {
                sounds.init();
                sounds.startBackground();
                startedRef.current = true;
                setStarted(true);
                window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, window.location.origin);
              }} 
              className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl text-2xl font-bold transition-all hover:scale-105"
            >
              {t.play}
            </button>
          ) : (
            <div className="px-8 py-4 bg-gray-500 text-black rounded-xl text-2xl font-bold">
              Loading Assets...
            </div>
          )}
        </div>
      )}

      {recovering && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-50">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-2xl font-bold">{t.restoring}</p>
        </div>
      )}
    </div>
  );
}
