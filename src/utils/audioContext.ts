let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function resumeAudioContext(): void {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

export function suspendAudioContext(): void {
  if (ctx && ctx.state === 'running') {
    ctx.suspend();
  }
}

export function isAudioEnabled(): boolean {
  return ctx != null && ctx.state !== 'closed';
}

export function disposeAudioContext(): void {
  if (ctx && ctx.state !== 'closed') {
    ctx.close();
    ctx = null;
  }
}

// Global sound pauser registry — lets GameHub pause/resume all non-oscillator audio (e.g. shooter's <audio> elements) in one call
interface SoundPauser {
  pause(): void;
  resume(): void;
}
let pausers: SoundPauser[] = [];

export function registerSoundPauser(p: SoundPauser): void {
  if (!pausers.includes(p)) pausers.push(p);
}

export function unregisterSoundPauser(p: SoundPauser): void {
  pausers = pausers.filter(x => x !== p);
}

export function pauseAllSounds(): void {
  pausers.forEach(p => p.pause());
}

export function resumeAllSounds(): void {
  pausers.forEach(p => p.resume());
}
