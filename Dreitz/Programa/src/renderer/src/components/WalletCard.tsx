import { useEffect, useState } from 'react';
import { Wallet, Plus, Loader2, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/**
 * Wallet recargable — el usuario sube S/. al saldo via Yape una sola vez y
 * después puede comprar juegos sin volver a verificar Yape. Reduce fricción
 * a "click → comprar" para usuarios recurrentes.
 */
export default function WalletCard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState<number>(20);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!user) return;
    const w: any = await window.api.walletGet?.(user.id);
    setBalance(w?.balance ?? 0);
  }
  useEffect(() => { load(); }, [user?.id]);

  function onPickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error('Máx 2 MB');
    const reader = new FileReader();
    reader.onload = () => setReceipt(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function recharge() {
    if (!user || !receipt) return;
    setBusy(true);
    try {
      const r: any = await window.api.walletRecharge?.({
        userId: user.id,
        amount,
        receiptDataUrl: receipt
      });
      if (r?.ok) {
        toast.success(`+S/. ${amount} acreditado`);
        setBalance(r.balance);
        setReceipt(null);
      } else {
        toast.error(r?.reason ?? 'Yape no validado');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={17} className="text-yellow-400" />
          <h3 className="font-bold">Wallet</h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle">Saldo</div>
          <div className="text-2xl font-extrabold text-yellow-400">S/. {balance.toFixed(2)}</div>
        </div>
      </div>
      <p className="text-xs text-fg-muted mb-3">
        Recarga tu saldo con Yape una vez y compra después en 1 click — sin volver a
        verificar pago. Útil para flash sales o regalos de último minuto.
      </p>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {[20, 50, 100, 200].map((n) => (
          <button
            key={n}
            onClick={() => setAmount(n)}
            className={`btn text-sm py-2 ${amount === n ? 'border-yellow-400 text-yellow-400' : ''}`}
          >
            S/. {n}
          </button>
        ))}
      </div>

      <label className="block">
        <input type="file" accept="image/*" className="hidden" onChange={onPickReceipt} />
        <span className="btn text-sm w-full flex items-center justify-center gap-2 cursor-pointer">
          {receipt ? <Check size={14} className="text-green-400" /> : <Upload size={14} />}
          {receipt ? 'Screenshot Yape cargado' : 'Sube screenshot del Yape'}
        </span>
      </label>

      <button
        onClick={recharge}
        disabled={!receipt || busy || amount <= 0}
        className="btn btn-primary w-full text-sm mt-3 flex items-center justify-center gap-2"
        style={{ background: '#fde047', color: '#0a0e1a' }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Recargar S/. {amount}
      </button>
    </section>
  );
}
