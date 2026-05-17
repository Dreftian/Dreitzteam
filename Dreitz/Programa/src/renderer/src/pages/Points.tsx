import { useEffect, useState } from 'react';
import { Coins, Crown, Wallet as WalletIcon, Share2, Copy, Check, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatPrice, formatDate } from '../lib/format';
import type { PointsLedgerEntry, ProfileStats, ReferralSummary, Wallet } from '../lib/types';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';

const LEVELS = [
  { name: 'Bronze', threshold: 0, cashback: 1, color: '#cd7f32' },
  { name: 'Silver', threshold: 200, cashback: 3, color: '#bfc7d5' },
  { name: 'Gold', threshold: 500, cashback: 5, color: '#ffd95a' },
  { name: 'Platinum', threshold: 1000, cashback: 8, color: '#a5f3fc' }
];

export default function Points() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [balance, setBalance] = useState({ balance: 0, redeem_value: 0.05 });
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ref, setRef] = useState<ReferralSummary | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    if (!user) return;
    const [s, l, b, w, r] = await Promise.all([
      window.api.achievementsProfileStats(user.id),
      window.api.pointsLedger({ userId: user.id, limit: 30 }),
      window.api.pointsBalance(user.id),
      window.api.walletGet(user.id),
      window.api.referralsSummary(user.id)
    ]);
    setStats(s); setLedger(l); setBalance(b); setWallet(w); setRef(r);
  }
  useEffect(() => { load(); }, [user?.id]);

  if (!stats || !user) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Skeleton className="h-9 w-80 mb-2" />
        <Skeleton className="h-3 w-96 mb-8" />
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="card p-6 mb-8 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const lvl = stats.level;
  const lvlIdx = LEVELS.findIndex((l) => l.name === lvl.level);
  const next = LEVELS[lvlIdx + 1];
  const progress = next ? Math.min(100, ((stats.total_spent - LEVELS[lvlIdx].threshold) / (next.threshold - LEVELS[lvlIdx].threshold)) * 100) : 100;

  const redeemableValue = balance.balance * balance.redeem_value;

  function copyRef() {
    if (!ref?.code) return;
    navigator.clipboard.writeText(ref.code);
    setCopied(true);
    toast.success('Código copiado');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Coins className="text-yellow-400" size={28} />
        <h2 className="text-3xl font-bold">Tus puntos y nivel</h2>
      </div>
      <p className="text-fg-muted text-sm mb-8">Gana puntos en cada compra · canjea por descuento · sube de nivel para mejor cashback.</p>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-30" style={{ background: LEVELS[lvlIdx].color }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-xl"
                style={{ background: `${LEVELS[lvlIdx].color}30`, color: LEVELS[lvlIdx].color }}>
                <Crown />
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Nivel actual</div>
                <div className="text-2xl font-extrabold">{lvl.level}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Cashback</div>
                <div className="text-xl font-extrabold text-yellow-400">+{lvl.cashback}%</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-bg-hover overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${LEVELS[lvlIdx].color}, ${next ? next.color : LEVELS[lvlIdx].color})` }} />
            </div>
            <div className="flex justify-between text-[11px] text-fg-muted">
              <span>{formatPrice(stats.total_spent)} gastado</span>
              {next && <span>Falta {formatPrice(next.threshold - stats.total_spent)} para {next.name}</span>}
              {!next && <span>Has alcanzado el nivel máximo 🏆</span>}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <Coins className="text-yellow-400 mb-2" />
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Saldo de puntos</div>
          <div className="text-3xl font-extrabold">{balance.balance}</div>
          <div className="text-xs text-fg-muted mt-1">≈ {formatPrice(redeemableValue)} en descuentos</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-cyan-500/20 blur-3xl" />
          <WalletIcon className="text-cyan-400 mb-2" />
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Saldo en billetera</div>
          <div className="text-3xl font-extrabold">{formatPrice(wallet?.balance ?? 0)}</div>
          <div className="text-xs text-fg-muted mt-1">Se aplica automáticamente en checkout</div>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <Share2 className="text-pink-400 mb-2" />
          <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold">Tu código de referido</div>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <code className="font-mono text-lg font-bold bg-bg-hover px-3 py-1.5 rounded select-text">{ref?.code ?? '—'}</code>
            <button onClick={copyRef} className="btn btn-secondary text-xs">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <div className="text-xs text-fg-muted">{ref?.referred ?? 0} amigos referidos · +{ref?.points_earned ?? 0}pts ganados</div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-bold mb-3 flex items-center gap-2"><ShoppingBag size={17} /> Movimientos de puntos</h3>
        {ledger.length === 0 ? (
          <div className="text-sm text-fg-muted py-6 text-center">Aún no tienes movimientos. Compra algo para ganar tus primeros puntos.</div>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((e) => (
              <div key={e.id} className="py-2 flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full ${e.delta > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="flex-1 capitalize">{e.reason.replace('_', ' ')}</span>
                <span className="text-[11px] text-fg-subtle">{formatDate(e.created_at)}</span>
                <span className={`font-bold ${e.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {e.delta > 0 ? '+' : ''}{e.delta} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3">Cómo funcionan los puntos</h3>
        <ul className="text-sm text-fg-muted space-y-1.5">
          <li>· Ganas <span className="text-fg font-semibold">1 punto</span> por cada <span className="text-fg font-semibold">S/. 10</span> gastados</li>
          <li>· Tu nivel suma cashback adicional sobre el base</li>
          <li>· <span className="text-fg font-semibold">100 puntos</span> = <span className="text-fg font-semibold">S/. 5</span> de descuento aplicable en checkout</li>
          <li>· Refiere a un amigo: cuando se registre con tu código ganas <span className="text-fg font-semibold">+50 puntos</span></li>
          <li>· Saldo de billetera (gift cards y reembolsos) se descuenta automáticamente</li>
        </ul>
      </div>
    </div>
  );
}
