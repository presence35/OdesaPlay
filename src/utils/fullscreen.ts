import { useEffect, useRef, useState, useCallback } from 'react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(pointer: coarse)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export function useFullscreenOnRotate(active: boolean, requiredOrientation?: 'portrait' | 'landscape') {
  const isMobile = useIsMobile();
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef(false);

  const isCorrectOrientation = isMobile && requiredOrientation
    ? (requiredOrientation === 'landscape' ? isLandscape : !isLandscape)
    : true;

  const isWrongOrientation = isMobile && active && !isCorrectOrientation;

  const requestFS = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        fullscreenRef.current = true;
        setIsFullscreen(true);
        if (isMobile && requiredOrientation) {
          try {
            const so = (screen as Screen & { orientation?: { lock: (o: string) => Promise<void> } }).orientation;
            if (so?.lock) {
              await so.lock(requiredOrientation);
            }
          } catch {
            // Orientation lock unsupported or denied
          }
        }
      } catch {
        // Unsupported or blocked
      }
    }
  }, [isMobile, requiredOrientation]);

  useEffect(() => {
    if (!active) {
      setIsLandscape(false);
      setIsFullscreen(false);
      if (fullscreenRef.current && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        fullscreenRef.current = false;
      }
      return;
    }

    const syncFullscreen = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) fullscreenRef.current = false;
    };

    const checkOrientation = () => {
      setIsLandscape(window.matchMedia('(orientation: landscape)').matches);
    };

    document.addEventListener('fullscreenchange', syncFullscreen);

    const screenOrientation =
      (screen as Screen & { msOrientation?: EventTarget }).orientation ||
      (screen as Screen & { msOrientation?: EventTarget }).msOrientation ||
      null;

    if (screenOrientation && 'addEventListener' in screenOrientation) {
      screenOrientation.addEventListener('change', checkOrientation);
    } else {
      window.matchMedia('(orientation: landscape)').addEventListener('change', checkOrientation);
    }

    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      if (screenOrientation && 'removeEventListener' in screenOrientation) {
        screenOrientation.removeEventListener('change', checkOrientation);
      } else {
        window.matchMedia('(orientation: landscape)').removeEventListener('change', checkOrientation);
      }
      window.removeEventListener('resize', checkOrientation);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      fullscreenRef.current = false;
    };
  }, [active]);

  return { requestFS, isLandscape, isFullscreen, isCorrectOrientation, isWrongOrientation };
}
