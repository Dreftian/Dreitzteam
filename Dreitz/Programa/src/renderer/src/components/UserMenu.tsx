import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown, Crown, Coins, RotateCcw, Gift,
  Users, Trophy, Sparkles, User as UserIcon, LogOut, Play, Library
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import { toast } from 'sonner';

interface RecentlyPlayed {
  game_id: number;
  title: string;
  capsule_image: string;
  header_image: string;
  last_played_at: string | null;
  status: string;
  drm_platform: string;
}

interface MenuItem {
  to: string;
  label: string;
  icon: any;
  badge?: 'pro' | 'admin';
  hint?: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentlyPlayed[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Load recently played when menu opens
  useEffect(() => {
    if (!open || !user) return;
    window.api.installList(user.id).then((list: any[]) => {
      const sorted = [...list]
        .sort((a, b) => (new Date(b.last_played_at || 0).getTime()) - (new Date(a.last_played_at || 0).getTime()))
        .slice(0, 3);
      setRecent(sorted as any);
    });
  }, [open, user?.id]);

  async function quickLaunch(gameId: number) {
    if (!user) return;
    try {
      await window.api.launchRun({ userId: user.id, gameId });
      toast.success('Lanzando juego...');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!user) return null;

  const groups: MenuGroup[] = [
    {
      title: 'Cuenta',
      items: [
        { to: '/profile', label: 'Mi perfil', icon: UserIcon },
        { to: '/pro', label: 'Perfil Pro', icon: Crown, badge: 'pro' },
        { to: '/points', label: 'Puntos · Nivel', icon: Coins },
        { to: '/gift-cards', label: 'Tarjetas de regalo', icon: Gift },
        { to: '/refunds', label: 'Reembolsos', icon: RotateCcw }
      ]
    },
    {
      title: 'Comunidad',
      items: [
        { to: '/friends', label: 'Amigos', icon: Users },
        { to: '/missions', label: 'Misiones diarias', icon: Trophy },
        { to: '/stickers', label: 'Stickers', icon: Sparkles },
        { to: '/wrapped', label: 'Año en revista', icon: Sparkles }
      ]
    }
  ];

  function go(path: string) {
    setOpen(false);
    setTimeout(() => nav(path), 30);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full transition-colors ${open ? 'bg-bg-hover' : 'hover:bg-bg-hover'}`}
        title={user.username}
      >
        <Avatar user={user} size={28} />
        <span className="text-sm font-semibold text-fg max-w-[120px] truncate">{user.username}</span>
        {user.is_pro && (
          <span className="text-[9px] font-bold text-yellow-400 px-1 py-0.5 rounded bg-yellow-500/15">PRO</span>
        )}
        <ChevronDown size={13} className={`text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 z-[90] rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, var(--bg-elev) 0%, var(--bg-card) 100%)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.55)'
          }}
        >
          <div className="h-0.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />

          {/* Header */}
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 p-4 hover:bg-bg-hover transition-colors border-b border-border"
          >
            <Avatar user={user} size={44} className="ring-2 ring-accent/40" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate flex items-center gap-1.5">
                {user.username}
                {user.is_pro && <Crown size={11} className="text-yellow-400" />}
                {user.role === 'admin' && <span className="text-[9px] font-bold text-red-400 px-1 py-0.5 rounded bg-red-500/15">ADMIN</span>}
              </div>
              <div className="text-[11px] text-fg-subtle truncate">{user.email ?? 'Sin correo'}</div>
              {user.ref_code && (
                <div className="text-[10px] text-fg-subtle truncate font-mono mt-0.5">{user.ref_code}</div>
              )}
            </div>
          </Link>

          <div className="py-2 max-h-[70vh] overflow-y-auto thin-scrollbar">
            {/* Tu biblioteca — últimos 3 jugados */}
            {recent.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-4 mb-2">
                  <div className="text-[9px] uppercase tracking-[0.25em] text-fg-subtle font-bold flex items-center gap-1.5">
                    <Library size={10} /> Tu biblioteca
                  </div>
                  <Link to="/library" onClick={() => setOpen(false)} className="text-[10px] text-accent font-semibold hover:underline">
                    Ver todo
                  </Link>
                </div>
                <div className="px-3 space-y-1">
                  {recent.map((g) => (
                    <div key={g.game_id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-bg-hover group">
                      <button onClick={() => go(`/game/${g.game_id}`)} className="shrink-0">
                        <img src={g.capsule_image || g.header_image} alt="" className="w-14 h-7 rounded object-cover" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => go(`/game/${g.game_id}`)} className="text-xs font-semibold truncate text-left w-full hover:text-accent">{g.title}</button>
                        <div className="text-[10px] text-fg-subtle">
                          {g.status === 'installed' ? 'Instalado' : 'No instalado'}
                          {g.last_played_at ? ` · jugaste hace ${relSince(g.last_played_at)}` : ''}
                        </div>
                      </div>
                      {g.status === 'installed' && (
                        <button
                          onClick={() => quickLaunch(g.game_id)}
                          title="Jugar"
                          className="w-7 h-7 rounded-full bg-green-500 hover:bg-green-400 text-white flex items-center justify-center shrink-0"
                        >
                          <Play size={12} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {groups.map((g, gi) => (
              <div key={g.title} className={gi > 0 ? 'mt-2' : ''}>
                <div className="text-[9px] uppercase tracking-[0.25em] text-fg-subtle font-bold px-4 mb-1">
                  {g.title}
                </div>
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const showBadge = it.badge === 'pro' && user.is_pro;
                  return (
                    <button
                      key={it.to}
                      onClick={() => go(it.to)}
                      className="w-full flex items-center gap-3 px-4 py-1.5 text-sm text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
                    >
                      <Icon size={15} className="text-accent" />
                      <span className="flex-1 text-left truncate">{it.label}</span>
                      {showBadge && <span className="text-[9px] font-bold text-yellow-400">PRO</span>}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="border-t border-border mt-2 pt-1">
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-1.5 text-sm text-fg-muted hover:bg-red-500/15 hover:text-red-300 transition-colors"
              >
                <LogOut size={15} />
                <span className="flex-1 text-left">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function relSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
