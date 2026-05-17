import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';
import type { Game } from '../lib/types';
import { useCachedImage } from '../lib/useCachedImage';
import { useCurrency } from '../contexts/CurrencyContext';

/**
 * Hero cinematográfico estilo Steam — usa `header_image` 920×430 a tamaño
 * grande con parallax al scroll. Carrusel automático cada 8s; pausa al
 * hover. Cuando el juego tiene `trailer_url`, se reproduce muteado en background.
 */
export default function CinematicHero({ games }: { games: Game[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { format } = useCurrency();
  const { scrollY } = useScroll();
  // Parallax: el fondo se desplaza más lento que el contenido al scroll
  const bgY = useTransform(scrollY, [0, 400], [0, 60]);
  const opacity = useTransform(scrollY, [0, 380], [1, 0.4]);

  const featured = games.filter((g) => g.is_featured && !g.is_dlc).slice(0, 5);
  const game = featured[idx];

  useEffect(() => {
    if (paused || featured.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), 8000);
    return () => clearInterval(t);
  }, [paused, featured.length]);

  const headerCached = useCachedImage(game?.background_image || game?.header_image);

  if (!game) return null;
  const isOnSale = game.discount_percent > 0;

  return (
    <motion.div
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ opacity }}
      className="relative h-[480px] rounded-2xl overflow-hidden mb-8 select-none"
    >
      {/* Background con parallax */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 -top-[60px] -bottom-[60px]"
      >
        {headerCached && (
          <motion.img
            key={game.id + '-bg'}
            src={headerCached}
            alt=""
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Si hay trailer, lo ponemos encima muted/looped — gives it cinematic feel */}
        {game.trailer_url && (
          <motion.video
            key={game.id + '-trailer'}
            src={game.trailer_url}
            poster={headerCached}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            transition={{ delay: 1.5, duration: 1.2 }}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        {/* gradientes para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-base/95 via-bg-base/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent" />
      </motion.div>

      {/* Contenido */}
      <div className="relative h-full flex items-end p-10 max-w-3xl">
        <motion.div
          key={game.id + '-content'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {isOnSale && (
            <span className="inline-block px-3 py-1 rounded-full bg-green-500/90 text-white text-xs font-bold mb-3 shadow-lg">
              -{game.discount_percent}% OFF
            </span>
          )}
          <h1 className="text-5xl font-extrabold mb-3 leading-tight drop-shadow-2xl">
            {game.title}
          </h1>
          <p className="text-fg-muted text-sm mb-5 max-w-2xl line-clamp-3 drop-shadow">
            {game.short_description}
          </p>
          <div className="flex items-center gap-4">
            <Link
              to={`/game/${game.id}`}
              className="px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-white font-bold flex items-center gap-2 shadow-xl transition-all hover:scale-105"
              style={{ boxShadow: '0 8px 32px color-mix(in srgb, var(--accent) 50%, transparent)' }}
            >
              <Play size={18} fill="currentColor" /> Ver detalle <ArrowRight size={16} />
            </Link>
            <div className="text-fg">
              {isOnSale && (
                <span className="text-fg-subtle line-through text-sm mr-2">{format(game.price_initial)}</span>
              )}
              <span className="text-2xl font-bold">{format(game.price_final)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Indicadores */}
      {featured.length > 1 && (
        <div className="absolute bottom-4 right-6 flex gap-1.5">
          {featured.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-accent' : 'w-4 bg-white/30 hover:bg-white/50'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
