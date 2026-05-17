import { useEffect, useState } from 'react';
import type { AuditEntry } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { Activity, Download, Filter } from 'lucide-react';
import { downloadCsv } from '../lib/csv';
import { toast } from 'sonner';

const ACTION_BADGE: Record<string, string> = {
  login: 'bg-cyan-500/15 text-cyan-300',
  user_update: 'bg-blue-500/15 text-blue-300',
  user_reset_password: 'bg-yellow-500/15 text-yellow-300',
  user_delete: 'bg-red-500/15 text-red-300',
  user_bulk_update: 'bg-blue-500/15 text-blue-300',
  user_bulk_delete: 'bg-red-500/15 text-red-300',
  game_add: 'bg-green-500/15 text-green-300',
  game_update: 'bg-blue-500/15 text-blue-300',
  game_delete: 'bg-red-500/15 text-red-300',
  license_generate: 'bg-green-500/15 text-green-300',
  license_revoke: 'bg-red-500/15 text-red-300',
  license_bulk_revoke: 'bg-red-500/15 text-red-300',
  bundle_create: 'bg-purple-500/15 text-purple-300',
  bundle_delete: 'bg-red-500/15 text-red-300'
};

export default function AuditLog() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // Si hay filtros server-side, usar audit:filter; sino el list rápido.
      if (since || until || actionFilter) {
        const list: any = await window.api.auditFilter({
          since: since ? new Date(since).toISOString() : undefined,
          until: until ? new Date(until + 'T23:59:59').toISOString() : undefined,
          action: actionFilter || undefined,
          limit: 1000
        });
        setItems(list);
      } else {
        const list = await window.api.auditList(500);
        setItems(list);
      }
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [since, until, actionFilter]);

  const filtered = filter
    ? items.filter((i) =>
        i.action.toLowerCase().includes(filter.toLowerCase()) ||
        i.username.toLowerCase().includes(filter.toLowerCase()) ||
        (i.detail ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : items;

  function exportCsv() {
    if (!filtered.length) return;
    downloadCsv(`audit_log_${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      'created_at', 'username', 'action', 'target_type', 'target_id', 'detail'
    ]);
    toast.success('CSV descargado');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold flex items-center gap-3"><Activity className="text-purple-400" /> Audit log</h2>
        <button onClick={exportCsv} className="btn btn-secondary text-sm" disabled={!filtered.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">Historial completo de acciones administrativas. {items.length} registros.</p>

      <div className="card overflow-hidden mb-1">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-fg-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar en resultados..."
            className="input flex-1 min-w-[200px] py-1.5 text-sm"
          />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input py-1.5 text-sm w-40">
            <option value="">Cualquier acción</option>
            <option value="login">login</option>
            <option value="game_add">game_add</option>
            <option value="game_update">game_update</option>
            <option value="game_delete">game_delete</option>
            <option value="license_generate">license_generate</option>
            <option value="license_revoke">license_revoke</option>
            <option value="yape_approve">yape_approve</option>
            <option value="yape_reject">yape_reject</option>
            <option value="reset_user_password">reset_user_password</option>
            <option value="insforge">insforge</option>
            <option value="supabase">supabase (legacy)</option>
          </select>
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="input py-1.5 text-sm" title="Desde" />
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="input py-1.5 text-sm" title="Hasta" />
          {(since || until || actionFilter) && (
            <button onClick={() => { setSince(''); setUntil(''); setActionFilter(''); }} className="btn text-xs">
              Limpiar
            </button>
          )}
          <span className="ml-auto text-xs text-fg-muted">{loading ? 'cargando…' : `${filtered.length} mostrando`}</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-bg-hover/40 border-b border-border">
            <tr className="text-left text-fg-muted">
              <th className="px-4 py-3 font-semibold">Cuándo</th>
              <th className="px-4 py-3 font-semibold">Admin</th>
              <th className="px-4 py-3 font-semibold">Acción</th>
              <th className="px-4 py-3 font-semibold">Objetivo</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((it) => (
              <tr key={it.id} className="hover:bg-bg-hover/30">
                <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">{formatDateTime(it.created_at)}</td>
                <td className="px-4 py-3 font-semibold">{it.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ACTION_BADGE[it.action] ?? 'bg-bg-hover text-fg-muted'}`}>
                    {it.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-fg-muted text-xs">
                  {it.target_type ?? '—'}{it.target_id ? ` #${it.target_id}` : ''}
                </td>
                <td className="px-4 py-3 text-xs text-fg-muted truncate max-w-md">{it.detail ?? '—'}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-fg-muted">Sin entradas en esta vista.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
