import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/**
 * Pega N URLs/IDs de Steam separados por enter; los procesamos uno por uno
 * llamando a `games:addBySteam` con stock por defecto. Útil para curar el catálogo
 * rápido sin tener que ir uno por uno.
 */
interface RowState {
  input: string;
  status: 'pending' | 'fetching' | 'success' | 'error' | 'duplicate';
  message?: string;
  title?: string;
}

export default function BulkImport() {
  const { admin } = useAuth();
  const [raw, setRaw] = useState('');
  const [stock, setStock] = useState(10);
  const [featured, setFeatured] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [drm, setDrm] = useState<'steam' | 'standalone'>('steam');
  const [rows, setRows] = useState<RowState[]>([]);
  const [running, setRunning] = useState(false);

  function parseInputs(): string[] {
    return raw
      .split(/[\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i); // dedupe
  }

  async function run() {
    const inputs = parseInputs();
    if (!inputs.length) return toast.error('Pega al menos una URL o ID de Steam');
    if (!admin) return;
    setRunning(true);
    const initial: RowState[] = inputs.map((input) => ({ input, status: 'pending' }));
    setRows(initial);

    for (let i = 0; i < inputs.length; i++) {
      setRows((curr) => curr.map((r, idx) => idx === i ? { ...r, status: 'fetching' } : r));
      try {
        const g: any = await window.api.gamesAddBySteam({
          url: inputs[i],
          stock,
          featured,
          drm_platform: drm,
          adminId: admin.id
        });
        // Si el admin quiere también con descuento, hacer un update inmediato
        if (discount > 0 && g?.id) {
          const finalPrice = +(g.price_initial * (1 - discount / 100)).toFixed(2);
          await window.api.gamesUpdate({
            id: g.id,
            price_final: finalPrice,
            discount_percent: discount,
            adminId: admin.id
          });
        }
        setRows((curr) => curr.map((r, idx) => idx === i ? { ...r, status: 'success', title: g.title } : r));
      } catch (e) {
        const msg = (e as Error).message;
        const isDup = /ya está en el catálogo/i.test(msg);
        setRows((curr) => curr.map((r, idx) => idx === i ? {
          ...r,
          status: isDup ? 'duplicate' : 'error',
          message: msg
        } : r));
      }
      // Pequeña pausa entre fetches para no martillar la API pública de Steam.
      await new Promise((res) => setTimeout(res, 600));
    }
    setRunning(false);
    const ok = rows.filter((r) => r.status === 'success').length;
    toast.success(`Importación completa · ${ok}/${inputs.length} agregados`);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Upload className="text-cyan-400" size={28} />
        <h2 className="text-3xl font-bold">Bulk import Steam</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Pega varias URLs o IDs de Steam (una por línea) y se importarán todos al catálogo en secuencia. Genera licencias automáticamente.
      </p>

      <div className="card p-5 mb-6">
        <label className="block">
          <span className="text-xs font-semibold text-fg-muted mb-1.5 block">URLs o IDs de Steam (una por línea)</span>
          <textarea
            className="input min-h-[200px] font-mono text-sm"
            placeholder={`https://store.steampowered.com/app/1086940/Baldurs_Gate_3/
1245620
https://store.steampowered.com/app/489830/`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={running}
          />
        </label>
        <div className="text-[11px] text-fg-subtle mt-1">
          {parseInputs().length} entradas detectadas
        </div>
      </div>

      <div className="card p-5 mb-6 grid sm:grid-cols-4 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-fg-muted mb-1 block">Stock por juego</span>
          <input
            type="number"
            min={1}
            max={100}
            value={stock}
            onChange={(e) => setStock(parseInt(e.target.value) || 10)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-fg-muted mb-1 block">Descuento %</span>
          <input
            type="number"
            min={0}
            max={95}
            value={discount}
            onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-fg-muted mb-1 block">DRM</span>
          <select className="input" value={drm} onChange={(e) => setDrm(e.target.value as any)}>
            <option value="steam">Steam (delegación)</option>
            <option value="standalone">Standalone</option>
          </select>
        </label>
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          <span className="text-xs">Destacar</span>
        </label>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={run}
          disabled={running || !parseInputs().length}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {running ? 'Importando…' : `Importar ${parseInputs().length || 0} juegos`}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="card p-4 space-y-1.5 max-h-[480px] overflow-y-auto">
          {rows.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-2 rounded hover:bg-bg-hover text-sm"
            >
              <RowIcon status={r.status} />
              <div className="flex-1 min-w-0">
                <div className="truncate font-mono text-xs">{r.input}</div>
                {(r.title || r.message) && (
                  <div className={`text-[11px] truncate ${r.status === 'error' ? 'text-red-400' : 'text-fg-subtle'}`}>
                    {r.title || r.message}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function RowIcon({ status }: { status: RowState['status'] }) {
  switch (status) {
    case 'pending':    return <div className="w-4 h-4 rounded-full bg-bg-hover shrink-0" />;
    case 'fetching':   return <Loader2 size={14} className="animate-spin text-cyan-400 shrink-0" />;
    case 'success':    return <CheckCircle2 size={14} className="text-green-400 shrink-0" />;
    case 'duplicate':  return <CheckCircle2 size={14} className="text-yellow-400 shrink-0" />;
    case 'error':      return <AlertCircle size={14} className="text-red-400 shrink-0" />;
  }
}
