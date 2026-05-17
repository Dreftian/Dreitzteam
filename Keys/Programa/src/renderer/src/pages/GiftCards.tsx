import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Gift, Plus, Copy, Check, Download } from 'lucide-react';
import { formatDateTime, formatPrice } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { toast } from 'sonner';

interface GC {
  id: number;
  code: string;
  amount: number;
  currency: string;
  buyer_id: number | null;
  redeemer_id: number | null;
  buyer_name: string | null;
  redeemer_name: string | null;
  status: string;
  created_at: string;
  sold_at: string | null;
  redeemed_at: string | null;
}

export default function GiftCardsAdmin() {
  const { admin } = useAuth();
  const [list, setList] = useState<GC[]>([]);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState({ amount: 50, quantity: 10 });
  const [copied, setCopied] = useState<string | null>(null);

  async function load() { setList(await window.api.giftCardsList()); }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const r = await window.api.giftCardsGenerate({
        amount: draft.amount,
        quantity: draft.quantity,
        adminId: admin?.id
      });
      toast.success(`${r.codes.length} tarjetas generadas`);
      navigator.clipboard.writeText(r.codes.join('\n'));
      toast.success('Códigos copiados al portapapeles');
      await load();
    } finally { setGenerating(false); }
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  function exportCsv() {
    downloadCsv(`gift_cards_${new Date().toISOString().slice(0, 10)}.csv`, list, [
      'id', 'code', 'amount', 'currency', 'status', 'buyer_name', 'redeemer_name', 'created_at', 'sold_at', 'redeemed_at'
    ]);
    toast.success('CSV descargado');
  }

  const stats = {
    total: list.length,
    sold: list.filter((g) => g.status === 'sold' || g.status === 'redeemed').length,
    redeemed: list.filter((g) => g.status === 'redeemed').length,
    revenue: list.filter((g) => g.status !== 'unsold').reduce((s, g) => s + g.amount, 0)
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold flex items-center gap-3"><Gift className="text-pink-400" /> Tarjetas de regalo</h2>
        <button onClick={exportCsv} className="btn btn-secondary text-sm" disabled={!list.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">Genera códigos en lote para vender a clientes corporativos o entregar como bonos.</p>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Total</div>
          <div className="text-2xl font-extrabold">{stats.total}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Vendidas</div>
          <div className="text-2xl font-extrabold text-cyan-400">{stats.sold}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Canjeadas</div>
          <div className="text-2xl font-extrabold text-green-400">{stats.redeemed}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Ingreso</div>
          <div className="text-2xl font-extrabold text-yellow-400">{formatPrice(stats.revenue)}</div>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Plus size={18} /> Generar nuevas tarjetas</h3>
        <form onSubmit={generate} className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Monto cada una</label>
            <select className="input" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: parseInt(e.target.value) })}>
              <option value={50}>S/. 50</option>
              <option value={100}>S/. 100</option>
              <option value={200}>S/. 200</option>
              <option value={500}>S/. 500</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Cantidad</label>
            <input className="input" type="number" min="1" max="500" value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="flex items-end">
            <button disabled={generating} className="btn btn-primary w-full">
              {generating ? 'Generando...' : `Generar ${draft.quantity} × S/. ${draft.amount}`}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-hover/40 border-b border-border">
            <tr className="text-left text-fg-muted">
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Monto</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Comprador</th>
              <th className="px-4 py-3 font-semibold">Canjeada por</th>
              <th className="px-4 py-3 font-semibold">Generada</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.slice(0, 200).map((g) => (
              <tr key={g.id} className="hover:bg-bg-hover/30">
                <td className="px-4 py-3 font-mono text-xs">{g.code}</td>
                <td className="px-4 py-3 font-bold">{formatPrice(g.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    g.status === 'redeemed' ? 'bg-green-500/15 text-green-400' :
                    g.status === 'sold' ? 'bg-blue-500/15 text-blue-400' :
                    'bg-fg-subtle/15 text-fg-muted'
                  }`}>
                    {g.status === 'unsold' ? 'sin vender' : g.status === 'sold' ? 'vendida' : 'canjeada'}
                  </span>
                </td>
                <td className="px-4 py-3 text-fg-muted">{g.buyer_name ?? '—'}</td>
                <td className="px-4 py-3 text-fg-muted">{g.redeemer_name ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-fg-muted">{formatDateTime(g.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => copy(g.code)} className="px-2 py-1 rounded hover:bg-bg-hover text-xs">
                    {copied === g.code ? <Check size={12} className="inline text-green-400" /> : <Copy size={12} className="inline" />}
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-fg-muted">Aún no hay tarjetas. Genera la primera tanda arriba.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
