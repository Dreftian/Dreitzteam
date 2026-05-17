import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Layers } from 'lucide-react';
import type { Collection } from '../lib/types';
import GameCard from '../components/GameCard';
import { Skeleton, GameCardSkeleton } from '../components/Skeleton';

export default function CollectionDetail({ routeId }: { routeId?: string } = {}) {
  // `useParams()` está desincronizado con HashRouter en Electron — el slug
  // viene como prop desde renderPage() en App.tsx.
  const params = useParams<{ slug: string }>();
  const slug = routeId ?? params.slug;
  const [coll, setColl] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    window.api.collectionsGet(slug).then((c) => { setColl(c); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-72 w-full rounded-none" />
        <div className="p-8 max-w-7xl mx-auto">
          <Skeleton className="h-3 w-32 mb-3" />
          <Skeleton className="h-9 w-1/2 mb-3" />
          <Skeleton className="h-3 w-2/3 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <GameCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }
  if (!coll) return <div className="p-10 text-fg-muted">Colección no encontrada.</div>;

  return (
    <div>
      <div className="relative h-72 overflow-hidden">
        {coll.hero_image ? (
          <img src={coll.hero_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : coll.games[0]?.background_image ? (
          <img src={coll.games[0].background_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        ) : null}
        <div className="absolute inset-0 hero-gradient opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-8 h-full flex flex-col justify-end pb-6">
          <Link to="/collections" className="text-fg-muted hover:text-fg flex items-center gap-2 mb-3 text-sm">
            <ArrowLeft size={15} /> Todas las colecciones
          </Link>
          <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold mb-2 flex items-center gap-1.5">
            <Layers size={11} /> {coll.curator_name || 'Dreitzteam'} · {coll.games.length} juegos
          </div>
          <h1 className="text-5xl font-extrabold mb-2">{coll.title}</h1>
          {coll.description && <p className="text-fg-muted max-w-2xl">{coll.description}</p>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
          {coll.games.map((g) => <GameCard key={g.id} game={g} size="sm" />)}
        </div>
      </div>
    </div>
  );
}
