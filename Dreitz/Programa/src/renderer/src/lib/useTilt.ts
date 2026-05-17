import { useCallback, useRef } from 'react';

/**
 * Tilt 3D — el elemento sigue al cursor con `rotateX/rotateY` y zoom sutil.
 *
 * Versión OPTIMIZADA: solo agrega listeners cuando el cursor entra (pointerenter),
 * y los desconecta al salir (pointerleave). Antes mantenía pointermove activo
 * permanentemente, lo que con 25 cards en grid = 25 listeners siempre vivos
 * causando jank de scroll. Ahora son 0 listeners hasta que el usuario hover.
 *
 * Respeta `prefers-reduced-motion` y `:root.reduce-motion`.
 */
export function useTilt(opts: { maxDeg?: number; scale?: number } = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const maxDeg = opts.maxDeg ?? 6;
  const scale = opts.scale ?? 1.025;
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
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--tilt-x', `${x * maxDeg * 2}deg`);
      el.style.setProperty('--tilt-y', `${-y * maxDeg * 2}deg`);
      el.style.setProperty('--tilt-scale', String(scale));
    });
  }, [maxDeg, scale, reduce]);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    el.style.setProperty('--tilt-scale', '1');
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', reset);
  }, [onMove]);

  // pointerenter agrega listeners; pointerleave los quita. Esto reduce
  // dramáticamente el overhead en grids con muchos cards.
  const onEnter = useCallback(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset, { once: true });
  }, [onMove, reset, reduce]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    if (ref.current) {
      ref.current.removeEventListener('pointerenter', onEnter);
    }
    ref.current = node;
    if (node) {
      node.addEventListener('pointerenter', onEnter, { passive: true });
    }
  }, [onEnter]);

  return setRef;
}
