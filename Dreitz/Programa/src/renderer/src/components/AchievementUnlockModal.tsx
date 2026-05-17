import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, X } from 'lucide-react';
import { fire } from '../lib/confetti';
import { play } from '../lib/sounds';

export interface UnlockedAchievement {
  code: string;
  title: string;
  description: string;
  points?: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

const RARITY_COLORS: Record<NonNullable<UnlockedAchievement['rarity']>, { bg: string; glow: string; text: string }> = {
  common: { bg: 'from-slate-600 to-slate-700', glow: 'rgba(148,163,184,.5)', text: 'Común' },
  rare: { bg: 'from-cyan-500 to-blue-600', glow: 'rgba(0,212,255,.65)', text: 'Raro' },
  epic: { bg: 'from-purple-500 to-pink-500', glow: 'rgba(168,85,247,.7)', text: 'Épico' },
  legendary: { bg: 'from-yellow-400 to-orange-500', glow: 'rgba(255,180,0,.75)', text: 'Legendario' }
};

/**
 * Modal cinematográfico de unlock — emerge desde abajo, fondo oscurecido,
 * glow del color de la rareza, confetti + sound, auto-dismiss 5s.
 *
 * Lo abres con `unlockAchievement({...})` desde cualquier lugar:
 *   import { unlockAchievement } from '../components/AchievementUnlockModal';
 *   unlockAchievement({ code: 'first_purchase', title: '¡Primera compra!', ... });
 *
 * Maneja una cola: si disparas 3 a la vez, las muestra secuencialmente.
 */

type Listener = (a: UnlockedAchievement) => void;
const listeners = new Set<Listener>();

export function unlockAchievement(a: UnlockedAchievement) {
  for (const l of listeners) l(a);
}

export default function AchievementUnlockModal() {
  const [queue, setQueue] = useState<UnlockedAchievement[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const handler: Listener = (a) => setQueue((q) => [...q, a]);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  useEffect(() => {
    if (!current) return;
    play(current.rarity === 'legendary' ? 'achievement' : 'level_up');
    if (current.rarity === 'legendary') fire('legendary');
    else if (current.rarity === 'epic') fire('levelup');
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 5200);
    return () => clearTimeout(t);
  }, [current]);

  const rarity = current?.rarity ?? 'rare';
  const colors = RARITY_COLORS[rarity];

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.code}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-6 pointer-events-none"
        >
          {/* Backdrop sutil — no bloquea click */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black pointer-events-auto"
            onClick={() => setQueue((q) => q.slice(1))}
          />

          {/* Card */}
          <motion.div
            initial={{ y: 80, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="relative card p-7 max-w-md w-full pointer-events-auto overflow-hidden"
            style={{ boxShadow: `0 30px 80px -20px ${colors.glow}, 0 0 0 1px rgba(255,255,255,.06)` }}
          >
            {/* Sweep effect */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '120%' }}
              transition={{ delay: 0.3, duration: 0.9, ease: 'easeOut' }}
              className="absolute inset-y-0 w-1/2 pointer-events-none"
              style={{ background: `linear-gradient(120deg, transparent, ${colors.glow}, transparent)` }}
            />

            <button
              onClick={() => setQueue((q) => q.slice(1))}
              className="absolute top-3 right-3 w-7 h-7 rounded-full hover:bg-bg-hover flex items-center justify-center text-fg-muted"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-4 relative">
              {/* Icon disc */}
              <motion.div
                initial={{ scale: 0.5, rotate: -45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.bg} shrink-0 flex items-center justify-center shadow-xl`}
              >
                <Trophy size={30} className="text-white drop-shadow" />
              </motion.div>

              <div className="flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] uppercase tracking-[0.2em] text-fg-subtle font-bold mb-0.5"
                >
                  Logro desbloqueado · {colors.text}
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-2xl font-extrabold mb-1 leading-tight"
                >
                  {current.title}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-fg-muted"
                >
                  {current.description}
                </motion.p>
                {current.points != null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45, type: 'spring' }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 text-xs font-bold"
                  >
                    +{current.points} pts
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
