import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gamepad2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCachedImage } from '../lib/useCachedImage';

/**
 * Now Playing — overlay flotante (bottom-right) que aparece cuando el user
 * está corriendo un juego en su PC. Detección viene del `playtimeTracker` del
 * main, que actualiza `installs.last_played_at` cada 30s mientras el .exe está
 * activo.
 *
 * Dismissible. Re-aparece si el user lanza otro juego.
 */
export default function NowPlayingWidget() {
  const { user } = useAuth();
  const [now, setNow] = useState<any | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const rows: any[] = await window.api.libraryNowPlaying(user.id);
        if (cancelled) return;
        const playing = rows[0] ?? null;
        if (playing) {
          if (dismissed === playing.game_id) return;
          setNow(playing);
        } else {
          setNow(null);
          setDismissed(null);
        }
      } catch {/* swallow */}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id, dismissed]);

  const cached = useCachedImage(now?.header_image || now?.capsule_image);

  return (
    <AnimatePresence>
      {now && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="fixed bottom-4 right-4 z-40 card p-3 max-w-[280px] flex items-center gap-3"
          style={{ boxShadow: 'var(--shadow-xl)' }}
        >
          {cached && (
            <img src={cached} alt="" className="w-14 aspect-[460/215] object-cover rounded shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-green-400 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Jugando ahora
            </div>
            <Link to={`/game/${now.game_id}`} className="text-sm font-semibold truncate block hover:text-accent">
              {now.title}
            </Link>
            {now.playtime_minutes > 0 && (
              <div className="text-[10px] text-fg-subtle">{now.playtime_minutes} min total</div>
            )}
          </div>
          <button
            onClick={() => setDismissed(now.game_id)}
            className="text-fg-muted hover:text-fg p-1"
            aria-label="Ocultar"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
