let ctx: AudioContext | null = null;
let gestureInitialized = false;

// iOS PWA: AudioContext must be created/resumed inside a user gesture.
// We attach a one-shot listener on the first pointer/touch event to ensure
// iOS doesn't block audio on the first play() call.
function initOnGesture(): void {
  if (gestureInitialized) return;
  gestureInitialized = true;

  const handler = () => {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('touchstart', handler);
  };
  document.addEventListener('pointerdown', handler, { once: true });
  document.addEventListener('touchstart', handler, { once: true });
}

// Schedule gesture init at next microtask so it doesn't interfere
// with module evaluation on page load.
if (typeof document !== 'undefined') {
  // Use setTimeout to defer — avoids race with React's own event system.
  setTimeout(initOnGesture, 0);
}

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
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
