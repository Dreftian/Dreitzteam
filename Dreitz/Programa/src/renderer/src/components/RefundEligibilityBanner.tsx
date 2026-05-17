import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';

/**
 * Muestra al usuario si su pedido califica para refund automático (estilo Steam):
 *   - Verde: cumple política (auto-aprobado al solicitar)
 *   - Amarillo: no cumple (review manual, sin garantía)
 *
 * Se rendea inline en la lista de pedidos / Library item context menu.
 */
type Props = { userId: number; orderItemId: number };

type Eligibility = {
  eligible: boolean;
  autoApprove: boolean;
  daysSincePurchase: number;
  playtimeMinutes: number;
  reason: string;
  policy: { maxDaysSincePurchase: number; maxPlaytimeMinutes: number };
};

export default function RefundEligibilityBanner({ userId, orderItemId }: Props) {
  const [data, setData] = useState<Eligibility | null>(null);
  useEffect(() => {
    window.api.refundsCheckEligibility({ userId, orderItemId }).then(setData).catch(() => setData(null));
  }, [userId, orderItemId]);

  if (!data) return null;
  if (!data.eligible) return null;

  if (data.autoApprove) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/30 text-green-300 text-xs">
        <CheckCircle size={14} className="shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Refund automático disponible</div>
          <div className="text-green-300/80">
            Hace {data.daysSincePurchase} día{data.daysSincePurchase === 1 ? '' : 's'} · {data.playtimeMinutes} min jugados.
            Recibirás el dinero en tu wallet al solicitar.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold">Refund requiere review manual</div>
        <div className="text-yellow-200/80">{data.reason}</div>
        <div className="text-yellow-200/60 mt-0.5 flex items-center gap-1">
          <Clock size={11} /> Política: hasta {data.policy.maxDaysSincePurchase} días + {data.policy.maxPlaytimeMinutes} min
        </div>
      </div>
    </div>
  );
}
