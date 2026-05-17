import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface CheckResult {
  min_ram_gb: number;
  your_ram_gb: number;
  ram_ok: boolean;
  cpu_speed_ghz: number;
  cpu_ok: boolean;
  cores: number;
  cpu_name: string;
  verdict: 'ok' | 'partial' | 'low';
}

export default function PCCheckCard({ gameId }: { gameId: number }) {
  const [r, setR] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    window.api.pcCheckGame(gameId).then((d) => { if (alive) { setR(d); setLoading(false); } });
    return () => { alive = false; };
  }, [gameId]);

  if (loading) return null;
  if (!r) return null;

  const tone = r.verdict === 'ok'
    ? { color: 'text-green-300', bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle, label: 'Tu PC supera los requisitos' }
    : r.verdict === 'partial'
      ? { color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertTriangle, label: 'Tu PC pasa con lo justo' }
      : { color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/30', icon: XCircle, label: 'Tu PC podría no correrlo bien' };

  const Icon = tone.icon;

  return (
    <div className={`card p-4 border ${tone.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={tone.color} />
        <span className={`text-xs font-bold uppercase tracking-wider ${tone.color}`}>{tone.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="flex items-center gap-1.5 text-fg-subtle mb-1">
            <MemoryStick size={12} /> RAM
          </div>
          <div className={r.ram_ok ? 'text-fg' : 'text-red-300'}>
            <span className="font-bold">{r.your_ram_gb} GB</span>
            {r.min_ram_gb > 0 && <span className="text-fg-subtle"> / mín. {r.min_ram_gb} GB</span>}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-fg-subtle mb-1">
            <Cpu size={12} /> CPU
          </div>
          <div className={r.cpu_ok ? 'text-fg' : 'text-red-300'}>
            <span className="font-bold">{r.cpu_speed_ghz.toFixed(1)} GHz</span>
            <span className="text-fg-subtle"> · {r.cores} núcleos</span>
          </div>
          <div className="text-[10px] text-fg-subtle truncate" title={r.cpu_name}>{r.cpu_name}</div>
        </div>
      </div>
    </div>
  );
}
