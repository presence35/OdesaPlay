import { useEffect, useState, useCallback } from 'react';

let showToastFn: ((msg: string) => void) | null = null;

export function showToast(message: string) {
  showToastFn?.(message);
}

export default function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  useEffect(() => {
    showToastFn = show;
    return () => { showToastFn = null; };
  }, [show]);

  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div className="bg-yellow-400 text-black px-8 py-4 rounded-full font-black text-xl italic uppercase shadow-2xl animate-bounce">
        {message}
      </div>
    </div>
  );
}
