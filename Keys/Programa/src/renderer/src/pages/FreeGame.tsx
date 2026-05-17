import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, X, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/**
 * Admin → Free Game Weekly. Marca un juego como "gratis" por N días;
 * todos los usuarios verán un banner en Store con botón "Reclamar gratis".
 */
export default function FreeGameAdmin() {
  const { admin } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);
  const [pickGameId, setPickGameId] = useState<number | null>(null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [gs, cur] = await Promise.all([
      window.api.gamesList(),
      window.api.freeGameGet()
    ]);
    setGames(gs as any[]);
    setCurrent(cur);
  }
  useEffect(() => { load(); }, []);

  async function setFree() {
    if (!pickGameId) return toast.error('Selecciona un juego');
    setBusy(true);
    try {
      await window.api.freeGameSet({ adminId: admin?.id, gameId: pickGameId, daysActive: days });
      toast.success(`Juego marcado gratis por ${days} días`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!confirm('¿Quitar el juego gratis actual?')) return;
    await window.api.freeGameClear({ adminId: admin?.id });
    toast.success('Juego gratis eliminado');
    await load();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Gift className="text-yellow-400" size={28} />
        <h2 className="text-3xl font-bold">Juego gratis de la semana</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Estilo Epic Games — marca un juego como gratis durante N días. Los usuarios verán un banner en Store
        y pueden reclamarlo a su biblioteca sin pagar. Consume una licencia disponible por usuario.
      </p>

      {current ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5 mb-6 border-yellow-500/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              {current.game?.header_image && (
                <img src={current.game.header_image} alt="" className="w-32 aspect-[460/215] object-cover rounded" />
              )}
              <div>
                <div className="text-xs uppercase tracking-wider text-yellow-300 mb-1 font-bold">GRATIS AHORA</div>
                <div className="text-lg font-bold mb-1">{current.game?.title}</div>
                <div className="text-xs text-fg-muted">
                  Termina: {new Date(current.expires_at).toLocaleString('es-PE')}
                </div>
              </div>
            </div>
            <button onClick={clear} className="btn text-xs hover:text-red-400" title="Quitar">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="card p-5 mb-6 text-center text-fg-muted text-sm">
          No hay juego gratis activo.
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-bold mb-4">Configurar próximo juego gratis</h3>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-fg-muted mb-1 block">Juego</span>
          <select
            className="input"
            value={pickGameId ?? ''}
            onChange={(e) => setPickGameId(parseInt(e.target.value) || null)}
          >
            <option value="">— Selecciona —</option>
            {games.filter((g: any) => !g.is_dlc && g.is_active).map((g: any) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </label>
        <label className="block mb-4">
          <span className="text-xs font-semibold text-fg-muted mb-1 block">Duración (días)</span>
          <input
            type="number"
            min={1}
            max={30}
            className="input w-32"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 7)}
          />
        </label>
        <button onClick={setFree} disabled={busy || !pickGameId} className="btn btn-primary flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
          Activar
        </button>
      </div>
    </div>
  );
}
