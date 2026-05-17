import { useEffect, useState } from 'react';
import { BellRing, Bell, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { play } from '../lib/sounds';

/**
 * Botón que abre un pop sobre el juego permitiendo setear un precio objetivo.
 * Cuando `priceWatcher` (en main) detecta que `price_final < target`, emite el
 * evento `priceAlert:fired` y el usuario recibe una notificación + sonido.
 */
export default function PriceAlertButton({ gameId, currentPrice }: { gameId: number; currentPrice: number }) {
  const { user } = useAuth();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    window.api.priceAlertsList(user.id).then((list: any) => {
      const a = list.find((x: any) => x.game_id === gameId);
      setActive(a?.target_price ?? null);
      if (a?.target_price) setTarget(String(a.target_price));
    }).catch(() => {});
  }, [user?.id, gameId]);

  if (!user) return null;

  async function save() {
    const value = parseFloat(target);
    if (isNaN(value) || value <= 0) return toast.error('Precio inválido');
    if (value >= currentPrice) return toast.error(`El precio objetivo debe ser menor a ${format(currentPrice)}`);
    try {
      await window.api.priceAlertsSet({ userId: user!.id, gameId, targetPrice: value });
      setActive(value);
      setOpen(false);
      play('notify');
      toast.success(`Te avisaremos cuando baje a ${format(value)}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove() {
    try {
      await window.api.priceAlertsRemove({ userId: user!.id, gameId });
      setActive(null);
      setTarget('');
      setOpen(false);
      toast.success('Alerta de precio eliminada');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`btn text-sm flex items-center gap-1.5 ${active ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40' : ''}`}
        title={active ? `Alerta activa a ${format(active)}` : 'Avisar cuando baje de precio'}
      >
        {active ? <BellRing size={14} /> : <Bell size={14} />}
        {active ? format(active) : 'Avisar'}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-2 z-30 card p-4 w-72 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">Alerta de precio</span>
            <button onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg"><X size={14} /></button>
          </div>
          <p className="text-xs text-fg-muted mb-3">
            Precio actual: <span className="font-semibold text-fg">{format(currentPrice)}</span>. Te notificamos cuando baje al menos a:
          </p>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={`< ${currentPrice}`}
            className="input mb-3 text-sm"
            step="0.5"
          />
          <div className="flex gap-2">
            <button onClick={save} className="btn btn-primary text-sm flex-1">Guardar</button>
            {active != null && (
              <button onClick={remove} className="btn text-sm">Quitar</button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
