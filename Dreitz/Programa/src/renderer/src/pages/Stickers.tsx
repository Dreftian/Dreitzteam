import { useEffect, useState } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from '../components/Skeleton';

interface Sticker {
  id: number;
  code: string;
  game_id: number | null;
  title: string;
  description: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked_at: string;
  capsule_image: string | null;
  header_image: string | null;
}

const RARITY_COLOR: Record<string, [string, string]> = {
  common: ['#475569', '#64748b'],
  rare: ['#0284c7', '#22d3ee'],
  epic: ['#7c3aed', '#c084fc'],
  legendary: ['#f59e0b', '#fde047']
};

export default function Stickers() {
  const { user } = useAuth();
  const [data, setData] = useState<{ owned: Sticker[]; pool: any[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    window.api.stickersEvaluate(user.id).then(() => window.api.stickersMine(user.id).then(setData));
  }, [user?.id]);

  if (!data) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-3 w-72 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const ownedCodes = new Set(data.owned.map((s) => s.code));
  const lockedMeta = data.pool.filter((p: any) => !ownedCodes.has(p.code));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Sparkles className="text-pink-400" size={28} />
        <h2 className="text-3xl font-bold">Stickers</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">{data.owned.length} desbloqueados · cada juego comprado te da uno único.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.owned.map((s) => (
          <StickerCard key={s.id} s={s} locked={false} />
        ))}
        {lockedMeta.map((s: any) => (
          <StickerCard
            key={s.code}
            s={{ ...s, id: -1, game_id: null, unlocked_at: '', capsule_image: null, header_image: null }}
            locked
          />
        ))}
      </div>

      {!data.owned.length && (
        <div className="card p-10 text-center text-fg-muted mt-6">
          Cuando compres tu primer juego desbloquearás un sticker.
        </div>
      )}
    </div>
  );
}

function StickerCard({ s, locked }: { s: Sticker; locked: boolean }) {
  const [c1, c2] = RARITY_COLOR[s.rarity] ?? RARITY_COLOR.common;
  return (
    <div
      className={`card p-4 relative overflow-hidden transition-all ${locked ? 'opacity-50 grayscale' : 'hover:scale-[1.02]'}`}
      style={{
        background: `linear-gradient(135deg, ${c1}30 0%, var(--bg-card) 50%, ${c2}25 100%)`,
        borderColor: locked ? 'var(--border)' : `${c2}40`
      }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30" style={{ background: c2 }} />
      <div className="relative">
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-lg ring-1 ring-white/10"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          {s.capsule_image || s.header_image ? (
            <img src={s.capsule_image || s.header_image!} alt="" className="w-full h-full rounded-2xl object-cover" />
          ) : locked ? (
            <Lock size={24} className="text-white/70" />
          ) : (
            <Sparkles size={24} className="text-white/90" />
          )}
        </div>
        <div className="text-center">
          <div className="font-bold text-sm truncate" title={s.title}>{s.title}</div>
          {s.description && <div className="text-[10px] text-fg-muted line-clamp-2 mt-0.5">{s.description}</div>}
          <div className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold" style={{ background: `${c2}20`, color: c2 }}>
            {s.rarity}
          </div>
        </div>
      </div>
    </div>
  );
}
