import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Loader2 } from 'lucide-react';
import type { ComparePriceResult } from '../lib/types';
import { useCurrency } from '../contexts/CurrencyContext';

export default function CompareSteamPrice({ gameId }: { gameId: number }) {
  const [data, setData] = useState<ComparePriceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { format } = useCurrency();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    window.api.gamesComparePrice({ gameId })
      .then((r) => { if (alive) setData(r); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [gameId]);

  if (loading) {
    return (
      <div className="card p-3 flex items-center gap-2 text-xs text-fg-subtle">
        <Loader2 size={13} className="animate-spin" /> Comparando precios...
      </div>
    );
  }

  if (!data) return null;

  const cheaper = data.savings_pct > 0;
  const Icon = cheaper ? TrendingDown : TrendingUp;
  const color = cheaper ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-orange-400 border-orange-500/30 bg-orange-500/10';

  return (
    <div className={`card p-3 border ${color}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} />
        <span className="text-xs font-bold uppercase tracking-wider">
          {cheaper ? `Ahorras ${data.savings_pct}%` : 'Más caro que Steam'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-fg-subtle">Dreitz</div>
          <div className="font-extrabold text-sm">{format(data.dreitz_pen)}</div>
        </div>
        <div>
          <div className="text-fg-subtle">Steam</div>
          <div className={`font-bold text-sm ${cheaper ? 'line-through opacity-70' : ''}`}>{format(data.steam_pen)}</div>
        </div>
      </div>
    </div>
  );
}
