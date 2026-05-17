import { useEffect, useState } from 'react';
import { Gift, Copy, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { detectCardBrand, luhnValid, maskCard, formatPrice } from '../lib/format';
import { toast } from 'sonner';
import type { GiftCard } from '../lib/types';

interface CatItem { amount: number; label: string; accent: string }

export default function GiftCards() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<CatItem[]>([]);
  const [mine, setMine] = useState<GiftCard[]>([]);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [showBuy, setShowBuy] = useState<CatItem | null>(null);
  const [card, setCard] = useState({ number: '', exp: '', cvv: '' });

  async function load() {
    setCatalog(await window.api.giftCardsCatalog());
    if (user) setMine(await window.api.giftCardsMine(user.id));
  }
  useEffect(() => { load(); }, [user?.id]);

  function formatNumber(v: string) {
    return v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  function formatExp(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !showBuy) return;
    if (!luhnValid(card.number)) return toast.error('Tarjeta inválida');
    if (!/^\d{2}\/\d{2}$/.test(card.exp)) return toast.error('Vencimiento MM/YY');
    if (!/^\d{3,4}$/.test(card.cvv)) return toast.error('CVV inválido');
    setBuying(showBuy.amount);
    try {
      const r = await window.api.giftCardsPurchase({
        userId: user.id,
        amount: showBuy.amount,
        cardLast4: maskCard(card.number),
        cardBrand: detectCardBrand(card.number)
      });
      toast.success(`Tarjeta comprada · Código: ${r.code}`);
      navigator.clipboard.writeText(r.code);
      setShowBuy(null);
      setCard({ number: '', exp: '', cvv: '' });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBuying(null); }
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setRedeeming(true);
    try {
      const r = await window.api.giftCardsRedeem({ userId: user.id, code });
      toast.success(`+${formatPrice(r.amount)} a tu billetera`);
      setCode('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setRedeeming(false); }
  }

  function copy(c: string) {
    navigator.clipboard.writeText(c);
    setCopied(c);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Gift className="text-pink-400" size={28} />
        <h2 className="text-3xl font-bold">Tarjetas de regalo</h2>
      </div>
      <p className="text-fg-muted text-sm mb-8">Regala saldo Dreitz a un amigo o canjea uno que recibiste.</p>

      <section className="mb-10">
        <h3 className="text-lg font-bold mb-4">Comprar tarjeta</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {catalog.map((c) => (
            <button
              key={c.amount}
              onClick={() => setShowBuy(c)}
              className="card p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform text-left"
              style={{ background: `linear-gradient(135deg, ${c.accent}30 0%, var(--bg-card) 50%, ${c.accent}15 100%)` }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: c.accent }} />
              <Gift className="mb-3" size={26} style={{ color: c.accent }} />
              <div className="text-3xl font-extrabold mb-1">S/. {c.amount}</div>
              <div className="text-xs text-fg-muted">{c.label}</div>
              <div className="mt-4 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: c.accent }}>
                <Sparkles size={10} /> Comprar
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-lg font-bold mb-4">Canjear código</h3>
        <form onSubmit={redeem} className="card p-5 flex gap-3 items-center">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GC-XXXX-XXXX-XXXX"
            className="input font-mono"
          />
          <button type="submit" disabled={redeeming || !code} className="btn btn-primary whitespace-nowrap">
            {redeeming ? 'Canjeando...' : 'Canjear'}
          </button>
        </form>
      </section>

      {mine.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-4">Mis tarjetas</h3>
          <div className="card divide-y divide-border">
            {mine.map((g) => (
              <div key={g.id} className="p-4 flex items-center gap-4">
                <Gift className={g.status === 'redeemed' ? 'text-fg-subtle' : 'text-pink-400'} size={20} />
                <div className="flex-1">
                  <code className="font-mono text-sm">{g.code}</code>
                  <div className="text-[11px] text-fg-subtle">
                    {g.status === 'redeemed' ? 'Canjeada' : g.status === 'sold' ? 'Pendiente de canje' : 'Pendiente'}
                    {g.buyer_id === user?.id && g.redeemer_id && g.redeemer_id !== user?.id ? ' por otro usuario' : ''}
                  </div>
                </div>
                <span className="font-bold">{formatPrice(g.amount)}</span>
                <button onClick={() => copy(g.code)} className="px-2 py-1 rounded hover:bg-bg-hover text-xs">
                  {copied === g.code ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showBuy && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={buy} className="card max-w-md w-full p-6 relative">
            <h3 className="text-lg font-bold mb-1">Comprar tarjeta S/. {showBuy.amount}</h3>
            <p className="text-xs text-fg-muted mb-4">El código aparecerá tras la compra y se copia al portapapeles.</p>

            <input className="input mb-3" placeholder="0000 0000 0000 0000"
              value={card.number}
              onChange={(e) => setCard((c) => ({ ...c, number: formatNumber(e.target.value) }))} />
            <div className="grid grid-cols-2 gap-3 mb-5">
              <input className="input" placeholder="MM/YY" value={card.exp}
                onChange={(e) => setCard((c) => ({ ...c, exp: formatExp(e.target.value) }))} />
              <input className="input" type="password" placeholder="CVV" value={card.cvv}
                onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBuy(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={buying === showBuy.amount} className="btn btn-primary flex-1">
                {buying === showBuy.amount ? 'Procesando...' : `Pagar S/. ${showBuy.amount}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
