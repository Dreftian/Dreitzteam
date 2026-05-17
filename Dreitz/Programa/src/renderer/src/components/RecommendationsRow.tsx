import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import GameCard from './GameCard';
import { useAuth } from '../contexts/AuthContext';

/**
 * Fila de recomendaciones IA. Llama a `recommend:forUser` (Claude Haiku 4.5)
 * que devuelve 6 juegos personalizados con razón en lenguaje natural.
 *
 * Cacheado 24h. Botón refresh fuerza nuevas recomendaciones.
 */
export default function RecommendationsRow() {
  const { user } = useAuth();
  const [recs, setRecs] = useState<Array<{ game: any; reason: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(force = false) {
    if (!user) return;
    setLoading(true);
    try {
      const r = await window.api.recommendForUser({ userId: user.id, force });
      setRecs(r);
    } catch (e) {
      console.warn('[recs]', e);
      setRecs([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user?.id]);

  if (!user) return null;
  if (recs && recs.length === 0) return null; // sin recs, ocultamos discreto

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title text-xl flex items-center gap-2">
          <Sparkles size={16} className="text-yellow-400" /> Curado para ti
        </h3>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="btn text-xs flex items-center gap-1.5"
          title="Recargar recomendaciones (consume IA)"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Renovar
        </button>
      </div>
      {!recs ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-48 skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {recs.map((r, i) => (
            <motion.div
              key={r.game.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 240, damping: 22 }}
              className="relative"
            >
              <GameCard game={r.game} size="page" />
              <div className="mt-2 px-2 text-xs text-fg-muted line-clamp-2 italic">
                <span className="text-yellow-400">✨</span> {r.reason}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
