import { Link } from 'react-router-dom';
import type { Game } from '../lib/types';
import { useCurrency } from '../contexts/CurrencyContext';
import { useCachedImage, prefetchImage } from '../lib/useCachedImage';
import { useTilt } from '../lib/useTilt';
import DrmBadge from './DrmBadge';
import { ContextMenuTarget } from './GameContextMenu';
import { Calendar } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg' | 'page';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'w-72',
  md: 'w-80',
  lg: 'w-96',
  page: 'w-full'
};

export default function GameCard({ game, size = 'md' }: { game: Game; size?: Size }) {
  const { format } = useCurrency();
  const widthClass = SIZE_CLASS[size];
  const tiltRef = useTilt({ maxDeg: 5, scale: 1.025 });
  const cachedCapsule = useCachedImage(game.capsule_image || game.header_image);

  return (
    <ContextMenuTarget game={game}>
    <div
      ref={tiltRef}
      onPointerEnter={() => {
        // Pre-fetch hero image + screenshots primer para que GameDetail abra instantáneo.
        prefetchImage(game.header_image);
        prefetchImage(game.background_image);
      }}
      className={`tilt-3d rainbow-border ${widthClass} ${size === 'page' ? '' : 'shrink-0'} relative ${game.is_featured ? 'glow-ambient' : ''}`}
      style={{ ['--tilt-x' as any]: '0deg', ['--tilt-y' as any]: '0deg', ['--tilt-scale' as any]: '1' }}
    >
      <Link
        to={`/game/${game.id}`}
        className="group block rounded-xl overflow-hidden card lift relative h-full flex flex-col"
      >
        {/* Glow layer that follows mouse — sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'radial-gradient(circle 200px at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)',
            zIndex: 1
          }}
        />

        {game.is_preorder && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-cyan-500 text-white text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1">
            <Calendar size={10} /> Pre-orden
          </div>
        )}
        {game.is_demo && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-purple-500 text-white text-[9px] font-extrabold uppercase tracking-widest">
            Demo
          </div>
        )}
        {game.price_final === 0 && !game.is_preorder && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-green-500 text-white text-[9px] font-extrabold uppercase tracking-widest">
            Gratis
          </div>
        )}
        {game.discount_percent > 0 && !game.is_preorder && (
          <div className="absolute top-2 right-2 z-10 discount-chip px-2 py-0.5 rounded text-[10px]">
            -{game.discount_percent}%
          </div>
        )}

        <div className="aspect-[460/215] overflow-hidden bg-bg-base tilt-3d-elevated relative z-[2]">
          {cachedCapsule ? (
            <img
              src={cachedCapsule}
              alt={game.title}
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
              loading="lazy"
              // Si la URL cacheada falla, intentamos la URL remota original.
              // En último caso, ocultamos el <img> y dejamos el gradient fallback.
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                const remote = game.capsule_image || game.header_image || '';
                if (remote && img.src !== remote) {
                  img.src = remote;
                } else {
                  img.style.display = 'none';
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-bg-hover to-bg-card" />
          )}
        </div>
        <div className="p-3.5 flex-1 flex flex-col tilt-3d-elevated relative z-[2]">
          <div className="text-[15px] font-bold leading-tight text-fg group-hover:text-accent transition-colors line-clamp-2 mb-1.5 min-h-[2.5em]">
            {game.title}
          </div>
          <div className="text-[11px] text-fg-subtle truncate mb-3">
            {game.genres?.slice(0, 2).join(' · ') || 'Sin categoría'}
          </div>
          <div className="flex items-center justify-between gap-2 mt-auto">
            {game.is_preorder ? (
              <div className="text-xs text-cyan-300 font-semibold">Próximamente</div>
            ) : game.discount_percent > 0 ? (
              <div className="flex items-center gap-2">
                <div className="text-right leading-none">
                  <div className="price-strike text-[10px] text-fg-subtle">{format(game.price_initial)}</div>
                  <div className="price-final text-base text-green-400">{format(game.price_final)}</div>
                </div>
              </div>
            ) : (
              <div className="price-final text-base text-fg">{format(game.price_final)}</div>
            )}
            <DrmBadge drm={game.drm_platform} size="sm" />
          </div>
          {game.stock <= 3 && game.stock > 0 && !game.is_preorder && (
            <span className="text-[10px] text-orange-400 font-semibold mt-1 block">Pocas copias</span>
          )}
          {game.stock === 0 && !game.is_preorder && (
            <span className="text-[10px] text-red-400 font-semibold mt-1 block">Sin stock</span>
          )}
        </div>
      </Link>
    </div>
    </ContextMenuTarget>
  );
}
