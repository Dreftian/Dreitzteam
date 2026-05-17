import { useEffect, useState } from 'react';
import { ShoppingBag, Heart, Crown, Flame } from 'lucide-react';

interface FeedItem {
  id: number;
  username: string;
  kind: string;
  target_label: string | null;
  created_at: string;
}

const ICON: Record<string, any> = {
  purchase: ShoppingBag,
  wishlist_add: Heart,
  pro_subscribe: Crown,
  gift_card_purchase: Flame
};

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'ahora';
  const m = Math.floor(sec / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const day = Math.floor(h / 24);
  return `hace ${day} d`;
}

function actionFor(kind: string): string {
  switch (kind) {
    case 'purchase': return 'compró';
    case 'wishlist_add': return 'agregó a deseados';
    case 'pro_subscribe': return 'activó';
    case 'gift_card_purchase': return 'compró';
    default: return 'hizo';
  }
}

export default function ActivityTicker() {
  const [items, setItems] = useState<FeedItem[]>([]);

  async function load() {
    const list = await window.api.activityList({ limit: 12, global: true });
    setItems(list);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 12_000);
    return () => clearInterval(id);
  }, []);

  if (!items.length) return null;

  return (
    <div className="card p-3 mb-6 overflow-hidden">
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-bold text-fg-subtle mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Actividad en vivo
      </div>
      <div className="overflow-hidden relative h-7">
        <div className="flex gap-8 animate-[ticker_60s_linear_infinite] whitespace-nowrap">
          {[...items, ...items].map((it, i) => {
            const Icon = ICON[it.kind] ?? ShoppingBag;
            return (
              <div key={`${it.id}-${i}`} className="flex items-center gap-2 text-xs text-fg-muted shrink-0">
                <Icon size={12} className="text-accent" />
                <span className="font-semibold text-fg">{it.username}</span>
                <span>{actionFor(it.kind)}</span>
                <span className="text-fg">{it.target_label ?? '—'}</span>
                <span className="text-fg-subtle">· {relTime(it.created_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
