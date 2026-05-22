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

export function isAudioEnabled(): boolean {
  return ctx != null && ctx.state !== 'closed';
}

export function disposeAudioContext(): void {
  if (ctx && ctx.state !== 'closed') {
    ctx.close();
    ctx = null;
  }
}
