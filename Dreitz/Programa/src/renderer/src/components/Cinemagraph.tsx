/**
 * Cinemagraph — background ambient con dos modos:
 *
 * 1. **Video loop**: si pasas `videoUrl`, lo reproduce muted/looped/playsinline.
 *    Buenos sources gratis (no requeridos, sólo si decides usarlos):
 *      - https://coverr.co  (descarga manual, dropea en public/cinemagraphs/)
 *      - https://www.mixkit.co/free-stock-video/
 *      - https://www.pexels.com/videos/
 *    Dropea los .mp4 en `Dreitz/Programa/src/renderer/public/cinemagraphs/`
 *    y úsalos como `videoUrl="/cinemagraphs/aurora.mp4"`.
 *
 * 2. **CSS mesh gradient animado** (fallback default cuando no hay video).
 *    Genera un fondo único, fluido, animado, sin asset. Tres "blobs" que
 *    flotan en loop infinito, mezclando colores de marca. Usa 0 bandwidth y
 *    rinde a 60fps en GPU.
 *
 * Variants de mesh: 'aurora' | 'sunset' | 'nebula' | 'ocean' | 'forest'
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type MeshVariant = 'aurora' | 'sunset' | 'nebula' | 'ocean' | 'forest';

const MESH_PALETTES: Record<MeshVariant, [string, string, string]> = {
  aurora:  ['#00d4ff', '#a855ff', '#22d3ee'],
  sunset:  ['#fb7185', '#f97316', '#ec4899'],
  nebula:  ['#a855ff', '#ff3aa6', '#6e00ff'],
  ocean:   ['#0284c7', '#06b6d4', '#3b82f6'],
  forest:  ['#10b981', '#22d3ee', '#84cc16']
};

interface Props {
  videoUrl?: string | null;
  posterUrl?: string | null;
  variant?: MeshVariant;
  className?: string;
  style?: CSSProperties;
  opacity?: number;
}

export default function Cinemagraph({
  videoUrl,
  posterUrl,
  variant = 'aurora',
  className = '',
  style,
  opacity = 1
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      // Autoplay muted está permitido por la política del navegador.
      videoRef.current.play().catch(() => { /* ignore */ });
    }
  }, [videoUrl]);

  if (videoUrl) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ ...style, opacity }}>
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }

  return <MeshGradient variant={variant} className={className} style={{ ...style, opacity }} />;
}

/**
 * MeshGradient: 3 blobs animados con radial gradients que se mueven en loops
 * desfasados. Da una sensación cinematográfica sin video.
 */
export function MeshGradient({
  variant = 'aurora',
  className = '',
  style
}: { variant?: MeshVariant; className?: string; style?: CSSProperties }) {
  const [c1, c2, c3] = MESH_PALETTES[variant];
  return (
    <div
      className={`mesh-bg ${className}`}
      style={{
        ['--mesh-c1' as any]: c1,
        ['--mesh-c2' as any]: c2,
        ['--mesh-c3' as any]: c3,
        ...style
      }}
    >
      <div className="mesh-blob mesh-blob-1" />
      <div className="mesh-blob mesh-blob-2" />
      <div className="mesh-blob mesh-blob-3" />
    </div>
  );
}
