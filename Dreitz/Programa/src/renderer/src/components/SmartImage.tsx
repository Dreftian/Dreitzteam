import { useEffect, useRef, useState } from 'react';

/**
 * <SmartImage> — Imagen con:
 *  - Placeholder con gradient + animate-shimmer mientras carga
 *  - Fade-in suave al cargar
 *  - Lazy loading via IntersectionObserver (no descarga hasta entrar al viewport)
 *  - Fallback automático si la imagen falla (mantiene el placeholder gris)
 *
 * Reemplaza `<img>` en lugares donde se renderizan listas grandes de imágenes
 * (Store grid, GameDetail screenshots, Library, etc) — el primer paint es
 * instantáneo y la carga progresiva queda mucho más pulida.
 */

type Props = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** Si true, fuerza descarga inmediata (above-the-fold hero). Default false. */
  eager?: boolean;
  /** Margen del viewport para empezar a precargar (default 200px). */
  rootMargin?: string;
  /** Color del placeholder mientras carga (default gradient gris/morado). */
  placeholderColor?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
};

export default function SmartImage({
  src,
  alt = '',
  className = '',
  eager = false,
  rootMargin = '200px',
  placeholderColor,
  onLoad,
  onError,
  style
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (eager || visible) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, visible, rootMargin]);

  // Reset loaded state cuando cambia el src
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundColor: placeholderColor ?? '#1a1130',
        ...style
      }}
    >
      {/* Shimmer placeholder mientras no cargó */}
      {!loaded && !failed && (
        <div
          className="absolute inset-0 animate-shimmer"
          style={{
            background:
              'linear-gradient(90deg, rgba(168,85,255,0.04) 0%, rgba(168,85,255,0.12) 50%, rgba(168,85,255,0.04) 100%)',
            backgroundSize: '200% 100%'
          }}
        />
      )}
      {visible && src && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => { setLoaded(true); onLoad?.(); }}
          onError={() => { setFailed(true); onError?.(); }}
        />
      )}
    </div>
  );
}
