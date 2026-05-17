import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import Avatar from './Avatar';

interface Friend {
  id: number;
  username: string;
  ref_code: string;
  avatar: string | null;
  is_pro: boolean;
}

interface ActivityRow {
  user_id: number;
  username: string;
  kind: string;
  target_label: string | null;
  created_at: string;
}

const ONLINE_WINDOW_MS = 15 * 60 * 1000; // 15 min

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export default function FriendsRail() {
  const { user } = useAuth();
  const { friendsRailOpen, toggleFriendsRail } = useUi();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  async function load() {
    if (!user) return;
    const [f, a] = await Promise.all([
      window.api.friendsList(user.id),
      window.api.activityList({ limit: 50, global: true })
    ]);
    setFriends(f as any); setActivity(a as any);
  }

  useEffect(() => {
    if (!friendsRailOpen) return;
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [user?.id, friendsRailOpen]);

  if (!friendsRailOpen || !user) return null;

  // Determine "online" by last activity entry within 15min
  const lastActivity = new Map<number, ActivityRow>();
  for (const a of activity) {
    if (!lastActivity.has(a.user_id) || new Date(a.created_at) > new Date(lastActivity.get(a.user_id)!.created_at)) {
      lastActivity.set(a.user_id, a);
    }
  }
  const online = friends.filter((f) => {
    const last = lastActivity.get(f.id);
    return last && Date.now() - new Date(last.created_at).getTime() < ONLINE_WINDOW_MS;
  });
  const offline = friends.filter((f) => !online.includes(f));

  return (
    <aside className="w-60 shrink-0 bg-bg-elev border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-cyan-400" />
          <span className="text-sm font-bold">Amigos</span>
          <span className="text-[10px] text-fg-subtle">{friends.length}</span>
        </div>
        <div className="flex gap-1">
          <Link to="/friends" title="Gestionar amigos" className="w-7 h-7 rounded hover:bg-bg-hover flex items-center justify-center text-fg-muted hover:text-fg">
            <Plus size={13} />
          </Link>
          <button onClick={toggleFriendsRail} title="Cerrar" className="w-7 h-7 rounded hover:bg-bg-hover flex items-center justify-center text-fg-muted hover:text-fg">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar p-2">
        {!friends.length ? (
          <div className="text-center text-xs text-fg-muted p-6">
            No tienes amigos aún.
            <Link to="/friends" className="block mt-2 text-accent hover:underline font-semibold">Agregar amigos →</Link>
          </div>
        ) : (
          <>
            {online.length > 0 && (
              <div className="mb-3">
                <div className="text-[9px] uppercase tracking-[0.25em] text-fg-subtle font-bold px-2 mb-1.5">
                  En línea ({online.length})
                </div>
                {online.map((f) => {
                  const last = lastActivity.get(f.id);
                  return <FriendRow key={f.id} f={f} status="online" last={last} />;
                })}
              </div>
            )}
            {offline.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-fg-subtle font-bold px-2 mb-1.5">
                  Desconectados ({offline.length})
                </div>
                {offline.map((f) => {
                  const last = lastActivity.get(f.id);
                  return <FriendRow key={f.id} f={f} status="offline" last={last} />;
                })}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function FriendRow({ f, status, last }: { f: Friend; status: 'online' | 'offline'; last?: ActivityRow }) {
  return (
    <Link
      to={`/friends/${f.id}`}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors group ${status === 'offline' ? 'opacity-60' : ''}`}
    >
      <div className="relative shrink-0">
        <Avatar user={f as any} size={28} />
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-bg-elev ${status === 'online' ? 'bg-green-500' : 'bg-fg-subtle/60'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate flex items-center gap-1">
          {f.username}
          {f.is_pro && <span className="text-[8px] font-bold text-yellow-400">PRO</span>}
        </div>
        {last && (
          <div className="text-[10px] text-fg-subtle truncate">
            {last.kind === 'purchase' ? `compró ${last.target_label}` : last.kind === 'wishlist_add' ? `quiere ${last.target_label}` : last.target_label ?? ''}
            <span className="ml-1">· {relTime(last.created_at)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
