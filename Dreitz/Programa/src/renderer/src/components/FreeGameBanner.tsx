import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Loader2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCachedImage } from '../lib/useCachedImage';
import { toast } from 'sonner';
import { fire } from '../lib/confetti';
import { play } from '../lib/sounds';

/**
 * Banner del "Juego gratis de la semana" estilo Epic Games Store.
 * El admin lo configura desde Keys → Free Game; aquí lo mostramos cuando hay
 * uno activo. Botón "Reclamar gratis" lo añade a la biblioteca sin pasar por
 * carrito ni pago.
 */
export default function FreeGameBanner() {
  const { user } = useAuth();
  const [data, setData] = useState<{ game: any; expires_at: string } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    window.api.freeGameCurrent?.().then((r: any) => setData(r)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const bg = useCachedImage(data?.game?.background_image || data?.game?.header_image);

  if (!data) return null;
  if (!user) return null;

  const expires = new Date(data.expires_at).getTime();
  const remainingMs = Math.max(0, expires - now);
  if (remainingMs === 0) return null;

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((remainingMs / (1000 * 60)) % 60);

  async function claim() {
    if (!user) return;
    setClaiming(true);
    try {
      const r: any = await window.api.freeGameClaim({ userId: user.id });
      setClaimed(true);
      play('success');
      fire('gift');
      toast.success(r.alreadyOwned ? 'Ya lo tenías — sin cambios' : `¡${r.game.title} añadido a tu biblioteca!`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setClaiming(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl mb-8 h-56 flex"
      style={{ boxShadow: 'var(--shadow-xl)' }}
    >
      {bg && <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-bg-base/95 via-bg-base/70 to-transparent" />

      <div className="relative flex-1 p-8 flex flex-col justify-center max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="discount-chip px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
            <Gift size={12} /> GRATIS ESTA SEMANA
          </span>
          <span className="text-xs text-fg-muted">
            Termina en {days > 0 ? `${days}d ` : ''}{hours}h {mins}m
          </span>
        </div>
        <h3 className="text-3xl font-extrabold mb-2 drop-shadow-2xl">{data.game.title}</h3>
        <p className="text-fg-muted text-sm mb-4 line-clamp-2 max-w-xl">{data.game.short_description}</p>
        <div className="flex gap-2">
          <button
            onClick={claim}
            disabled={claiming || claimed}
            className="btn btn-primary flex items-center gap-2 font-bold"
            style={{
              background: claimed ? 'var(--intent-success)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: 'white',
              boxShadow: '0 10px 30px -10px rgba(251, 191, 36, 0.55)'
            }}
          >
            {claiming ? <Loader2 size={14} className="animate-spin" /> :
              claimed ? <Check size={14} /> : <Gift size={14} />}
            {claimed ? 'Reclamado' : claiming ? 'Reclamando…' : 'Reclamar gratis'}
          </button>
          <Link to={`/game/${data.game.id}`} className="btn">Ver detalle</Link>
        </div>
      </div>
    </motion.div>
  );
}
