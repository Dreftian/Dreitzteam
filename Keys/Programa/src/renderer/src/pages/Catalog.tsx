import { useEffect, useMemo, useState } from 'react';
import type { Game } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Edit, Trash2, Eye, EyeOff, Star, X, Save, Search, Download, Plus } from 'lucide-react';
import { formatPrice } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { toast } from 'sonner';
import GameZipUpload from '../components/GameZipUpload';

export default function Catalog() {
  const { admin } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [editing, setEditing] = useState<Game | null>(null);
  const [search, setSearch] = useState('');

  async function load() { setGames(await window.api.gamesList()); }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    if (!search.trim()) return games;
    const q = search.toLowerCase();
    return games.filter((g) => g.title.toLowerCase().includes(q) || (g.developer ?? '').toLowerCase().includes(q));
  }, [games, search]);

  async function toggleActive(g: Game) {
    await window.api.gamesUpdate({ id: g.id, is_active: !g.is_active, adminId: admin?.id });
    await load();
  }
  async function toggleFeatured(g: Game) {
    await window.api.gamesUpdate({ id: g.id, is_featured: !g.is_featured, adminId: admin?.id });
    await load();
  }
  async function del(g: Game) {
    if (!confirm(`¿Eliminar ${g.title} del catálogo?`)) return;
    await window.api.gamesDelete({ id: g.id, adminId: admin?.id });
    toast.success(`${g.title} eliminado`);
    await load();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await window.api.gamesUpdate({
      id: editing.id,
      price_final: editing.price_final,
      discount_percent: editing.discount_percent,
      stock: editing.stock,
      discount_ends_at: editing.discount_ends_at ?? undefined,
      adminId: admin?.id
    });
    toast.success(`${editing.title} actualizado`);
    setEditing(null);
    await load();
  }

  function exportCsv() {
    downloadCsv(`catalog_${new Date().toISOString().slice(0, 10)}.csv`, visible, [
      'id', 'steam_app_id', 'title', 'developer', 'publisher', 'price_initial', 'price_final',
      'discount_percent', 'currency', 'stock', 'is_featured', 'is_active', 'created_at'
    ]);
    toast.success('CSV descargado');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold">Catálogo</h2>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn btn-secondary text-sm" disabled={!visible.length}>
            <Download size={14} /> Exportar CSV
          </button>
          <a href="#/add-game" className="btn btn-primary text-sm"><Plus size={14} /> Agregar juego</a>
        </div>
      </div>
      <p className="text-fg-muted text-sm mb-4">{games.length} título{games.length === 1 ? '' : 's'} · {visible.length} visibles</p>

      <div className="card p-3 mb-4 flex items-center gap-2">
        <Search size={14} className="text-fg-muted ml-2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título o desarrollador..."
          className="input flex-1 py-1.5 text-sm border-0 bg-transparent focus:shadow-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((g) => (
          <div key={g.id} className="card overflow-hidden">
            {g.header_image && <img src={g.header_image} alt="" className="w-full aspect-[460/215] object-cover" />}
            <div className="p-4">
              <div className="font-bold mb-1 truncate">{g.title}</div>
              <div className="text-xs text-fg-muted mb-2">App ID Steam: {g.steam_app_id}</div>
              <div className="flex items-center justify-between text-sm mb-3">
                <div>
                  {g.discount_percent > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 mr-1">-{g.discount_percent}%</span>}
                  <span className="font-bold">{formatPrice(g.price_final, g.currency)}</span>
                </div>
                <div className="text-xs text-fg-muted">Stock: {g.stock}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setEditing(g)} className="btn btn-secondary text-xs"><Edit size={12} /> Editar</button>
                <button onClick={() => toggleFeatured(g)} className={`btn text-xs ${g.is_featured ? 'btn-primary' : 'btn-secondary'}`}>
                  <Star size={12} /> Destacado
                </button>
                <button onClick={() => toggleActive(g)} className="btn btn-secondary text-xs">
                  {g.is_active ? <><Eye size={12} /> Visible</> : <><EyeOff size={12} /> Oculto</>}
                </button>
                <button onClick={() => del(g)} className="btn btn-danger text-xs"><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
        {!visible.length && (
          <div className="col-span-full card p-10 text-center text-fg-muted">
            {search ? 'Sin resultados.' : <>Aún no tienes juegos. <a href="#/add-game" className="text-accent">Agrega el primero por URL de Steam</a>.</>}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={save} className="card max-w-md w-full p-6 relative">
            <button type="button" onClick={() => setEditing(null)} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center"><X size={15} /></button>
            <h3 className="text-lg font-bold mb-4">Editar {editing.title}</h3>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Precio final ({editing.currency})</label>
            <input className="input mb-3" type="number" step="0.01" value={editing.price_final}
              onChange={(e) => setEditing({ ...editing, price_final: parseFloat(e.target.value) || 0 })} />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Descuento %</label>
            <input className="input mb-3" type="number" min="0" max="100" value={editing.discount_percent}
              onChange={(e) => setEditing({ ...editing, discount_percent: parseInt(e.target.value) || 0 })} />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Stock</label>
            <input className="input mb-3" type="number" min="0" value={editing.stock}
              onChange={(e) => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })} />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Fin de oferta (opcional)</label>
            <input
              className="input mb-5"
              type="datetime-local"
              value={editing.discount_ends_at ? editing.discount_ends_at.slice(0, 16) : ''}
              onChange={(e) => setEditing({ ...editing, discount_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />

            {/* Upload del .zip del juego a InsForge Storage para que los usuarios lo descarguen */}
            <GameZipUpload
              gameId={editing.id}
              currentUrl={(editing as any).download_url}
              currentSize={(editing as any).download_size_bytes}
            />

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn btn-primary flex-1"><Save size={14} /> Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
