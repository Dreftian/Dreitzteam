import { useEffect, useState } from 'react';
import { ShoppingBag, Heart, Crown, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface FeedItem {
  id: number;
  user_id: number;
  username: string;
  kind: string;
  target_id: number | null;
  target_label: string | null;
  meta: string | null;
  created_at: string;
}

const ICON: Record<string, any> = {
  purchase: ShoppingBag,
  wishlist_add: Heart,
  pro_subscribe: Crown
};

const COLOR: Record<string, string> = {
  purchase: 'text-cyan-400',
  wishlist_add: 'text-pink-400',
  pro_subscribe: 'text-yellow-400'
};

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `hace ${day} d`;
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export default function ActivityFeed({ global = false, limit = 12 }: { global?: boolean; limit?: number }) {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    window.api.activityList({ userId: user?.id, limit, global }).then(setItems);
  }, [user?.id, global, limit]);

  if (!items.length) {
    return (
      <div className="card p-6 text-center text-sm text-fg-muted">
        <Activity size={20} className="mx-auto mb-2 opacity-60" />
        Aún no hay actividad. Tus compras y juegos guardados aparecerán aquí.
      </div>
    );
  }

  return (
    <ul className="card divide-y divide-border">
      {items.map((it) => {
        const Icon = ICON[it.kind] ?? Activity;
        const color = COLOR[it.kind] ?? 'text-fg-muted';
        let action = '';
        switch (it.kind) {
          case 'purchase': action = global ? `${it.username} compró` : 'Compraste'; break;
          case 'wishlist_add': action = global ? `${it.username} agregó a deseados` : 'Agregaste a deseados'; break;
          case 'pro_subscribe': action = global ? `${it.username} se suscribió a` : 'Activaste'; break;
          default: action = it.kind;
        }
        return (
          <li key={it.id} className="px-4 py-3 flex items-center gap-3 text-sm">
            <div className={`w-8 h-8 rounded-md bg-bg-hover flex items-center justify-center ${color}`}>
              <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-fg-muted">{action} </span>
              <span className="font-semibold">{it.target_label ?? '—'}</span>
            </div>
            <span className="text-[11px] text-fg-subtle whitespace-nowrap">{relTime(it.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
