import { useEffect, useState, type RefObject } from 'react';

/**
 * Hook que devuelve `true` cuando el elemento referenciado entra al viewport
 * (o si `eager: true` se monta inmediato).
 *
 * Uso típico: lazy-mount de cards/secciones pesadas en listas largas. Mantiene
 * el espacio reservado (placeholder), monta el componente real solo cuando es
 * visible → primer paint instantáneo + smooth scroll.
 */
export function useLazyMount(
  ref: RefObject<HTMLElement>,
  opts: { rootMargin?: string; eager?: boolean } = {}
): boolean {
  const [mounted, setMounted] = useState(!!opts.eager);

  useEffect(() => {
    if (opts.eager) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: opts.rootMargin ?? '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, opts.eager, opts.rootMargin]);

  return mounted;
}
