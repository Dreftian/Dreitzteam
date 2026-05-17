import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function RefundDialog({
  orderId, orderItemId, gameTitle, onClose
}: { orderId: number; orderItemId: number; gameTitle: string; onClose: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || reason.trim().length < 10) {
      toast.error('Cuéntanos al menos 10 caracteres');
      return;
    }
    setBusy(true);
    try {
      await window.api.refundsRequest({ userId: user.id, orderId, orderItemId, reason: reason.trim() });
      toast.success('Solicitud de reembolso enviada — un admin la revisará.');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="card max-w-md w-full p-6 relative">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center">
          <X size={15} />
        </button>
        <h3 className="text-lg font-bold mb-1">Solicitar reembolso</h3>
        <p className="text-xs text-fg-muted mb-4">{gameTitle}</p>

        <div className="card p-3 mb-4 bg-yellow-500/10 border-yellow-500/30 text-xs text-yellow-200/90 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          Si tu reembolso es aprobado, tu clave será revocada y el monto vuelve a tu billetera para usar en futuras compras.
        </div>

        <label className="block text-xs font-semibold text-fg-muted mb-1.5">¿Por qué quieres el reembolso?</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Cuéntanos qué pasó (mínimo 10 caracteres)"
          className="input mb-5 min-h-[120px]"
          maxLength={500}
        />

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={busy} className="btn btn-primary flex-1">
            {busy ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  );
}
