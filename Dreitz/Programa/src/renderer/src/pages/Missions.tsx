import { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';

interface Mission {
  id: number;
  code: string;
  title: string;
  target: number;
  progress: number;
  reward_points: number;
  completed: number;
  claimed: number;
  assigned_date: string;
}

export default function Missions() {
  const { user } = useAuth();
  const [list, setList] = useState<Mission[]>([]);

  async function load() {
    if (!user) return;
    setList(await window.api.missionsToday(user.id));
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [user?.id]);

  async function claim(m: Mission) {
    if (!user) return;
    try {
      const r = await window.api.missionsClaim({ userId: user.id, missionId: m.id });
      toast.success(`+${r.reward}pts reclamados`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const completed = list.filter((m) => m.completed).length;
  const total = list.length;
  const totalReward = list.reduce((s, m) => s + m.reward_points, 0);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Trophy className="text-yellow-400" size={28} />
        <h2 className="text-3xl font-bold">Misiones diarias</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">Completa para ganar puntos. Se renuevan cada 24h a la medianoche UTC.</p>

      <div className="card p-5 mb-6 flex items-center gap-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/5">
        <div className="text-4xl">🎯</div>
        <div className="flex-1">
          <div className="font-bold mb-1">Hoy: {completed} / {total} completadas</div>
          <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-bold">Total reward</div>
          <div className="text-2xl font-extrabold text-yellow-400">+{totalReward}pts</div>
        </div>
      </div>

      <div className="space-y-3">
        {list.map((m) => {
          const pct = Math.min(100, (m.progress / m.target) * 100);
          return (
            <div key={m.id} className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${m.completed ? 'bg-green-500/15 text-green-400' : 'bg-bg-hover text-fg-subtle'}`}>
                  {m.completed ? <CheckCircle2 size={18} /> : <Trophy size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{m.title}</div>
                  <div className="text-xs text-fg-muted">{m.progress} / {m.target}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-yellow-400 flex items-center gap-1"><Coins size={13} /> +{m.reward_points}</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden mb-2">
                <div className={`h-full transition-all ${m.completed ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
              </div>
              {m.completed && !m.claimed && (
                <button onClick={() => claim(m)} className="btn btn-primary text-xs w-full">
                  Reclamar +{m.reward_points} puntos
                </button>
              )}
              {m.claimed ? <div className="text-[11px] text-green-400 font-semibold">✓ Recompensa cobrada</div> : null}
            </div>
          );
        })}
      </div>

      {!list.length && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full" />
              </div>
              <Skeleton className="h-10 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
