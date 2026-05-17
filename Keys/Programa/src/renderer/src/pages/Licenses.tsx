import { useEffect, useState, useMemo } from 'react';
import type { Game, License } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Copy, Check, Ban, Download, Search, MessageCircle } from 'lucide-react';
import { formatDateTime } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  available: 'text-green-400 bg-green-500/15',
  sold: 'text-blue-400 bg-blue-500/15',
  redeemed: 'text-purple-400 bg-purple-500/15',
  revoked: 'text-red-400 bg-red-500/15'
};

export default function LicensesPage() {
  const { admin } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [filter, setFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [genGame, setGenGame] = useState<number | ''>('');
  const [genQty, setGenQty] = useState(10);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function loadGames() { setGames(await window.api.gamesList()); }
  async function loadLicenses() {
    setLicenses(await window.api.licensesList(filter ?? undefined));
    setSelected(new Set());
  }

  useEffect(() => { loadGames(); }, []);
  useEffect(() => { loadLicenses(); }, [filter]);

  const visible = useMemo(() => {
    return licenses.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.code.toLowerCase().includes(q) && !l.game_title.toLowerCase().includes(q) && !(l.buyer ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [licenses, statusFilter, search]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!genGame) return;
    setBusy(true);
    try {
      const r = await window.api.licensesGenerate({ gameId: Number(genGame), quantity: genQty, adminId: admin?.id });
      toast.success(`${r.generated} licencias generadas`);
      await loadLicenses();
    } finally { setBusy(false); }
  }

  /**
   * Abre WhatsApp Web/App con la clave pre-rellenada. Usa la plantilla
   * `whatsapp_default` si existe, sino un mensaje genérico.
   */
  async function sendByWhatsApp(l: any) {
    try {
      const templates: any[] = await window.api.templatesList();
      const tpl = templates.find((t: any) => t.slug === 'whatsapp_default') ?? templates[0];
      let body: string;
      if (tpl) {
        const r: any = await window.api.templatesRender({
          templateId: tpl.id,
          vars: {
            nombre: l.buyer ?? 'amigo',
            juego: l.game_title,
            clave: l.code,
            fecha: new Date().toLocaleDateString('es-PE')
          }
        });
        body = r.body;
      } else {
        body = `¡Hola! 🎮\n\nTu clave de *${l.game_title}* en Dreitz:\n*${l.code}*\n\nActívala en el launcher → Activar clave.`;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank');
    } catch (e) {
      toast.error('No se pudo abrir WhatsApp: ' + (e as Error).message);
    }
  }

  function copyCode(id: number, code: string) {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  function copySelectedToClipboard() {
    if (!selected.size) return;
    const codes = visible.filter((l) => selected.has(l.id)).map((l) => l.code).join('\n');
    navigator.clipboard.writeText(codes);
    toast.success(`${selected.size} códigos copiados`);
  }

  async function revoke(l: License) {
    if (!confirm(`¿Revocar la licencia ${l.code}?`)) return;
    await window.api.licensesRevoke({ id: l.id, adminId: admin?.id });
    toast.success('Licencia revocada');
    await loadLicenses();
  }

  async function bulkRevoke() {
    if (!selected.size) return;
    if (!confirm(`Revocar ${selected.size} licencias seleccionadas?`)) return;
    const r = await window.api.licensesBulkRevoke({ ids: [...selected], adminId: admin?.id });
    toast.success(`${r.revoked} revocadas`);
    await loadLicenses();
  }

  function toggleAll() {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((l) => l.id)));
  }
  function toggleOne(id: number) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  function exportCsv() {
    downloadCsv(`licenses_${new Date().toISOString().slice(0, 10)}.csv`, visible, [
      'id', 'code', 'game_title', 'status', 'buyer', 'created_at', 'sold_at', 'redeemed_at'
    ]);
    toast.success('CSV descargado');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold">Licencias</h2>
        <button onClick={exportCsv} className="btn btn-secondary text-sm" disabled={!visible.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">{visible.length} en vista · {licenses.length} total</p>

      <div className="card p-5 mb-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Plus size={18} /> Generar nuevas licencias</h3>
        <form onSubmit={generate} className="grid sm:grid-cols-3 gap-3">
          <select className="input" value={genGame} onChange={(e) => setGenGame(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Selecciona un juego</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <input className="input" type="number" min="1" max="500" value={genQty} onChange={(e) => setGenQty(parseInt(e.target.value) || 1)} placeholder="Cantidad" />
          <button disabled={!genGame || busy} className="btn btn-primary">
            {busy ? 'Generando...' : `Generar ${genQty} licencias`}
          </button>
        </form>
      </div>

      {selected.size > 0 && (
        <div className="card p-3 mb-3 flex items-center gap-2 bg-accent/10 border-accent/30">
          <span className="text-sm font-semibold">{selected.size} seleccionadas</span>
          <button onClick={copySelectedToClipboard} className="btn btn-secondary text-xs"><Copy size={12} /> Copiar todas</button>
          <button onClick={bulkRevoke} className="btn btn-danger text-xs ml-auto"><Ban size={12} /> Revocar seleccionadas</button>
          <button onClick={() => setSelected(new Set())} className="btn btn-secondary text-xs">Cancelar</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <select className="input max-w-xs py-1.5 text-sm" value={filter ?? ''} onChange={(e) => setFilter(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todos los juegos</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <select className="input max-w-[10rem] py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="available">Disponible</option>
            <option value="sold">Vendida</option>
            <option value="redeemed">Canjeada</option>
            <option value="revoked">Revocada</option>
          </select>
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código, juego o comprador..."
              className="input pl-8 py-1.5 text-sm"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-bg-hover/40 border-b border-border">
            <tr className="text-left text-fg-muted">
              <th className="px-3 py-3">
                <input type="checkbox" checked={visible.length > 0 && selected.size === visible.length} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Juego</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Comprador</th>
              <th className="px-4 py-3 font-semibold">Generada</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((l) => (
              <tr key={l.id} className={`hover:bg-bg-hover/30 ${selected.has(l.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-3 truncate max-w-xs">{l.game_title}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[l.status] ?? 'text-fg-muted'}`}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-fg-muted">{l.buyer ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-fg-muted">{formatDateTime(l.created_at)}</td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button onClick={() => copyCode(l.id, l.code)} className="px-2 py-1 rounded hover:bg-bg-hover text-xs" title="Copiar clave">
                    {copied === l.id ? <Check size={12} className="inline text-green-400" /> : <Copy size={12} className="inline" />}
                  </button>
                  <button
                    onClick={() => sendByWhatsApp(l)}
                    className="px-2 py-1 rounded hover:bg-green-500/15 hover:text-green-400 text-xs"
                    title="Enviar por WhatsApp"
                  >
                    <MessageCircle size={12} className="inline" />
                  </button>
                  {l.status === 'available' && (
                    <button onClick={() => revoke(l)} className="px-2 py-1 rounded hover:bg-red-500/15 hover:text-red-400 text-xs" title="Revocar"><Ban size={12} className="inline" /></button>
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-fg-muted">Sin licencias en esta vista.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
