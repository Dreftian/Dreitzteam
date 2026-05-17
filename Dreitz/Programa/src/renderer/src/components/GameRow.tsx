import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Game } from '../lib/types';
import GameCard from './GameCard';

export default function GameRow({ title, games, size }: { title: string; games: Game[]; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  function update() {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [games.length]);

  function scroll(dir: 1 | -1) {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 700, behavior: 'smooth' });
  }

  if (!games.length) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title text-xl">{title}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => scroll(-1)}
            disabled={!canLeft}
            className="w-9 h-9 rounded-full bg-bg-card border border-border hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            aria-label="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll(1)}
            disabled={!canRight}
            className="w-9 h-9 rounded-full bg-bg-card border border-border hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            aria-label="Siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="relative">
        <div
          ref={ref}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar snap-x-carousel"
        >
          {games.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.035, 0.5), type: 'spring', stiffness: 240, damping: 22 }}
            >
              <GameCard game={g} size={size} />
            </motion.div>
          ))}
        </div>
        {canLeft && (
          <div className="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-bg-base to-transparent pointer-events-none" />
        )}
        {canRight && (
          <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-bg-base to-transparent pointer-events-none" />
        )}
      </div>
    </section>
  );
}
