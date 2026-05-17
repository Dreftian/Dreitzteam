import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, Sparkles, X, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { play } from '../lib/sounds';

/**
 * Botón flotante "Sorpréndeme" — combate la parálisis de decisión.
 *
 * Llama a `surprise:pick` (IPC en main) que prioriza:
 *   1. Juego de tu biblioteca con playtime < 60min
 *   2. Cualquier juego de tu biblioteca random
 *   3. Wishlist random
 *   4. Featured del catálogo
 *
 * Muestra un modal con la portada + razón + CTA "Jugar/Ver ficha".
 */
export default function SurpriseButton() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ game: any; reason: string } | null>(null);

  if (!user) return null;

  async function roll() {
    setRolling(true);
    setResult(null);
    play('notify');
    // Animación mínima de 700ms para sentir el "rolleo"
    const [pick] = await Promise.all([
      window.api.surprisePick({ userId: user!.id }).catch(() => null),
      new Promise((r) => setTimeout(r, 700))
    ]);
    setRolling(false);
    if (!pick) {
      toast.error('No encontramos nada para sorprenderte. ¡Agrega juegos a tu biblioteca o wishlist!');
      setOpen(false);
      return;
    }
    setResult(pick);
  }

  function goToGame() {
    if (!result?.game) return;
    nav(`/game/${result.game.id}`);
    setOpen(false);
    setResult(null);
  }

  function openAndRoll() {
    setOpen(true);
    roll();
  }

  return (
    <>
      {/* Botón flotante bottom-right */}
      <motion.button
        onClick={openAndRoll}
        className="fixed bottom-6 right-6 z-40 group"
        whileHover={{ scale: 1.08, rotate: -8 }}
        whileTap={{ scale: 0.92 }}
        title="Sorpréndeme — pickea un juego al azar"
        aria-label="Sorpréndeme"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 blur-xl opacity-40 group-hover:opacity-70 transition-opacity" />
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 shadow-2xl shadow-purple-500/40 flex items-center justify-center text-white">
          <Dice5 size={22} />
        </div>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 border-2 border-bg-base flex items-center justify-center">
          <Sparkles size={9} className="text-yellow-900" />
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setOpen(false); setResult(null); }}
          >
            <motion.div
              className="card max-w-md w-full relative overflow-hidden"
              initial={{ scale: 0.94, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-0.5 bg-gradient-to-r from-purple-400 via-fuchsia-500 to-pink-500" />
              <button
                onClick={() => { setOpen(false); setResult(null); }}
                className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center text-fg-muted z-10"
              >
                <X size={15} />
              </button>

              <div className="p-7 text-center border-b border-border bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-bold tracking-widest mb-3">
                  <Dice5 size={11} /> SORPRÉNDEME
                </div>
                <h2 className="text-2xl font-extrabold mb-1">
                  {rolling ? 'Tirando el dado...' : result ? '¿Hoy juegas esto?' : 'Eligiendo'}
                </h2>
                <p className="text-sm text-fg-muted">
                  {rolling
                    ? 'Buscando algo perfecto para ti'
                    : result
                      ? result.reason
                      : '...'}
                </p>
              </div>

              {/* Resultado */}
              {result?.game && !rolling && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="p-5"
                >
                  <div
                    onClick={goToGame}
                    className="cursor-pointer rounded-md overflow-hidden border border-border hover:border-purple-400/50 transition-all bg-bg-hover/30"
                  >
                    {result.game.header_image && (
                      <img
                        src={result.game.header_image}
                        alt={result.game.title}
                        className="w-full aspect-[460/215] object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="p-3">
                      <div className="font-bold text-base leading-tight mb-1">{result.game.title}</div>
                      <div className="text-xs text-fg-muted">{result.game.developer}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={goToGame} className="btn btn-primary text-sm flex-1 flex items-center justify-center gap-1.5">
                      <Play size={13} /> Ver ficha
                    </button>
                    <button onClick={roll} className="btn text-sm flex items-center gap-1.5">
                      <Dice5 size={13} /> Otro
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Skeleton mientras rolling */}
              {rolling && (
                <div className="p-5">
                  <div className="rounded-md overflow-hidden border border-border bg-bg-hover/30">
                    <div className="w-full aspect-[460/215] animate-pulse bg-gradient-to-r from-purple-500/10 via-fuchsia-500/15 to-pink-500/10" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-bg-hover animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-bg-hover animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
