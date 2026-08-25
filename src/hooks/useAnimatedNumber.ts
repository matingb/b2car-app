import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Animates a numeric value from zero using the dashboard count-up timing. */
export function useAnimatedNumber(value: number | null | undefined, durationMs = 1500) {
  const [animatedValue, setAnimatedValue] = useState<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === undefined || value === null || !Number.isFinite(value)) {
      setAnimatedValue(null);
      return;
    }

    const from = 0;
    const start = performance.now();
    setAnimatedValue(from);

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const current = from + (value - from) * easeOutCubic(t);
      setAnimatedValue(current);
      if (t < 1) rafIdRef.current = requestAnimationFrame(tick);
    };

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [durationMs, value]);

  return animatedValue;
}
