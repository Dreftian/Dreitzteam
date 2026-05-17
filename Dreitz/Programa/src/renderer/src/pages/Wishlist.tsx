import { useEffect, useState } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Game } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { formatPrice } from '../lib/format';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import PriceAlertButton from '../components/PriceAlertButton';
import { toast } from 'sonner';

export default function Wishlist() {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const list = await window.api.wishlistList(user.id);
    setGames(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  async function remove(g: Game) {
    if (!user) return;
    await window.api.wishlistToggle({ userId: user.id, gameId: g.id });
    toast.success(`${g.title} quitado de tu lista`);
    await load();
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-3 w-20 mb-6" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <Skeleton className="w-full aspect-[460/215] rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!games.length) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <EmptyState
          illustration="wishlist"
          title="Tu lista de deseos está vacía"
          body="Cuando encuentres juegos que te interesan, añádelos a esta lista para seguir sus precios y volver luego."
          cta={<Link to="/store" className="btn btn-primary text-sm">Explorar tienda</Link>}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-1 flex items-center gap-3"><Heart className="text-pink-400" /> Lista de deseos</h2>
      <p className="text-fg-muted text-sm mb-6">{games.length} juego{games.length === 1 ? '' : 's'}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((g) => (
          <div key={g.id} className="card overflow-hidden group relative">
            <Link to={`/game/${g.id}`}>
              <img src={g.header_image || g.capsule_image} alt="" className="w-full aspect-[460/215] object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            </Link>
            <div className="p-4">
              <Link to={`/game/${g.id}`} className="font-bold mb-1 truncate block hover:text-accent">{g.title}</Link>
              <div className="text-xs text-fg-muted truncate mb-3">{g.genres?.slice(0, 3).join(' · ')}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {g.discount_percent > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">-{g.discount_percent}%</span>
                  )}
                  <span className="font-bold">{formatPrice(g.price_final, g.currency)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <PriceAlertButton gameId={g.id} currentPrice={g.price_final} />
                  <button onClick={() => remove(g)} className="px-2 py-1 rounded hover:bg-red-500/15 hover:text-red-400 text-xs" title="Quitar de deseos">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
