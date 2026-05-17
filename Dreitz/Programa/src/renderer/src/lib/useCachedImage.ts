import { useEffect, useRef, useState } from 'react';

/**
 * Hook que devuelve la URL de una imagen para `<img src>`.
 *
 * NOTA: Antes este hook intentaba swap a `dreitzcache://...` (un protocolo
 * custom de Electron que servía imágenes desde disco). Pero el protocolo
 * fallaba con `net::ERR_UNKNOWN_URL_SCHEME` en algunas configuraciones de
 * Electron 33 + sesiones por defecto, causando que CADA imagen pasara por:
 *   1. Render con dreitzcache://... (falla)
 *   2. onError → swap a https://... (carga)
 * = 2x la latencia por imagen. En GameDetail con 10+ imágenes era visible
 * como "demora al click un título".
 *
 * Ahora SIEMPRE devolvemos la URL remota. Chromium ya cachea imágenes HTTP
 * en memoria/disco — el cache custom era una optimización innecesaria que
 * resultó counter-productiva.
 */
export function useCachedImage(remoteUrl: string | null | undefined): string {
  return remoteUrl ?? '';
}

/**
 * Variante con lazy loading vía IntersectionObserver. Solo descarga cuando
 * el elemento entra al viewport. Útil para listas largas.
 */
export function useLazyImage(remoteUrl: string | null | undefined, opts: { rootMargin?: string } = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !remoteUrl) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: opts.rootMargin ?? '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [remoteUrl, opts.rootMargin]);

  return {
    ref: ref as any,
    src: visible ? (remoteUrl ?? '') : '',
    loaded: false,
    onLoad: () => {}
  };
}

/**
 * No-op (compatibilidad con código que aún llama a prefetchImage). El browser
 * ya cachea imágenes HTTP normales — no necesitamos pre-cache en disco.
 */
export function prefetchImage(_remoteUrl: string | null | undefined) {
  // intencionalmente vacío
}
