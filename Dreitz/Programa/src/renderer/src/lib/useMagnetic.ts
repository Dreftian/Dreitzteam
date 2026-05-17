import { useRef, useCallback, useEffect } from 'react';

/**
 * Magnetic — el elemento es "atraído" al cursor cuando éste entra en su radio.
 * El cuerpo del botón se desplaza un 15% hacia el cursor, dando sensación de imán.
 * Usado en CTAs primarios (Comprar, Pagar, Activar).
 *
 * Uso:
 *   const ref = useMagnetic({ radius: 100, strength: 0.18 });
 *   <button ref={ref} className="magnetic">Comprar</button>
 */
export function useMagnetic(opts: { radius?: number; strength?: number } = {}) {
  const ref = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
  const radius = opts.radius ?? 110;
  const strength = opts.strength ?? 0.18;
  const frame = useRef<number | null>(null);

  const reduce =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('reduce-motion'));

  const onMove = useCallback((e: PointerEvent) => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
        return;
      }
      // Falloff: más cerca = más fuerte
      const factor = (1 - dist / radius) * strength;
      el.style.setProperty('--mx', `${dx * factor}px`);
      el.style.setProperty('--my', `${dy * factor}px`);
    });
  }, [radius, strength, reduce]);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--mx', '0px');
    el.style.setProperty('--my', '0px');
  }, []);

  useEffect(() => {
    // Mover el listener al document para detectar el cursor antes de entrar al botón.
    if (reduce) return;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', reset);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', reset);
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [onMove, reset, reduce]);

  return ref;
}
