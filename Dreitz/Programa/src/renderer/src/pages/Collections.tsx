import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Layers } from 'lucide-react';
import type { Collection } from '../lib/types';

export default function CollectionsList() {
  const [list, setList] = useState<Collection[]>([]);
  useEffect(() => { window.api.collectionsList().then(setList); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Bookmark className="text-purple-400" size={28} />
        <h2 className="text-3xl font-bold">Colecciones curadas</h2>
      </div>
      <p className="text-fg-muted text-sm mb-8">Selecciones armadas por la redacción de Dreitzteam.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((c) => (
          <Link
            key={c.id}
            to={`/collections/${c.slug}`}
            className="card overflow-hidden group hover:scale-[1.02] transition-transform"
          >
            <div className="aspect-[16/9] relative bg-gradient-to-br from-purple-500/20 via-bg-card to-cyan-500/20">
              {c.hero_image ? (
                <img src={c.hero_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : c.games[0]?.background_image ? (
                <img src={c.games[0].background_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-lg font-bold text-white drop-shadow-lg">{c.title}</h3>
                <div className="text-[10px] uppercase tracking-widest text-white/80 font-bold flex items-center gap-1.5">
                  <Layers size={10} /> {c.games.length} juegos · {c.curator_name || 'Dreitzteam'}
                </div>
              </div>
            </div>
            {c.description && (
              <div className="p-4 text-xs text-fg-muted line-clamp-2">{c.description}</div>
            )}
          </Link>
        ))}
        {!list.length && (
          <div className="col-span-full card p-10 text-center text-fg-muted">
            Aún no hay colecciones publicadas.
          </div>
        )}
      </div>
    </div>
  );
}
