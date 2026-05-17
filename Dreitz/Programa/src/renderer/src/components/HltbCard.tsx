import { useEffect, useState } from 'react';
import { Clock, Info } from 'lucide-react';

interface HltbData {
  mainStory: number;
  mainPlusSides: number;
  completionist: number;
  source: 'hltb' | 'estimate';
}

/**
 * Muestra la estimación de horas de juego (Historia / Historia + secundarias / 100%).
 * Datos vienen de cache estática en main (hltb.ts) — sin scraping, offline-capable.
 *
 * Si la `source` es 'estimate' (fallback por género), añade un disclaimer sutil.
 * Si no hay data disponible, no renderea nada (componente silencioso).
 */
export default function HltbCard({ gameId }: { gameId: number }) {
  const [data, setData] = useState<HltbData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    window.api.hltbGet({ gameId })
      .then((d: HltbData | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading || !data) return null;

  const items = [
    { label: 'Historia', hours: data.mainStory, tone: 'cyan' },
    { label: 'Historia + Sides', hours: data.mainPlusSides, tone: 'purple' },
    { label: 'Completar 100%', hours: data.completionist, tone: 'pink' }
  ];

  const TONE_CLS: Record<string, string> = {
    cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
    purple: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
    pink: 'text-pink-300 bg-pink-500/10 border-pink-500/30'
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-fg-muted" />
        <span className="text-xs font-bold tracking-widest text-fg-muted">¿CUÁNTO TARDA?</span>
        {data.source === 'estimate' && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[10px] text-fg-subtle"
            title="Estimación basada en el género — no hay datos específicos para este juego"
          >
            <Info size={10} /> estimado
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={`rounded-md border p-2.5 text-center ${TONE_CLS[it.tone]}`}
          >
            <div className="text-2xl font-extrabold leading-none">{it.hours}h</div>
            <div className="text-[10px] mt-1 opacity-80 leading-tight">{it.label}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-fg-subtle mt-2.5">
        {data.source === 'hltb'
          ? 'Tiempos promedio de la comunidad HowLongToBeat.'
          : 'Tiempos aproximados según el género — puede variar bastante.'}
      </p>
    </div>
  );
}
