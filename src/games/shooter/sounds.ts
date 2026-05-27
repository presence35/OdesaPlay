import { getAudioContext, resumeAudioContext, registerSoundPauser, unregisterSoundPauser } from '../../utils/audioContext';

type SoundName =
  | 'car_motor'
  | 'car_rev'
  | 'car_passing'
  | 'car_whoosh'
  | 'car_engine'
  | 'motorcycle1'
  | 'motorcycle_wizz'
  | 'motorcylce_rev'
  | 'racecar'
  | 'unlock'
  | 'cafe_background';

const SOUND_NAMES: SoundName[] = [
  'car_motor', 'car_rev', 'car_passing', 'car_whoosh', 'car_engine',
  'motorcycle1', 'motorcycle_wizz', 'motorcylce_rev', 'racecar',
  'unlock', 'cafe_background'
];

export class SoundGenerator {
  sfxEnabled: boolean = true;
  ctx: AudioContext | null = null;
  score: number = 100;
  private audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {};
  private bgAudio: HTMLAudioElement | null = null;
  private activeLoops: Map<string, HTMLAudioElement> = new Map();
  private pausedLoopIds: Set<string> = new Set();

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (!enabled) this.stopAll();
  }

  pause() {
    if (this.bgAudio && !this.bgAudio.paused) {
      this.bgAudio.pause();
    }
    this.activeLoops.forEach((el, id) => {
      el.pause();
      this.pausedLoopIds.add(id);
    });
    for (const pool of Object.values(this.poolCache)) {
      if (pool) pool.forEach(el => { if (!el.paused) { el.pause(); el.currentTime = 0; } });
    }
  }

  resume() {
    if (this.bgAudio && this.bgAudio.paused && this.sfxEnabled) {
      this.bgAudio.play().catch(() => {});
    }
    this.pausedLoopIds.forEach(id => {
      const el = this.activeLoops.get(id);
      if (el && el.paused) el.play().catch(() => {});
    });
    this.pausedLoopIds.clear();
  }

  stopAll() {
    this.stopBackground();
    this.activeLoops.forEach(el => el.pause());
    this.activeLoops.clear();
    this.pausedLoopIds.clear();
    for (const pool of Object.values(this.poolCache)) {
      if (pool) pool.forEach(el => { el.pause(); el.currentTime = 0; });
    }
  }

  setScore(score: number) {
    this.score = score;
    const vol = Math.max(0, Math.min(1, 0.3 * (this.score / 100)));
    this.activeLoops.forEach(el => { el.volume = vol; });
  }

  getVolume() {
    return Math.max(0.1, Math.min(1.5, (this.score / 100) * 1.5));
  }

  init() {
    if (!this.ctx) {
      try {
        this.ctx = getAudioContext();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
    resumeAudioContext();
    if (!this.registered) {
      registerSoundPauser(this);
      this.registered = true;
    }
    // Preload mp3s on first init
    if (Object.keys(this.audioCache).length === 0) {
      this.preload();
    }
  }

  private poolCache: Partial<Record<SoundName, HTMLAudioElement[]>> = {};
  private registered: boolean = false;

  private preload() {
    for (const name of SOUND_NAMES) {
      const audio = new Audio();
      audio.src = `/games/shooter/${name}.mp3`;
      audio.preload = 'auto';
      audio.load();
      this.audioCache[name] = audio;
      this.poolCache[name] = [];
    }
  }

  private playMp3(name: SoundName, volume: number = 1, loop: boolean = false) {
    if (!this.sfxEnabled) return null;
    let pool = this.poolCache[name];
    if (!pool) pool = this.poolCache[name] = [];
    
    // Find an unused audio element
    let el = pool.find(a => a.paused || a.ended);
    if (!el) {
      if (pool.length > 5 && name !== 'cafe_background') { // Prevent audio spam limit 5 per effect
        el = pool[Math.floor(Math.random() * pool.length)]; // reuse random one
      } else {
        const source = this.audioCache[name];
        if (!source) return;
        el = source.cloneNode() as HTMLAudioElement;
        pool.push(el);
      }
    }
    
    el.volume = Math.max(0, Math.min(1, volume * (this.score / 100)));
    el.loop = loop;
    el.currentTime = 0;
    el.play().catch(() => {});
    return el;
  }

  playCarEngine() {
    this.playMp3('car_motor', 0.3);
  }

  playNoisyEngine(vehicleType?: 'car' | 'motorcycle') {
    if (vehicleType === 'motorcycle') {
      const name = Math.random() > 0.5 ? 'motorcycle1' : 'motorcylce_rev';
      this.playMp3(name, 0.35);
    } else {
      const name = Math.random() > 0.5 ? 'car_rev' : 'racecar';
      this.playMp3(name, 0.35);
    }
  }

  startEngine(id: string, type: 'car' | 'motorcycle') {
    if (this.activeLoops.has(id)) return;
    const name = (type === 'motorcycle' ? (Math.random() > 0.5 ? 'motorcycle1' : 'motorcylce_rev') : (Math.random() > 0.5 ? 'car_rev' : 'racecar'));
    const clone = this.playMp3(name, 0.3, true);
    if (clone) this.activeLoops.set(id, clone);
  }

  stopEngine(id: string) {
    const el = this.activeLoops.get(id);
    if (!el) return;
    el.pause();
    this.activeLoops.delete(id);
  }

  pruneEngines(activeIds: Set<string>) {
    for (const id of this.activeLoops.keys()) {
      if (!activeIds.has(id)) this.stopEngine(id);
    }
  }

  playCarPassing() {
    this.playMp3('car_passing', 0.25);
  }

  playCarWhoosh() {
    this.playMp3('car_whoosh', 0.2);
  }

  playMotorcycleWizz() {
    this.playMp3('motorcycle_wizz', 0.25);
  }

  playUnlock() {
    this.playMp3('unlock', 0.4);
  }

  startBackground() {
    this.stopBackground();
    this.init();
    this.bgAudio = this.playMp3('cafe_background', 0.3, true) || null;
  }

  stopBackground() {
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio = null;
    }
  }

  playWater() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const v = this.getVolume();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05 * v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * v, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
  
  playBananaThrow() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const v = this.getVolume();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1 * v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * v, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playAK47() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const v = this.getVolume();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100 + Math.random() * 50, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.2 * v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * v, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const v = this.getVolume();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3 * v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * v, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
  
  playBananaHit() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const v = this.getVolume();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2 * v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * v, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playError() {
    if (!this.ctx || !this.sfxEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const v = this.getVolume();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.setValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2 * v, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * v, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
}

export const sounds = new SoundGenerator();
