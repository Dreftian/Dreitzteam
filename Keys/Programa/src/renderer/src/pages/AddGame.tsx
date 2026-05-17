import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Plus } from 'lucide-react';
import { formatPrice } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function AddGame() {
  const nav = useNavigate();
  const { admin } = useAuth();
  const [url, setUrl] = useState('');
  const [stock, setStock] = useState(10);
  const [featured, setFeatured] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  async function loadPreview() {
    setError('');
    setPreview(null);
    if (!url.trim()) return setError('Pega una URL de Steam o el App ID');
    setLoading(true);
    try {
      const data = await window.api.steamFetch(url);
      if (!data) return setError('No se encontró el juego en Steam');
      setPreview(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    setError('');
    setAdding(true);
    try {
      await window.api.gamesAddBySteam({ url, stock, featured, adminId: admin?.id });
      toast.success('Juego agregado al catálogo');
      nav('/catalog');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-1">Agregar juego al catálogo</h2>
      <p className="text-fg-muted text-sm mb-6">
        Importa cualquier título de Steam por URL. Los precios se sincronizan en tiempo real desde la tienda Steam (región Perú).
      </p>

      <div className="card p-5 mb-6">
        <label className="block text-xs font-semibold text-fg-muted mb-1.5">URL de Steam o App ID</label>
        <div className="flex gap-2 mb-3">
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://store.steampowered.com/app/3764200/Resident_Evil_Requiem/"
          />
          <button onClick={loadPreview} disabled={loading} className="btn btn-secondary whitespace-nowrap">
            <Search size={15} /> {loading ? 'Buscando...' : 'Vista previa'}
          </button>
        </div>
        <div className="text-xs text-fg-subtle">
          También puedes pegar solo el ID numérico (ej. <span className="font-mono text-accent">3764200</span>).
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {preview && (
        <div className="card overflow-hidden mb-5">
          {preview.header_image && <img src={preview.header_image} alt="" className="w-full aspect-[460/215] object-cover" />}
          <div className="p-5">
            <h3 className="text-2xl font-bold mb-1">{preview.title}</h3>
            <div className="text-sm text-fg-muted mb-3">
              {preview.developer} · {preview.release_date}
            </div>
            <p className="text-sm text-fg-muted mb-4">{preview.short_description}</p>

            <div className="flex flex-wrap gap-1 mb-4">
              {preview.genres?.map((g: string) => (
                <span key={g} className="px-2 py-0.5 rounded text-[11px] bg-bg-hover text-fg-muted">{g}</span>
              ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              <div className="card p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">Precio</div>
                <div className="text-lg font-bold">{formatPrice(preview.price_final, preview.currency)}</div>
                {preview.discount_percent > 0 && (
                  <div className="text-[10px] text-green-400">-{preview.discount_percent}% (precio Steam)</div>
                )}
              </div>
              <div className="card p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">App ID</div>
                <div className="text-lg font-bold">{preview.steam_app_id}</div>
              </div>
              <div className="card p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">Capturas</div>
                <div className="text-lg font-bold">{preview.screenshots?.length ?? 0}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Stock inicial</label>
                <input className="input" type="number" min="1" value={stock} onChange={(e) => setStock(parseInt(e.target.value) || 1)} />
                <div className="text-[10px] text-fg-subtle mt-1">Se generarán {stock} licencias automáticamente.</div>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                  <span className="text-sm">Marcar como destacado en la tienda</span>
                </label>
              </div>
            </div>

            <button onClick={add} disabled={adding} className="btn btn-primary w-full">
              {adding ? 'Agregando...' : <><Plus size={16} /> Agregar al catálogo</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
