import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import GameCard from './GameCard';
import { useLazyMount } from '../lib/useLazyMount';
import type { Game } from '../lib/types';

const PER_PAGE = 25;

/**
 * Grid paginado con LAZY-MOUNT por card. Cada GameCard se monta solo cuando
 * entra al viewport (IntersectionObserver con margin de 200px). Esto evita
 * que el primer render tenga que crear 25 cards × N hooks → demora visible
 * en pages largas. Los placeholders mantienen el layout fijo así que el grid
 * no salta cuando los cards montan.
 */
export default function PagedGameGrid({ games, title }: { games: Game[]; title?: string }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(games.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const visible = games.slice(start, start + PER_PAGE);

  const pageNumbers = useMemo(() => {
    const out: (number | '…')[] = [];
    const range = 1;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - range && i <= safePage + range)) {
        out.push(i);
      } else if (out[out.length - 1] !== '…') {
        out.push('…');
      }
    }
    return out;
  }, [totalPages, safePage]);

  if (!games.length) return null;

  return (
    <section className="mb-10">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <div className="text-xs text-fg-subtle">
            Página <span className="text-fg font-semibold">{safePage}</span> de {totalPages} · {games.length} juegos
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {visible.map((g, i) => (
          // Las primeras 10 cards montan inmediato (above the fold). El resto
          // espera al scroll. Combinación: paint instantáneo + smooth scroll.
          <LazyGameCard key={g.id} game={g} eager={i < 10} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-9 h-9 rounded-md bg-bg-card border border-border hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Anterior"
          >
            <ChevronLeft size={15} />
          </button>
          {pageNumbers.map((n, i) =>
            n === '…' ? (
              <span key={`e-${i}`} className="px-2 text-fg-subtle">…</span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n as number)}
                className={`min-w-9 h-9 px-3 rounded-md text-sm font-semibold transition-all ${n === safePage ? 'bg-accent text-white' : 'bg-bg-card border border-border hover:bg-bg-hover'}`}
              >
                {n}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-9 h-9 rounded-md bg-bg-card border border-border hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Siguiente"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Wrapper que mantiene el espacio del card en el grid pero solo monta el
 * componente real cuando entra al viewport. Placeholder es un skeleton.
 */
function LazyGameCard({ game, eager }: { game: Game; eager: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useLazyMount(ref, { rootMargin: '300px', eager });

  return (
    <div ref={ref} className="aspect-[460/300] relative">
      {mounted ? (
        <GameCard game={game} size="page" />
      ) : (
        // Skeleton placeholder con el mismo aspect-ratio para mantener layout.
        <div className="w-full h-full rounded-xl bg-bg-card border border-border overflow-hidden">
          <div className="w-full aspect-[460/215] shimmer-bg" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-3/4 rounded shimmer-bg" />
            <div className="h-2 w-1/2 rounded shimmer-bg" />
          </div>
        </div>
      )}
    </div>
  );
}
