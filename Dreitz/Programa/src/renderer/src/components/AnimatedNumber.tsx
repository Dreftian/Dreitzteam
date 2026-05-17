import { useEffect, useRef, useState } from 'react';

/**
 * Anima un número de su valor anterior al nuevo durante 600ms con easing.
 * Útil para precios cuando se aplica un descuento, points balance, etc.
 *
 * Si `value` no cambia, no anima.
 * Si el usuario tiene reduce-motion, salta directo al valor final.
 */
export default function AnimatedNumber({
  value,
  format = (v) => v.toFixed(2),
  duration = 600,
  className
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('reduce-motion');
    if (reduce || Math.abs(value - display) < 0.001) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    startRef.current = performance.now();

    const tick = (t: number) => {
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const v = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(v);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className} data-tabular>{format(display)}</span>;
}
