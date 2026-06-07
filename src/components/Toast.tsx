import { useEffect, useState, useCallback, useRef } from 'react';

let showToastFn: ((msg: string) => void) | null = null;

export function showToast(message: string) {
  showToastFn?.(message);
}

export default function Toast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setMessage(null);
  }, []);

  const show = useCallback((msg: string) => {
    clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(dismiss, 2000);
  }, [dismiss]);

  useEffect(() => {
    showToastFn = show;
    return () => {
      showToastFn = null;
      clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!message) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[200] flex justify-center pointer-events-none">
      <div
        className="bg-[var(--accent-bg)] text-[var(--text-on-accent)] px-8 py-4 rounded-full font-black text-xl italic uppercase shadow-2xl pointer-events-auto cursor-pointer"
        onClick={dismiss}
      >
        {message}
      </div>
    </div>
  );
}
