import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Promotion } from '../lib/types';
import CountdownBanner from './CountdownBanner';
import { useSettings } from '../contexts/SettingsContext';

export default function PromoCarousel({ promos }: { promos: Promotion[] }) {
  const [idx, setIdx] = useState(0);
  const { reduce_motion } = useSettings();

  useEffect(() => {
    if (promos.length < 2 || reduce_motion) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % promos.length), 7000);
    return () => clearInterval(t);
  }, [promos.length, reduce_motion]);

  if (!promos.length) return null;
  const p = promos[idx % promos.length];
  const accent = p.accent_color || '#00d4ff';

  return (
    <div
      className="relative rounded-2xl overflow-hidden h-[440px] mb-10"
      style={{ background: `linear-gradient(135deg, ${accent}25 0%, #0a0e1a 50%, ${accent}15 100%)` }}
    >
      {p.hero_image && (
        <AnimatePresence mode="wait">
          <motion.div
            key={p.id}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${p.hero_image})` }}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.55, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          />
        </AnimatePresence>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
      <div
        className="absolute inset-x-0 top-0 h-2"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />

      <div className="relative h-full p-10 flex flex-col justify-end gap-3">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.25em] font-bold w-fit"
          style={{ background: `${accent}20`, color: accent }}
        >
          <Sparkles size={11} /> Promoción Dreitz
        </div>
        <motion.h2
          key={p.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-extrabold leading-tight text-white max-w-3xl"
        >
          {p.title}
        </motion.h2>
        {p.subtitle && (
          <p className="text-white/85 text-lg max-w-2xl">{p.subtitle}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-2">
          {p.cta_target && (
            <Link
              to={p.cta_target}
              className="btn px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
            >
              {p.cta_text || 'Ver ofertas'} <ArrowRight size={15} />
            </Link>
          )}
          {p.ends_at && <CountdownBanner endsAt={p.ends_at} label="Termina en" />}
        </div>

        {p.games?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {p.games.slice(0, 5).map((g) => (
              <Link
                key={g.id}
                to={`/game/${g.id}`}
                className="block w-32 h-16 rounded-md overflow-hidden ring-1 ring-white/10 hover:ring-2 transition-all"
                style={{ '--tw-ring-color': accent } as any}
              >
                <img src={g.capsule_image || g.header_image} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {promos.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + promos.length) % promos.length)}
            className="absolute top-1/2 left-3 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % promos.length)}
            className="absolute top-1/2 right-3 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            {promos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8' : 'w-3 bg-white/30'}`}
                style={i === idx ? { background: accent } : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
