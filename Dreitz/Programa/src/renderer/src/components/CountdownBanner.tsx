import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function CountdownBanner({ endsAt, label }: { endsAt: string; label?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(endsAt).getTime() - now;
  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/15 text-orange-300 text-xs font-medium">
      <Clock size={13} />
      <span>{label ?? 'Termina en'}</span>
      <span className="font-mono font-bold">
        {days > 0 ? `${days}d ` : ''}
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
