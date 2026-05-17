import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Flame, Plus, Trash2, X } from 'lucide-react';
import { formatDateTime, formatPrice } from '../lib/format';
import { toast } from 'sonner';

interface FlashSale {
  id: number;
  game_id: number;
  title: string;
  discount_percent: number;
  max_units: number | null;
  starts_at: string;
  ends_at: string;
  is_daily_deal: number;
}

interface Game {
  id: number;
  title: string;
  price_final: number;
  capsule_image: string;
}

export default function FlashSales() {
  const { admin } = useAuth();
  const [list, setList] = useState<FlashSale[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    gameId: '' as number | '',
    discount_percent: 50,
    max_units: 5,
    is_daily_deal: false,
    duration: 24
  });

  async function load() {
    setList(await window.api.flashSalesList());
    setGames(await window.api.gamesList());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.gameId) return toast.error('Elige un juego');
    const ends = new Date(Date.now() + draft.duration * 60 * 60 * 1000).toISOString();
    await window.api.flashSalesCreate({
      gameId: Number(draft.gameId),
      discount_percent: draft.discount_percent,
      max_units: draft.max_units || null,
      ends_at: ends,
      is_daily_deal: draft.is_daily_deal,
      adminId: admin?.id
    });
    toast.success(draft.is_daily_deal ? 'Daily Deal creado' : 'Flash sale creado');
    setCreating(false);
    setDraft({ gameId: '', discount_percent: 50, max_units: 5, is_daily_deal: false, duration: 24 });
    await load();
  }

  async function del(s: FlashSale) {
    if (!confirm('¿Eliminar oferta flash?')) return;
    await window.api.flashSalesDelete({ id: s.id, adminId: admin?.id });
    toast.success('Eliminada');
    await load();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold flex items-center gap-3"><Flame className="text-orange-400" /> Flash Sales</h2>
        <button onClick={() => setCreating(true)} className="btn btn-primary text-sm">
          <Plus size={14} /> Nueva oferta flash
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">Oferta limitada por tiempo y/o stock. La marcada como "Daily Deal" sale destacada en la portada.</p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-hover/40 border-b border-border">
            <tr className="text-left text-fg-muted">
              <th className="px-4 py-3 font-semibold">Juego</th>
              <th className="px-4 py-3 font-semibold">Descuento</th>
              <th className="px-4 py-3 font-semibold">Stock máx.</th>
              <th className="px-4 py-3 font-semibold">Inicia</th>
              <th className="px-4 py-3 font-semibold">Termina</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((s) => (
              <tr key={s.id} className="hover:bg-bg-hover/30">
                <td className="px-4 py-3 font-semibold">{s.title}</td>
                <td className="px-4 py-3"><span className="text-orange-400 font-bold">-{s.discount_percent}%</span></td>
                <td className="px-4 py-3 text-fg-muted">{s.max_units ?? 'sin tope'}</td>
                <td className="px-4 py-3 text-xs text-fg-muted">{formatDateTime(s.starts_at)}</td>
                <td className="px-4 py-3 text-xs text-fg-muted">{formatDateTime(s.ends_at)}</td>
                <td className="px-4 py-3">
                  {s.is_daily_deal ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400">DAILY DEAL</span>
                  ) : (
                    <span className="text-xs text-fg-muted">flash</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(s)} className="px-2 py-1 rounded hover:bg-red-500/15 hover:text-red-400 text-xs">
                    <Trash2 size={12} className="inline" />
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-fg-muted">Aún no hay flash sales activas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={create} className="card max-w-md w-full p-6 relative">
            <button type="button" onClick={() => setCreating(false)} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center">
              <X size={15} />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Flame className="text-orange-400" /> Nueva oferta flash</h3>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Juego</label>
            <select className="input mb-3" value={draft.gameId} onChange={(e) => setDraft({ ...draft, gameId: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Elegir juego...</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.title} ({formatPrice(g.price_final)})</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Descuento %</label>
                <input className="input" type="number" min="1" max="95" value={draft.discount_percent}
                  onChange={(e) => setDraft({ ...draft, discount_percent: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Stock máximo</label>
                <input className="input" type="number" min="0" value={draft.max_units}
                  onChange={(e) => setDraft({ ...draft, max_units: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Duración (horas)</label>
            <input className="input mb-4" type="number" min="1" max="168" value={draft.duration}
              onChange={(e) => setDraft({ ...draft, duration: parseInt(e.target.value) || 24 })} />

            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input type="checkbox" checked={draft.is_daily_deal} onChange={(e) => setDraft({ ...draft, is_daily_deal: e.target.checked })} />
              <span className="text-sm">Marcar como <span className="text-yellow-400 font-bold">Daily Deal</span> (aparece en portada)</span>
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={() => setCreating(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn btn-primary flex-1">Crear oferta</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
