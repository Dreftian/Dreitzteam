import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Library as LibIcon, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Game } from '../lib/types';
import { formatDate } from '../lib/format';
import GameCard from '../components/GameCard';
import { Skeleton, GameCardSkeleton } from '../components/Skeleton';

export default function FriendLibrary({ routeId }: { routeId?: string } = {}) {
  // `useParams()` está desincronizado con HashRouter en Electron — el id
  // viene como prop desde renderPage() en App.tsx.
  const params = useParams<{ id: string }>();
  const id = routeId ?? params.id;
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const fid = parseInt(id);
    setLoading(true);
    Promise.all([
      window.api.friendsLibrary({ userId: user.id, friendId: fid }),
      window.api.friendsProfile({ userId: user.id, friendId: fid })
    ])
      .then(([g, p]) => { setGames(g); setProfile(p); })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
    window.api.funnelEmit({ userId: user.id, event: 'view_friend', targetId: fid });
  }, [id, user?.id]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Skeleton className="h-3 w-32 mb-4" />
        <div className="card p-6 mb-6 flex items-center gap-5">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }
  if (!profile) return <div className="p-10 text-fg-muted">No se pudo cargar.</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link to="/friends" className="text-fg-muted hover:text-fg flex items-center gap-2 mb-4 text-sm">
        <ArrowLeft size={15} /> Volver a amigos
      </Link>

      <div className="card p-6 mb-6 flex items-center gap-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-3xl font-extrabold text-white relative">
          {profile.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{profile.username}</h2>
            {profile.is_pro && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 flex items-center gap-1"><Crown size={11} /> PRO</span>}
          </div>
          <div className="text-sm text-fg-muted">Miembro desde {formatDate(profile.created_at)}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <LibIcon size={16} className="text-cyan-400 mx-auto mb-1" />
            <div className="font-bold">{profile.games}</div>
            <div className="text-[10px] uppercase text-fg-subtle">Juegos</div>
          </div>
          <div>
            <Award size={16} className="text-yellow-400 mx-auto mb-1" />
            <div className="font-bold">{profile.achievements}</div>
            <div className="text-[10px] uppercase text-fg-subtle">Logros</div>
          </div>
          <div>
            <Sparkles size={16} className="text-pink-400 mx-auto mb-1" />
            <div className="font-bold">{profile.stickers}</div>
            <div className="text-[10px] uppercase text-fg-subtle">Stickers</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-4">Biblioteca pública</h3>
      {!games.length ? (
        <div className="card p-10 text-center text-fg-muted">{profile.username} aún no tiene juegos.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
          {games.map((g) => <GameCard key={g.id} game={g} size="sm" />)}
        </div>
      )}
    </div>
  );
}
