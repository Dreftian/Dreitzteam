import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, ArrowRight, Clock } from 'lucide-react';
import type { DailyDeal } from '../lib/types';
import { useCurrency } from '../contexts/CurrencyContext';

export default function DailyDealStrip() {
  const [deal, setDeal] = useState<DailyDeal | null>(null);
  const [now, setNow] = useState(Date.now());
  const { format } = useCurrency();

  useEffect(() => {
    let alive = true;
    window.api.flashSalesDailyDeal().then((d: DailyDeal | null) => alive && setDeal(d));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!deal) return null;
  const remaining = new Date(deal.ends_at).getTime() - now;
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const game = deal.game;
  const left = deal.units_left ?? null;

  return (
    <Link
      to={`/game/${game.id}`}
      className="block relative rounded-2xl overflow-hidden mb-6 group"
      style={{ background: `linear-gradient(135deg, #ff3aa6 0%, #ff8a33 50%, #ffd500 100%)` }}
    >
      <div className="absolute inset-0 bg-black/30" />
      {game.background_image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity"
          style={{ backgroundImage: `url(${game.background_image})` }}
        />
      )}

      <div className="relative flex items-center gap-6 p-6">
        <div className="w-44 h-24 rounded-lg overflow-hidden shadow-xl shrink-0 ring-2 ring-white/30">
          <img src={game.capsule_image || game.header_image} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur text-yellow-300 text-[10px] font-bold tracking-[0.25em] uppercase flex items-center gap-1.5">
              <Flame size={11} /> Daily Deal
            </span>
            <span className="px-2 py-0.5 rounded bg-yellow-400 text-black text-xs font-extrabold">
              -{deal.discount_percent}%
            </span>
            {left !== null && left <= 5 && (
              <span className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {left} {left === 1 ? 'COPIA' : 'COPIAS'}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-extrabold text-white truncate drop-shadow-lg">{game.title}</h3>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-white/70 line-through text-sm">{format(game.price_initial)}</span>
            <span className="text-3xl font-extrabold text-white drop-shadow-lg">{format(deal.effective_price)}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 px-5 border-l border-white/30 shrink-0">
          <div className="flex items-center gap-1 text-white/90 text-xs uppercase tracking-wider">
            <Clock size={12} /> Termina en
          </div>
          <div className="font-mono text-2xl font-extrabold text-white drop-shadow-lg tabular-nums">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>

        <div className="bg-white/15 backdrop-blur-md hover:bg-white/25 rounded-full w-12 h-12 flex items-center justify-center shrink-0 transition-colors">
          <ArrowRight size={22} className="text-white" />
        </div>
      </div>
    </Link>
  );
}
