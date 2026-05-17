interface PricePoint {
  price: number;
  recorded_at: string;
  discount_percent?: number;
}

export default function Sparkline({ points, height = 60 }: { points: PricePoint[]; height?: number }) {
  if (!points || points.length < 2) return null;

  const w = 280;
  const h = height;
  const padX = 4;
  const padY = 6;

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(0.0001, max - min);

  const stepX = (w - padX * 2) / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = padX + i * stepX;
      const y = padY + (1 - (p.price - min) / range) * (h - padY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const fillPath = `${path} L ${padX + (points.length - 1) * stepX} ${h - padY} L ${padX} ${h - padY} Z`;

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const lastX = padX + (points.length - 1) * stepX;
  const lastY = padY + (1 - (lastPoint.price - min) / range) * (h - padY * 2);

  const trend = lastPoint.price - firstPoint.price;
  const trendPct = firstPoint.price ? ((trend / firstPoint.price) * 100).toFixed(1) : '0';
  const isUp = trend > 0;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#spark-fill)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r={3.5} fill="var(--accent)" />
        <circle cx={lastX} cy={lastY} r={6} fill="var(--accent)" fillOpacity="0.25" />
      </svg>
      <div className="flex items-center justify-between text-[11px] text-fg-subtle">
        <span>Min: <span className="text-fg-muted">S/. {min.toFixed(2)}</span></span>
        <span>Max: <span className="text-fg-muted">S/. {max.toFixed(2)}</span></span>
        <span className={isUp ? 'text-orange-300' : 'text-green-400'}>
          {isUp ? '↑' : '↓'} {trendPct}% en {points.length} sem.
        </span>
      </div>
    </div>
  );
}
