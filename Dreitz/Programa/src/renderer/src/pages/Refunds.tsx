import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDate, formatPrice } from '../lib/format';
import type { RefundRequest } from '../lib/types';
import EmptyState from '../components/EmptyState';
import { Link } from 'react-router-dom';

const STATUS_BADGE: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'bg-yellow-500/15 text-yellow-300', icon: Clock, label: 'Pendiente' },
  approved: { color: 'bg-green-500/15 text-green-300', icon: CheckCircle, label: 'Aprobado' },
  rejected: { color: 'bg-red-500/15 text-red-300', icon: XCircle, label: 'Rechazado' }
};

export default function Refunds() {
  const { user } = useAuth();
  const [list, setList] = useState<RefundRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    window.api.refundsMine(user.id).then(setList);
  }, [user?.id]);

  if (!list.length) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-1 flex items-center gap-3"><RotateCcw className="text-orange-400" /> Reembolsos</h2>
        <p className="text-fg-muted text-sm mb-6">Solicita un reembolso desde tu biblioteca si no quedaste satisfecho.</p>
        <EmptyState
          illustration="library"
          title="Sin solicitudes activas"
          body="Cuando solicites un reembolso aparecerá aquí su estado."
          cta={<Link to="/library" className="btn btn-primary text-sm">Ir a la biblioteca</Link>}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-1 flex items-center gap-3"><RotateCcw className="text-orange-400" /> Reembolsos</h2>
      <p className="text-fg-muted text-sm mb-6">{list.length} solicitud{list.length === 1 ? '' : 'es'}</p>

      <div className="card divide-y divide-border">
        {list.map((r) => {
          const b = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
          const Icon = b.icon;
          return (
            <div key={r.id} className="p-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${b.color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">{r.game_title}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${b.color}`}>{b.label}</span>
                </div>
                <div className="text-xs text-fg-muted mb-2">Pedido #{r.order_id} · {formatDate(r.created_at)}</div>
                <p className="text-sm text-fg-muted">{r.reason}</p>
                {r.decision && (
                  <div className="mt-2 text-xs italic text-fg-subtle">Respuesta del admin: {r.decision}</div>
                )}
              </div>
              <div className="text-right">
                <div className="font-bold">{r.price ? formatPrice(r.price) : '—'}</div>
                {r.status === 'approved' && (
                  <div className="text-[10px] text-green-400 font-semibold">A tu billetera</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
