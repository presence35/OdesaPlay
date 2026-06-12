import React, { useEffect, useRef, useState } from 'react';
import { Play, Crosshair } from 'lucide-react';
import GameEndScreen from '../GameEndScreen';
import { TRANSLATIONS, Lang } from './translations';
import { motion, AnimatePresence } from 'motion/react';
import * as PIXI from 'pixi.js';
import { getAudioContext, resumeAudioContext } from '../../utils/audioContext';
import { ObjectPool } from '../../utils/objectPool';
import LoadingTrident from '../../components/LoadingTrident';

type GameState = 'menu' | 'playing' | 'gameover';
interface Enemy { id: number; x: number; y: number; vx: number; vy: number; width: number; height: number; sprite: PIXI.Sprite; }
interface Missile {
  id: number; startX: number; startY: number; targetX: number; targetY: number;
  x: number; y: number; vx: number; vy: number; speed: number;
  state: 'flying' | 'exploding'; radius: number; maxRadius: number; explodeSpeed: number; hits?: number;
  gfx: PIXI.Graphics;
}
interface Particle { id: string; x: number; y: number; vx: number; vy: number; life: number; decay: number; color: string; }
interface FloatingText { id: string; text: string; x: number; y: number; life: number; textObj: PIXI.Text; }

let _soundEnabled = true;
let audioCtx: AudioContext | null = null;
const playSound = (type: 'shoot' | 'explosion' | 'hit', muted?: boolean, volMult = 1) => {
  if (muted || !_soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = getAudioContext();
    resumeAudioContext();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    const vol = 0.15 * volMult;
    
    if (type === 'shoot') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gainNode.gain.setValueAtTime(vol * 1.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'explosion') {
       const oscLow = audioCtx.createOscillator();
       const gainLow = audioCtx.createGain();
       oscLow.type = 'sine';
       oscLow.frequency.setValueAtTime(30, now);
       gainLow.gain.setValueAtTime(vol * 2.0, now);
       gainLow.gain.exponentialRampToValueAtTime(0.0003, now + 1.5);
       oscLow.connect(gainLow);
       gainLow.connect(audioCtx.destination);
       oscLow.start(now);
       oscLow.stop(now + 1.5);

       osc.type = 'sawtooth';
       osc.frequency.setValueAtTime(250, now);
       osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
       gainNode.gain.setValueAtTime(vol * 2.0, now);
       gainNode.gain.exponentialRampToValueAtTime(0.002, now + 0.5);
       osc.start(now);
       osc.stop(now + 0.5);
    } else if (type === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gainNode.gain.setValueAtTime(vol * 0.8, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {}
};

const triggerHaptic = (type: 'light' | 'heavy') => {
  if (!navigator.vibrate) return;
  try { navigator.vibrate(type === 'light' ? 10 : 30); } catch {}
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const gameStateRef = useRef(gameState);
  const [finalScore, setFinalScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [splashItems, setSplashItems] = useState<any[]>([]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const [lang, setLang] = useState<Lang>('uk');
  const [isReady, setIsReady] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy'|'hard'>('easy');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [recovering, setRecovering] = useState(false);
  const recoveringRef = useRef(false);
  const [pixiVersion, setPixiVersion] = useState(0);

  useEffect(() => {
    if (window.Odesa?.getConfig) {
      const config = window.Odesa.getConfig();
      if (config) {
        setLang(config.lang === 'uk' ? 'uk' : 'en');
        setIsMuted(!(config.sound !== false && config.sfxEnabled !== false));
        if (config.splashItems) setSplashItems(config.splashItems);
      }
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (window.Odesa) {
      if (window.Odesa.onConfig) {
        window.Odesa.onConfig((config: any) => {
          setLang(config.lang === 'uk' ? 'uk' : 'en');
          setIsMuted(!(config.sound !== false && config.sfxEnabled !== false));
          if (typeof config.sfxEnabled === 'boolean') _soundEnabled = config.sfxEnabled;
          if (config.splashItems) setSplashItems(config.splashItems);
        });
      }
      const stopHandler = () => {
        const finalScore = game.current.score;
        setFinalScore(finalScore);
        setGameState('gameover');
        if (window.Odesa?.gameOver) window.Odesa.gameOver(finalScore);
        else if (window.Odesa?.saveScore) window.Odesa.saveScore(finalScore);
      };
      if (window.Odesa.onStop) {
        window.Odesa.onStop(stopHandler);
      }
      if (window.Odesa.ready) window.Odesa.ready();
      if (window.Odesa.onPause) {
        window.Odesa.onPause(() => {
          if (gameStateRef.current === 'playing') {
            pausedRef.current = true;
            setPaused(true);
          }
        });
      }
      if (window.Odesa.onResume) {
        window.Odesa.onResume(() => {
          if (pausedRef.current) {
            pausedRef.current = false;
            setPaused(false);
          }
        });
      }
      return () => {
        if ((window.Odesa as any)?._removeStopListener) {
          (window.Odesa as any)._removeStopListener(stopHandler);
        }
      };
    }
  }, []);

      const game = useRef({
    score: 0, health: 100, ammo: 40, wave: 1, dronesInWave: 10, dronesSpawned: 0,
    enemies: [] as Enemy[], missiles: [] as Missile[], particles: [] as Particle[],
    lastTime: 0, startTime: 0, nextSpawn: 0, enemySpeedMultiplier: 1, missileCount: 0, enemyCount: 0,
    screenShake: 0, muted: false, difficulty: 'easy' as 'easy'|'hard', currentLang: 'uk' as Lang,
    flashRed: 0, waveFlashTimer: 2000, lowAmmoTimer: 0,
    floatingTexts: [] as FloatingText[],
    stars: Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(), size: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.8 + 0.2
    })),
    gameOverReported: false
  });

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    game.current.muted = isMuted;
    game.current.currentLang = lang;
    game.current.difficulty = difficulty;
  }, [isMuted, lang, difficulty]);

  const startGame = () => {
    const now = performance.now();
    let startWave = 1, startScore = 0;
    try {
      const lastActiveStr = localStorage.getItem('lastActiveTime');
      const wave3ScoreStr = localStorage.getItem('wave3Score');
      if (lastActiveStr && wave3ScoreStr) {
        const lastActive = parseInt(lastActiveStr, 10);
        if (Date.now() - lastActive < 60 * 1000) {
          startWave = 3; startScore = parseInt(wave3ScoreStr, 10) || 0;
        } else {
          localStorage.removeItem('wave3Score');
        }
      }
    } catch (e) {}

    const initialDrones = startWave === 1 ? 10 : 10 + Math.floor(startWave * 3);
    const initialAmmo = initialDrones * (difficulty === 'hard' ? 1.5 : 3);
    const timeOffset = (startWave - 1) * 30000;
    
    game.current = {
      ...game.current, score: startScore, health: 100, ammo: initialAmmo, wave: startWave,
      dronesInWave: initialDrones, dronesSpawned: 0, enemies: [], missiles: [], particles: [],
      lastTime: now, startTime: now - timeOffset, nextSpawn: now + 2200, enemySpeedMultiplier: 1,
      missileCount: 0, enemyCount: 0, screenShake: 0, flashRed: 0, waveFlashTimer: 2000, lowAmmoTimer: 0, floatingTexts: [],
      gameOverReported: false,
    };
    setGameState('playing');
    if (window.parent) window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, window.location.origin);
  };

  // Pixi state
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  
  // Drone texture cache
  const droneTextureRef = useRef<PIXI.Texture | null>(null);
  
  // Object pools
  const enemyPoolRef = useRef<ObjectPool<PIXI.Sprite> | null>(null);
  const missilePoolRef = useRef<ObjectPool<PIXI.Graphics> | null>(null);
  const textPoolRef = useRef<ObjectPool<PIXI.Text> | null>(null);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const parent = containerRef.current;
    if (!parent) return;

    let app = new PIXI.Application();
    let isDestroyed = false;

    (async () => {
      let initErr: any;
      try {
        await app.init({
          resizeTo: parent,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          antialias: false,
          backgroundAlpha: 1,
          backgroundColor: 0x0f172a,
        });
      } catch (e) {
        initErr = e;
      }
      if (!initErr) {
        if (isDestroyed) { app.destroy(true, { children: true }); return; }
      } else {
        app = new PIXI.Application();
        await app.init({
          resizeTo: parent,
          preference: 'canvas',
          backgroundAlpha: 1,
          backgroundColor: 0x0f172a,
        });
        if (isDestroyed) { app.destroy(true, { children: true }); return; }
      }
      parent.appendChild(app.canvas);
      pixiAppRef.current = app;

      const layers = {
        bg: new PIXI.Container(),
        stars: new PIXI.Container(),
        entity: new PIXI.Container(),
        particles: new PIXI.Container(),
        overlay: new PIXI.Container(),
        ui: new PIXI.Container()
      };
      app.stage.addChild(layers.bg, layers.stars, layers.entity, layers.particles, layers.overlay, layers.ui);

      // Pre-generate Drone texture
      const droneGfx = new PIXI.Graphics();
      const hw = 30 * 0.8;
      const hh = 30 * 0.8;
      droneGfx.rect(-hw * 0.15, -hh - 4, hw * 0.3, 4).fill({ color: 0x4b5563 });
      droneGfx.ellipse(0, -hh - 3, hw * 0.6, 1.5).fill({ color: 0x9ca3af }).stroke({ color: 0x374151, width: 0.5 });
      // Wings
      droneGfx.moveTo(0, hh).lineTo(-hw, -hh + 5).lineTo(0, -hh).closePath().fill({ color: 0xd52b1e }).stroke({ color: 0x111827, width: 1 });
      droneGfx.moveTo(0, hh).lineTo(hw, -hh + 5).lineTo(0, -hh).closePath().fill({ color: 0xffffff }).stroke({ color: 0x111827, width: 1 });
      // Body
      droneGfx.ellipse(0, -hh * 0.1, hw * 0.25, hh * 0.9).fill({ color: 0x0039a6 }).stroke({ color: 0x111827, width: 1 });
      // Front
      droneGfx.ellipse(0, hh - 4, hw * 0.15, hh * 0.3).fill({ color: 0x002a7a });
      
      droneTextureRef.current = app.renderer.generateTexture(droneGfx);
      if (!droneTextureRef.current) droneTextureRef.current = PIXI.Texture.EMPTY;

      const w = app.screen.width;
      const h = app.screen.height;

      // Pre-render static background (stars + ground) to texture — eliminates 62 redraw calls/frame
      const bgGfx = new PIXI.Graphics();
      bgGfx.rect(0, h - 60, w, 60).fill({ color: 0xeab308 });
      for (const star of game.current.stars) {
        bgGfx.circle(star.x * w, star.y * (h - 60), star.size).fill({ color: 0xffffff, alpha: star.alpha });
      }
      const bgContainer = new PIXI.Container();
      bgContainer.addChild(bgGfx);
      const bgTexture = PIXI.RenderTexture.create({ width: w, height: h });
      app.renderer.render({ container: bgContainer, target: bgTexture });
      layers.bg.addChild(new PIXI.Sprite(bgTexture));

      // Truck (kept as Graphics — only ~20 draw calls per frame)
      const truckContainer = new PIXI.Container();
      const gunMount = new PIXI.Graphics();
      truckContainer.addChild(gunMount);
      layers.bg.addChild(truckContainer);

      // Overlays
      const flashRedGfx = new PIXI.Graphics();
      layers.overlay.addChild(flashRedGfx);

      // UI
      const uiScore = new PIXI.Text({ text: '', style: { fill: 0xffffff, fontSize: 24, fontWeight: '700', dropShadow: { blur: 4 } }});
      const ruFlag = new PIXI.Graphics();
      const uiAmmo = new PIXI.Text({ text: '', style: { fill: 0x0057b7, fontSize: 28, fontWeight: '700' }});
      const uiHealthBar = new PIXI.Graphics();
      
      const waveText = new PIXI.Text({ text: '', style: { fill: 0xfcd34d, fontSize: 48, fontWeight: '900', align: 'center', dropShadow: { blur: 10 } }});
      waveText.anchor.set(0.5);
      const waveSub = new PIXI.Text({ text: '', style: { fill: 0xffffff, fontSize: 24, fontWeight: '700', align: 'center' }});
      waveSub.anchor.set(0.5);
      
      const outOfAmmoText = new PIXI.Text({ text: '', style: { fill: 0xef4444, fontSize: 24, fontWeight: '900', align: 'center', dropShadow: { blur: 4 } }});
      outOfAmmoText.anchor.set(0.5);

      layers.ui.addChild(ruFlag, uiScore, uiAmmo, uiHealthBar, waveText, waveSub, outOfAmmoText);

      // Low ammo pill shape
      const lowAmmoPill = new PIXI.Graphics();
      const lowAmmoText = new PIXI.Text({ text: '', style: { fill: 0xffffff, fontSize: 20, fontWeight: '900', align: 'center' }});
      lowAmmoText.anchor.set(0.5);
      layers.ui.addChild(lowAmmoPill, lowAmmoText);

      // Object pools (eliminate GC churn from create/destroy cycles)
      enemyPoolRef.current = new ObjectPool<PIXI.Sprite>(
        () => { const s = new PIXI.Sprite(droneTextureRef.current || PIXI.Texture.EMPTY); s.anchor.set(0.5); layers.entity.addChild(s); s.visible = false; return s; },
        () => {},
        30
      );
      missilePoolRef.current = new ObjectPool<PIXI.Graphics>(
        () => { const g = new PIXI.Graphics(); layers.entity.addChild(g); g.visible = false; return g; },
        (g) => g.clear(),
        20
      );
      textPoolRef.current = new ObjectPool<PIXI.Text>(
        () => {
          const t = new PIXI.Text({ text: '', style: { fill: 0xef4444, fontSize: 24, fontWeight: '700', dropShadow: { blur: 4 } }});
          t.anchor.set(0.5); layers.overlay.addChild(t); t.visible = false; return t;
        },
        () => {},
        10
      );

      const spawnExplosion = (x: number, y: number, color: string, count: number) => {
        for (let i = 0; i < count; i++) {
          game.current.particles.push({
            id: Math.random().toString(), x, y,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
            life: 1.0, decay: Math.random() * 0.03 + 0.01, color,
          });
        }
      };

      const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
        const g = game.current;
        if (g.health <= 0) return;
        const clickX = e.global.x;
        const clickY = e.global.y;

        const w = app.screen.width;
        const h = app.screen.height;

        if (clickY > h - 80) {
          if (clickX < 120) return;
          if (clickX > w - 150) return;
        }

        if (g.ammo <= 0) return;
        g.ammo--;
        if (g.ammo <= 5) g.lowAmmoTimer = 1000;

        const truckX = w / 2;
        const truckY = h - 30;
        const startX = truckX + 25 * 0.7;
        const startY = truckY - 38 * 0.7;

        const dx = clickX - startX;
        const dy = clickY - startY;
        const dist = Math.hypot(dx, dy);
        const speed = 15;

        if (dist === 0) return;
        playSound('shoot', g.muted);
        triggerHaptic('light');

        g.missiles.push({
          id: g.missileCount++,
          startX, startY, targetX: clickX, targetY: clickY,
          x: startX, y: startY,
          vx: (dx / dist) * speed, vy: (dy / dist) * speed,
          speed, state: 'flying', radius: 5, maxRadius: 50, explodeSpeed: 2.5, hits: 0,
          gfx: missilePoolRef.current!.acquire(),
        });
      };

      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(0, 0, 10000, 10000);
      app.stage.on('pointerdown', handlePointerDown);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        if (recoveringRef.current) return;
        recoveringRef.current = true;
        if (app?.ticker) app.ticker.stop();
        setRecovering(true);
        setPixiVersion(v => v + 1);
      };
      (app.canvas as HTMLCanvasElement).addEventListener('webglcontextlost', handleContextLost);

      const updatePhysics = (timeMs: number) => {
        const g = game.current;
        const dt = timeMs - g.lastTime;
        g.lastTime = timeMs;

        const w = app.screen.width;
        const h = app.screen.height;

        if (g.health <= 0) {
          if (g.gameOverReported) return;
          g.gameOverReported = true;
          setFinalScore(g.score);
          setGameState('gameover');
          playSound('explosion', g.muted);
          triggerHaptic('heavy');
          if (window.Odesa) (window.Odesa as any).gameOver(g.score);
          return;
        }

        if (g.screenShake > 0) g.screenShake *= 0.9;
        if (g.screenShake < 0.5) g.screenShake = 0;

        if (timeMs > g.nextSpawn) {
          if (g.dronesSpawned < g.dronesInWave) {
            const timeAlive = timeMs - g.startTime;
            const width = 30; const height = 30;
            let speedMult = g.difficulty === 'hard' ? 1.5 : 1;
            if (timeAlive > 60000) speedMult += ((timeAlive - 60000) / 30000); 
            speedMult = Math.min(speedMult, 4);

            g.enemies.push({
              id: g.enemyCount++,
              x: Math.random() * (w - width) + width / 2, y: -height,
              vx: (Math.random() - 0.5) * 1.0, vy: (Math.random() * 1.5 + 1.0) * speedMult,
              width, height,
              sprite: enemyPoolRef.current!.acquire(),
            });
            g.dronesSpawned++;
            
            let baseDelay = g.difficulty === 'hard' ? 1200 : 2000;
            baseDelay = Math.max(500, baseDelay - (g.wave * 100));
            let spawnDelay = baseDelay - (timeAlive / 60000) * (baseDelay / 2);
            if (timeAlive > 60000) spawnDelay = (baseDelay / 2) - ((timeAlive - 60000) / 30000) * 400;
            spawnDelay = Math.max(250, spawnDelay);
            g.nextSpawn = timeMs + spawnDelay;
          } else if (g.enemies.length === 0) {
            try {
              localStorage.setItem('lastActiveTime', Date.now().toString());
              if (g.wave === 2) localStorage.setItem('wave3Score', g.score.toString());
            } catch(e) {}
            g.wave++;
            g.dronesInWave = 10 + Math.floor(g.wave * 3);
            g.dronesSpawned = 0;
            g.ammo = g.dronesInWave * (g.difficulty === 'hard' ? 1.5 : 3);
            g.health = Math.min(100, g.health + 10);
            g.nextSpawn = timeMs + 2200;
            g.waveFlashTimer = 2000;
          }
        }

        for (let i = g.missiles.length - 1; i >= 0; i--) {
          const m = g.missiles[i];
          if (m.state === 'flying') {
            m.x += m.vx; m.y += m.vy;
            const distTravelled = Math.hypot(m.x - m.startX, m.y - m.startY);
            const distTotal = Math.hypot(m.targetX - m.startX, m.targetY - m.startY);
            if (distTravelled >= distTotal || m.y < 0) m.state = 'exploding';
          } else if (m.state === 'exploding') {
            m.radius += m.explodeSpeed;
            if (m.radius > m.maxRadius) m.explodeSpeed = -2;
            if (m.radius <= 0) { missilePoolRef.current!.release(m.gfx); g.missiles.splice(i, 1); }
          }
        }

        for (let i = g.enemies.length - 1; i >= 0; i--) {
          const e = g.enemies[i];
          e.x += e.vx; e.y += e.vy;
          if (e.x < 0 || e.x > w) e.vx *= -1;

          if (e.y > h - 40) {
            const hitTruck = Math.abs(e.x - (w / 2)) < 50;
            if (hitTruck) {
              g.ammo = Math.max(0, g.ammo - 10);
              g.health -= 20; g.flashRed = 1.0; g.screenShake = 30;
              playSound('hit', g.muted); triggerHaptic('heavy');
              spawnExplosion(e.x, e.y, '#ef4444', 30);
              g.floatingTexts.push({ id: Math.random().toString(), text: "-10 🚀", x: e.x, y: e.y, life: 1500, textObj: textPoolRef.current!.acquire() });
            } else {
              g.health -= 10; g.screenShake = 15;
              playSound('hit', g.muted); triggerHaptic('heavy');
              spawnExplosion(e.x, e.y, '#ef4444', 15);
            }
            enemyPoolRef.current!.release(e.sprite);
            g.enemies.splice(i, 1);
            continue;
          }

          let isDead = false;
          let accuracyDist = 0; let maxExplodeRadius = 0;
          for (const m of g.missiles) {
            if (m.state === 'exploding') {
              const dist = Math.hypot(e.x - m.x, e.y - m.y);
              if (dist < m.radius + e.width / 2) {
                isDead = true; accuracyDist = dist; maxExplodeRadius = m.maxRadius;
                m.hits = (m.hits || 0) + 1;
                if (m.hits >= 3) {
                  g.score += 1;
                  g.floatingTexts.push({ id: Math.random().toString(), text: `🔥 ${TRANSLATIONS[g.currentLang].combo || "Combo"} X${m.hits}!`, x: e.x, y: e.y - 20, life: 1000, textObj: textPoolRef.current!.acquire() });
                }
                break;
              }
            }
          }
          if (isDead) {
            g.score += 1;
            const accuracy = Math.max(0, 1 - (accuracyDist / (maxExplodeRadius || 40)));
            playSound('explosion', g.muted, 0.2 + (accuracy * 1.8));
            triggerHaptic('light'); spawnExplosion(e.x, e.y, '#fb923c', 20); 
            enemyPoolRef.current!.release(e.sprite);
            g.enemies.splice(i, 1);
          }
        }

        for (let i = g.particles.length - 1; i >= 0; i--) {
          const p = g.particles[i];
          p.x += p.vx; p.y += p.vy; p.life -= p.decay;
          if (p.life <= 0) g.particles.splice(i, 1);
        }

        for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
          const ft = g.floatingTexts[i];
          ft.y -= (dt / 1000) * 80; ft.life -= dt;
          if (ft.life <= 0) { textPoolRef.current!.release(ft.textObj); g.floatingTexts.splice(i, 1); }
        }

        if (g.flashRed > 0) g.flashRed = Math.max(0, g.flashRed - dt / 500);
        if (g.waveFlashTimer > 0) g.waveFlashTimer -= dt;
        if (g.lowAmmoTimer > 0) g.lowAmmoTimer -= dt;
      };

      const syncVisuals = () => {
        const g = game.current;
        const w = app.screen.width;
        const h = app.screen.height;

        // Screen shake
        if (g.screenShake > 0) {
          app.stage.x = (Math.random() - 0.5) * g.screenShake;
          app.stage.y = (Math.random() - 0.5) * g.screenShake;
        } else {
          app.stage.x = 0; app.stage.y = 0;
        }

        // Red flash overlay
        flashRedGfx.clear();
        if (g.flashRed > 0) {
          flashRedGfx.rect(0, 0, w, h).fill({ color: 0xef4444, alpha: g.flashRed * 0.5 });
        }

        // Truck
        truckContainer.x = w / 2;
        truckContainer.y = h - 30;
        truckContainer.scale.set(0.7);
        gunMount.clear();
        gunMount.circle(-45, 25, 12).circle(35, 25, 12).fill({ color: 0x000000 });
        gunMount.circle(-45, 25, 6).circle(35, 25, 6).fill({ color: 0x9ca3af });
        gunMount.moveTo(-65, 5).lineTo(-65, -5).lineTo(-40, -15).lineTo(-15, -15).lineTo(-15, 5).fill({ color: 0x0057b7 });
        gunMount.rect(-65, 5, 120, 10).fill({ color: 0x0057b7 });
        gunMount.rect(-65, 15, 120, 10).fill({ color: 0xFFDD00 });
        gunMount.moveTo(-58, 0).lineTo(-40, -10).lineTo(-20, -10).lineTo(-20, 0).fill({ color: 0x93c5fd });
        const gunX = 25;
        gunMount.moveTo(gunX - 15, 5).lineTo(gunX - 10, -5).lineTo(gunX + 10, -5).lineTo(gunX + 15, 5).fill({ color: 0x1f2937 });
        gunMount.moveTo(gunX - 12, -5).lineTo(gunX - 18, -18).lineTo(gunX + 18, -18).lineTo(gunX + 12, -5).fill({ color: 0x374151 });
        gunMount.rect(gunX - 6, -35, 3, 20).rect(gunX + 3, -35, 3, 20).fill({ color: 0x111827 });
        gunMount.rect(gunX - 7, -38, 5, 4).rect(gunX + 2, -38, 5, 4).fill({ color: 0x111827 });

        // Enemies (pooled sprites — direct ref, no Map lookup)
        g.enemies.forEach(e => { e.sprite.x = e.x; e.sprite.y = e.y; });

        // Missiles (pooled Graphics — direct ref)
        g.missiles.forEach(m => {
          m.gfx.clear();
          if (m.state === 'flying') {
            m.gfx.circle(m.x, m.y, 3).fill({ color: 0xfef08a });
            m.gfx.moveTo(m.x, m.y).lineTo(m.x - m.vx * 1.5, m.y - m.vy * 1.5).stroke({ color: 0xf97316, width: 2 });
          } else if (m.state === 'exploding') {
            m.gfx.circle(m.x, m.y, m.radius * 0.8).fill({ color: 0xfde047, alpha: 0.8 });
            m.gfx.circle(m.x, m.y, m.radius).fill({ color: 0xef4444, alpha: 0.5 });
          }
        });

        // Particles (batched single Graphics)
        let pGfx = layers.particles.children[0] as PIXI.Graphics | undefined;
        if (!pGfx) { pGfx = new PIXI.Graphics(); layers.particles.addChild(pGfx); }
        pGfx.clear();
        g.particles.forEach(p => {
          pGfx.rect(p.x - 2, p.y - 2, 4, 4).fill({ color: p.color as any, alpha: Math.max(0, p.life) });
        });

        // Floating texts (pooled — direct ref)
        g.floatingTexts.forEach(ft => {
          ft.textObj.x = ft.x; ft.textObj.y = ft.y;
          ft.textObj.alpha = Math.max(0, ft.life / 1500);
          ft.textObj.text = ft.text;
        });

        // UI
        ruFlag.clear();
        ruFlag.rect(16, 22, 27, 6).fill({ color: 0xffffff });
        ruFlag.rect(16, 28, 27, 6).fill({ color: 0x0039a6 });
        ruFlag.rect(16, 34, 27, 6).fill({ color: 0xd52b1e });
        ruFlag.rect(16, 22, 27, 18).stroke({ color: 0x334155, width: 1 });

        uiScore.text = g.score.toString();
        uiScore.x = 16 + 27 + 12;
        uiScore.y = 15;

        if (Math.floor(g.ammo) <= 5 && Math.floor(g.ammo) > 0) uiAmmo.style.fill = 0xef4444;
        else uiAmmo.style.fill = 0x0057b7;
        uiAmmo.text = `🚀 ${Math.floor(g.ammo)}`;
        uiAmmo.x = w - uiAmmo.width - 16;
        uiAmmo.y = h - 50;

        if (Math.floor(g.ammo) === 0) {
          outOfAmmoText.visible = true;
          outOfAmmoText.text = TRANSLATIONS[g.currentLang].outOfAmmo;
          outOfAmmoText.x = w / 2; outOfAmmoText.y = h / 2 + 50;
        } else {
          outOfAmmoText.visible = false;
        }

        lowAmmoPill.clear();
        lowAmmoText.visible = false;
        if (Math.floor(g.ammo) <= 5 && g.lowAmmoTimer > 0) {
          const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
          const pillW = 180, pillH = 40;
          const pillX = w / 2 - pillW / 2, pillY = h / 2 - 20;
          lowAmmoPill.roundRect(pillX, pillY, pillW, pillH, pillH/2).fill({ color: 0xef4444, alpha: pulse * 0.85 })
                     .stroke({ color: 0xef4444, alpha: pulse, width: 2 });
          lowAmmoText.visible = true;
          lowAmmoText.text = TRANSLATIONS[g.currentLang].lowAmmo;
          lowAmmoText.alpha = pulse;
          lowAmmoText.x = w / 2; lowAmmoText.y = h / 2;
        }

        if (g.waveFlashTimer > 0) {
          waveText.visible = waveSub.visible = true;
          const a = Math.min(1, g.waveFlashTimer / 500);
          waveText.alpha = a; waveSub.alpha = a;
          waveText.text = `${TRANSLATIONS[g.currentLang].wave} ${g.wave}`;
          waveText.x = w / 2; waveText.y = h / 2 - 20;
          waveSub.x = w / 2; waveSub.y = h / 2 + 30;
          if (g.wave === 1) waveSub.text = TRANSLATIONS[g.currentLang].tapDroneToSaveCity;
          else if (g.wave === 4) waveSub.text = TRANSLATIONS[g.currentLang].warnRelatives;
          else if (g.wave === 6) waveSub.text = TRANSLATIONS[g.currentLang].goToShelter;
          else waveSub.text = '';
        } else {
          waveText.visible = waveSub.visible = false;
        }

        const hpWidth = Math.min(100, w / 3);
        const hpX = w - hpWidth - 16, hpY = 22;
        uiHealthBar.clear();
        uiHealthBar.rect(hpX, hpY, hpWidth, 16).fill({ color: 0x000000, alpha: 0.5 });
        const curW = Math.max(0, (g.health / 100) * hpWidth);
        uiHealthBar.rect(hpX, hpY, curW, 8).fill({ color: 0x0057b7 });
        uiHealthBar.rect(hpX, hpY + 8, curW, 8).fill({ color: 0xFFDD00 });
        uiHealthBar.rect(hpX, hpY, hpWidth, 16).stroke({ color: 0x334155, width: 1 });
      };

      app.ticker.add(() => {
        if (!pausedRef.current) {
          updatePhysics(performance.now());
          syncVisuals();
        }
      });
      app.ticker.maxFPS = 60;

      game.current.lastTime = performance.now();

    })();

    return () => {
      isDestroyed = true;
      if (app.renderer) {
        app.ticker?.stop();
        app.stage.eventMode = 'none';
        app.stage.removeAllListeners();
        if (app.canvas?.parentNode) {
          app.canvas.parentNode.removeChild(app.canvas);
        }
        while (app.stage.children.length > 0) {
          const child = app.stage.children[0];
          app.stage.removeChild(child);
          child.destroy(true);
        }
        app.destroy(false, { children: false });
      }
      enemyPoolRef.current = null;
      missilePoolRef.current = null;
      textPoolRef.current = null;
    };
  }, [gameState, pixiVersion]);

  return (
    <div className="absolute inset-0 flex justify-center bg-black touch-none select-none">
      {!isReady && <LoadingTrident className="absolute inset-0 bg-slate-900" />}
      {isReady && (
        <div ref={containerRef} className="relative w-full max-w-[430px] h-full overflow-hidden bg-slate-900 shadow-2xl">
          <AnimatePresence initial={false}>
            {gameState === 'menu' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10 px-4">
                <div className="bg-slate-800 border-2 border-blue-500 rounded-2xl p-6 max-w-sm w-full text-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                <div className="flex justify-center items-center mb-6">
                  <button onClick={(e) => { e.stopPropagation(); setDifficulty(d => d === 'easy' ? 'hard' : 'easy'); }} className={`px-4 py-2 min-w-[120px] font-bold text-sm uppercase rounded-full shadow-lg border transition-colors ${difficulty === 'hard' ? 'bg-red-900/80 border-red-500 text-red-100' : 'bg-green-900/80 border-green-500 text-green-100'}`}>
                    {difficulty === 'easy' ? t.easyMode : t.hardMode}
                  </button>
                </div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-blue-600 tracking-tight uppercase mb-2">{t.title}</h1>
                <p className="text-slate-300 font-medium mb-6">{t.desc}</p>
                <button onClick={startGame} className="group relative w-full flex items-center justify-center overflow-hidden rounded-xl font-black py-4 px-8 text-xl hover:scale-105 active:scale-95 transition-transform shadow-lg border-2 border-slate-700 hover:border-slate-500">
                  <div className="absolute inset-0 flex flex-col z-0"><div className="flex-1 bg-[#0057b7]"></div><div className="flex-1 bg-[#FFDD00]"></div></div>
                  <div className="relative z-10 flex items-center justify-center gap-3 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    <Play className="w-6 h-6 fill-current" /><span>{t.engage}</span>
                  </div>
                </button>
                <div className="mt-6 flex flex-col gap-2 items-center text-xs text-slate-400">
                  <div className="flex items-center gap-2"><Crosshair className="w-4 h-4"/> {t.tapToShoot}</div>
                </div>
                {splashItems.length > 0 && (
                  <div className="mt-4 flex gap-1.5 overflow-x-auto px-1 py-1 max-w-full" style={{ scrollbarWidth: 'none' }}>
                    {splashItems.map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => window.Odesa?.toggleSplashItem?.(item.id)}
                        className={`flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                          item.visible !== false
                            ? 'bg-blue-500/30 text-blue-200'
                            : 'bg-slate-700/50 text-slate-500 grayscale'
                        }`}
                      >
                        {item.icon} {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
          {paused && (
            <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
              <div className="text-white text-5xl font-black tracking-widest drop-shadow-lg select-none">PAUSED</div>
            </div>
          )}
          {gameState === 'gameover' && (
            <GameEndScreen
              score={finalScore}
              imageSrc="/games/drones/drone.png"
              title={{ win: t.baseDestroyed, lose: t.baseDestroyed }}
              onPlayAgain={startGame}
              onQuit={() => window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, window.location.origin)}
              t={{ playAgain: t.deployAgain, tryAgain: t.deployAgain, quit: t.quit }}
            />
          )}
        </div>
      )}
      {recovering && (
        <div className="absolute inset-0 bg-black/70 z-50">
          <LoadingTrident text="Restoring..." />
        </div>
      )}
    </div>
  );
}
