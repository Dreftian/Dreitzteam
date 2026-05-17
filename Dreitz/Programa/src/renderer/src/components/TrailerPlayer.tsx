import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

export default function TrailerPlayer({ url, poster }: { url: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);

  // Steam-style: auto-play muted on mount so the trailer feels alive even before the
  // user interacts. Browser autoplay policies allow muted playback without a gesture.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [url]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {});
    else { v.pause(); setPlaying(false); }
  }

  function fullscreen() {
    ref.current?.requestFullscreen?.();
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      className="relative aspect-video rounded-xl overflow-hidden bg-black group"
    >
      <video
        ref={ref}
        src={url}
        poster={poster}
        playsInline
        loop
        autoPlay
        muted
        preload="metadata"
        className="w-full h-full object-cover"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {!playing && (
        <button
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
        >
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-white/95 hover:bg-white text-black flex items-center justify-center shadow-2xl"
          >
            <Play size={32} fill="currentColor" className="ml-1" />
          </motion.span>
        </button>
      )}

      <div
        className={`absolute bottom-2 right-2 flex gap-1 transition-opacity ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="w-9 h-9 rounded-md bg-black/60 hover:bg-black/85 text-white flex items-center justify-center"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          aria-label={muted ? 'Activar audio' : 'Silenciar'}
          className="w-9 h-9 rounded-md bg-black/60 hover:bg-black/85 text-white flex items-center justify-center"
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); fullscreen(); }}
          aria-label="Pantalla completa"
          className="w-9 h-9 rounded-md bg-black/60 hover:bg-black/85 text-white flex items-center justify-center"
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}
