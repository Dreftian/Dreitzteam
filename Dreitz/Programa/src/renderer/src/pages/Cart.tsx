import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Trash2, Coins, Wallet as WalletIcon } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { useI18n } from '../lib/i18n';
import { toast } from 'sonner';
import type { Wallet } from '../lib/types';

export default function Cart() {
  const { items, remove, total } = useCart();
  const { user } = useAuth();
  const { format } = useCurrency();
  const nav = useNavigate();
  const { t } = useI18n();
  const [points, setPoints] = useState({ balance: 0, redeem_value: 0.05 });
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [usePoints, setUsePoints] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  useEffect(() => {
    if (!user) return;
    window.api.pointsBalance(user.id).then(setPoints);
    window.api.walletGet(user.id).then(setWallet);
  }, [user?.id]);

  if (!items.length) {
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <EmptyState
          illustration="cart"
          title={t('cart.empty.title')}
          body={t('cart.empty.body')}
          cta={<Link to="/store" className="btn btn-primary text-sm">{t('common.go_to_store')}</Link>}
        />
      </div>
    );
  }

  function removeWithToast(id: number, title: string) {
    remove(id);
    toast.success(`${title} quitado del carrito`);
  }

  const ptsDiscount = +(usePoints * points.redeem_value).toFixed(2);
  const subAfterPts = Math.max(0, total - ptsDiscount);
  const walletAvail = wallet?.balance ?? 0;
  const walletApplied = useWallet ? Math.min(walletAvail, subAfterPts) : 0;
  const final = +Math.max(0, subAfterPts - walletApplied).toFixed(2);

  function goToCheckout() {
    sessionStorage.setItem('dreitz.checkout.points', String(usePoints));
    sessionStorage.setItem('dreitz.checkout.useWallet', useWallet ? '1' : '0');
    nav('/checkout');
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">{t('nav.cart')}</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          {items.map((it) => (
            <div key={it.gameId} className="card p-3 flex items-center gap-4">
              <Link to={`/game/${it.gameId}`}>
                <img src={it.capsule_image} alt="" className="w-32 h-16 rounded object-cover" />
              </Link>
              <div className="flex-1">
                <Link to={`/game/${it.gameId}`} className="font-semibold hover:text-accent">{it.title}</Link>
                <div className="text-sm text-fg-muted">Llave digital — Activación inmediata</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{format(it.price)}</div>
              </div>
              <button onClick={() => removeWithToast(it.gameId, it.title)} className="ml-2 w-9 h-9 rounded-md hover:bg-red-500/15 text-fg-muted hover:text-red-400 flex items-center justify-center">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <aside className="card p-5 h-fit">
          <h3 className="font-bold mb-4">{t('cart.summary')}</h3>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-fg-muted">{t('cart.subtotal')}</span>
            <span>{format(total)}</span>
          </div>
          {user?.is_pro && (
            <div className="flex justify-between text-sm mb-2 text-yellow-400">
              <span>Beneficio Pro</span>
              <span>Aplicado</span>
            </div>
          )}

          {points.balance > 0 && (
            <div className="border-t border-border pt-3 mt-3 mb-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Coins size={14} className="text-yellow-400" />
                <span className="text-xs font-semibold">Usar puntos ({points.balance} disponibles)</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.min(points.balance, Math.floor(total / points.redeem_value))}
                step={10}
                value={usePoints}
                onChange={(e) => setUsePoints(parseInt(e.target.value))}
                className="w-full accent-yellow-400"
              />
              <div className="flex justify-between text-[11px] text-fg-muted mt-1">
                <span>{usePoints} pts</span>
                <span className="text-yellow-400 font-semibold">-{format(ptsDiscount)}</span>
              </div>
            </div>
          )}

          {walletAvail > 0 && (
            <label className="flex items-center gap-2 mt-3 mb-2 cursor-pointer">
              <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} className="accent-cyan-400" />
              <WalletIcon size={13} className="text-cyan-400" />
              <span className="text-xs flex-1">Usar billetera ({format(walletAvail)})</span>
              {useWallet && <span className="text-cyan-400 font-semibold text-xs">-{format(walletApplied)}</span>}
            </label>
          )}

          <div className="flex justify-between text-lg font-bold border-t border-border pt-3 mt-3 mb-4">
            <span>{t('cart.total')}</span>
            <span>{format(final)}</span>
          </div>
          <button onClick={goToCheckout} className="btn btn-primary w-full">{t('cart.continue_payment')}</button>
        </aside>
      </div>
    </div>
  );
}
