import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDateTime, formatPrice } from '../lib/format';
import { toast } from 'sonner';

interface Refund {
  id: number;
  user_id: number;
  username: string;
  order_id: number;
  order_item_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decision: string | null;
  decided_at: string | null;
  created_at: string;
  game_title: string;
  price: number;
}

export default function RefundsAdmin() {
  const { admin } = useAuth();
  const [list, setList] = useState<Refund[]>([]);
  const [decideTarget, setDecideTarget] = useState<{ r: Refund; approved: boolean } | null>(null);
  const [decision, setDecision] = useState('');

  async function load() { setList(await window.api.refundsList()); }
  useEffect(() => { load(); }, []);

  async function decide(e: React.FormEvent) {
    e.preventDefault();
    if (!decideTarget) return;
    await window.api.refundsDecide({
      id: decideTarget.r.id,
      approved: decideTarget.approved,
      decision: decision.trim() || null,
      adminId: admin?.id
    });
    toast.success(decideTarget.approved ? 'Reembolso aprobado · billetera abonada' : 'Solicitud rechazada');
    setDecideTarget(null);
    setDecision('');
    await load();
  }

  const pending = list.filter((r) => r.status === 'pending');
  const decided = list.filter((r) => r.status !== 'pending');

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-1 flex items-center gap-3"><RotateCcw className="text-orange-400" /> Reembolsos</h2>
      <p className="text-fg-muted text-sm mb-6">{pending.length} pendiente{pending.length === 1 ? '' : 's'} · {decided.length} resueltos</p>

      {pending.length > 0 && (
        <section className="mb-8">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Clock size={16} className="text-yellow-400" /> Pendientes</h3>
          <div className="card divide-y divide-border">
            {pending.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{r.game_title}</span>
                      <span className="text-xs text-fg-muted">por {r.username} · pedido #{r.order_id}</span>
                    </div>
                    <p className="text-sm text-fg-muted mb-2">{r.reason}</p>
                    <div className="text-[11px] text-fg-subtle">{formatDateTime(r.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold mb-2">{formatPrice(r.price)}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDecideTarget({ r, approved: true })}
                        className="btn btn-primary text-xs"
                      >
                        <CheckCircle size={12} /> Aprobar
                      </button>
                      <button
                        onClick={() => setDecideTarget({ r, approved: false })}
                        className="btn btn-danger text-xs"
                      >
                        <XCircle size={12} /> Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {decided.length > 0 && (
        <section>
          <h3 className="font-bold mb-3">Historial</h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-hover/40 border-b border-border">
                <tr className="text-left text-fg-muted">
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Juego</th>
                  <th className="px-4 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Decisión</th>
                  <th className="px-4 py-3 font-semibold">Resuelto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {decided.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-hover/30">
                    <td className="px-4 py-3 font-semibold">{r.username}</td>
                    <td className="px-4 py-3">{r.game_title}</td>
                    <td className="px-4 py-3 font-bold">{formatPrice(r.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {r.status === 'approved' ? 'aprobado' : 'rechazado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted truncate max-w-md">{r.decision ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-fg-muted">{r.decided_at ? formatDateTime(r.decided_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!list.length && (
        <div className="card p-10 text-center text-fg-muted">Sin solicitudes.</div>
      )}

      {decideTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={decide} className="card max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-1">
              {decideTarget.approved ? 'Aprobar reembolso' : 'Rechazar reembolso'}
            </h3>
            <p className="text-xs text-fg-muted mb-4">
              {decideTarget.r.game_title} · {formatPrice(decideTarget.r.price)} · {decideTarget.r.username}
            </p>

            {decideTarget.approved && (
              <div className="card p-3 mb-4 bg-yellow-500/10 border-yellow-500/30 text-xs text-yellow-200/90">
                Al aprobar: la clave queda revocada (vuelve al pool), el monto se acredita a la billetera del usuario.
              </div>
            )}

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Mensaje al cliente (opcional)</label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="input min-h-[100px] mb-5"
              placeholder="Ej: Aprobado por error de descarga. Disculpas por las molestias."
              maxLength={300}
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setDecideTarget(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" className={decideTarget.approved ? 'btn btn-primary flex-1' : 'btn btn-danger flex-1'}>
                {decideTarget.approved ? 'Aprobar' : 'Rechazar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
