import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Game } from '../lib/types';
import { formatPrice } from '../lib/format';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HeroCarousel({ games }: { games: Game[] }) {
  const [idx, setIdx] = useState(0);
  const list = games.slice(0, 5);

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [list.length]);

  if (!list.length) return null;
  const g = list[idx];

  return (
    <div className="relative rounded-2xl overflow-hidden h-[420px] mb-8 hero-gradient">
      {g.background_image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${g.background_image})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
      <div className="relative h-full flex items-end p-10 gap-8">
        <div className="flex-1 max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.25em] text-cyan-300 mb-3 font-semibold">Destacado</div>
          <h2 className="text-5xl font-extrabold mb-4 leading-tight text-white">{g.title}</h2>
          <p className="text-white/80 mb-6 line-clamp-3">{g.short_description}</p>
          <div className="flex items-center gap-4 mb-6">
            {g.discount_percent > 0 && (
              <div className="px-3 py-2 rounded bg-green-500/30 text-green-300 font-bold">-{g.discount_percent}%</div>
            )}
            <div>
              {g.discount_percent > 0 && <div className="text-sm text-white/60 line-through">{formatPrice(g.price_initial, g.currency)}</div>}
              <div className="text-2xl font-bold text-white">{formatPrice(g.price_final, g.currency)}</div>
            </div>
            <Link to={`/game/${g.id}`} className="btn btn-primary">Ver detalle</Link>
          </div>
        </div>
        {g.header_image && (
          <img src={g.header_image} alt="" className="hidden lg:block w-96 rounded-xl shadow-2xl" />
        )}
      </div>
      {list.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)}
            className="absolute top-1/2 left-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % list.length)}
            className="absolute top-1/2 right-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-white' : 'w-3 bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
