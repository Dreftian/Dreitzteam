import { useEffect, useRef } from 'react';

/**
 * Optional looped video as background hero (used when game has trailer_url).
 * Falls back to static background_image if video fails to load.
 */
export default function CinemagraphHero({
  videoUrl,
  posterUrl,
  className = ''
}: {
  videoUrl: string | null;
  posterUrl?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    const tryPlay = () => v.play().catch(() => {});
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener('canplay', tryPlay, { once: true });
  }, [videoUrl]);

  if (!videoUrl) {
    if (!posterUrl) return null;
    return (
      <div
        className={`absolute inset-0 bg-cover bg-center ${className}`}
        style={{ backgroundImage: `url(${posterUrl})` }}
      />
    );
  }
  return (
    <video
      ref={ref}
      src={videoUrl}
      poster={posterUrl ?? undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
    />
  );
}
