import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Heart, Clock } from 'lucide-react';
import type { Game } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import WishlistButton from '../components/WishlistButton';
import { Skeleton } from '../components/Skeleton';
import { useCachedImage } from '../lib/useCachedImage';
import { formatDate } from '../lib/format';
import { toast } from 'sonner';

function relRelease(iso: string | null): { label: string; days: number } | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const days = Math.ceil(diff / 86_400_000);
  if (days <= 1) return { label: 'Mañana', days };
  if (days <= 7) return { label: `En ${days} días`, days };
  if (days <= 31) return { label: `En ${Math.ceil(days / 7)} semanas`, days };
  return { label: `En ${Math.ceil(days / 30)} meses`, days };
}

export default function ComingSoon() {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.api.gamesList({ preorderOnly: true, sort: 'release_soon' })
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Skeleton className="h-9 w-80 mb-2" />
        <Skeleton className="h-3 w-72 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card flex gap-4 p-4">
              <Skeleton className="w-48 aspect-[460/215] shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-3/4 mt-3" />
                <Skeleton className="h-3 w-2/3" />
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
          illustration="library"
          title="No hay pre-órdenes activas"
          body="Cuando agreguemos juegos próximos a salir aparecerán aquí."
          cta={<Link to="/store" className="btn btn-primary text-sm">Ver tienda</Link>}
        />
      </div>
    );
  }

  // Toma el juego más cercano a salir para el hero principal con countdown.
  const heroGame = [...games].sort((a, b) => {
    if (!a.release_at) return 1;
    if (!b.release_at) return -1;
    return new Date(a.release_at).getTime() - new Date(b.release_at).getTime();
  })[0];
  const heroRelease = heroGame ? relRelease(heroGame.release_at) : null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {heroGame && heroRelease && (
        <PreorderHero game={heroGame} release={heroRelease} />
      )}

      <div className="flex items-center gap-3 mb-1">
        <Calendar className="text-cyan-400" size={28} />
        <h2 className="text-3xl font-bold">Próximos lanzamientos</h2>
      </div>
      <p className="text-fg-muted text-sm mb-8">Reserva ahora y asegúrate de jugar el día uno.</p>

      <div className="space-y-4">
        {games.map((g) => {
          const r = relRelease(g.release_at);
          return (
            <div key={g.id} className="card overflow-hidden flex relative group">
              <Link to={`/game/${g.id}`} className="w-72 shrink-0 relative">
                {g.background_image ? (
                  <img src={g.background_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={g.header_image} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg-card" />
              </Link>
              <div className="flex-1 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">Próximamente</span>
                  {r && (
                    <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold uppercase flex items-center gap-1">
                      <Clock size={10} /> {r.label}
                    </span>
                  )}
                </div>
                <Link to={`/game/${g.id}`} className="text-2xl font-extrabold mb-1 block hover:text-accent">{g.title}</Link>
                <div className="text-xs text-fg-muted mb-2">{g.developer}</div>
                <p className="text-sm text-fg-muted line-clamp-2 mb-3">{g.short_description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-fg-muted">Salida estimada:</span>
                  <span className="font-semibold">{g.release_date || (g.release_at ? formatDate(g.release_at) : 'Sin fecha')}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Link to={`/game/${g.id}`} className="btn btn-primary text-sm">Ver detalle</Link>
                  <WishlistButton gameId={g.id} className="text-sm" />
                  {!user && (
                    <button
                      onClick={() => toast.info('Inicia sesión para guardar este juego en deseados')}
                      className="btn btn-secondary text-sm"
                    >
                      <Heart size={14} /> Guardar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CountdownChip({ value, label }: { value: number; label: string }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="card p-3 min-w-[72px] text-center bg-bg-elev/80 backdrop-blur"
    >
      <div className="text-3xl font-extrabold leading-none tabular-nums">{value.toString().padStart(2, '0')}</div>
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle mt-1">{label}</div>
    </motion.div>
  );
}

function PreorderHero({ game, release }: { game: Game; release: { label: string; days: number } }) {
  const bg = useCachedImage(game.background_image || game.header_image);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!game.release_at) return null;
  const target = new Date(game.release_at).getTime();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative rounded-2xl overflow-hidden h-[420px] mb-10"
    >
      {bg && <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {game.trailer_url && (
        <video src={game.trailer_url} poster={bg} autoPlay muted loop playsInline preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-bg-base via-bg-base/40 to-transparent" />

      <div className="relative h-full flex flex-col justify-end p-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full bg-cyan-500/90 text-white text-xs font-bold uppercase tracking-widest">
            Próximamente
          </span>
          <span className="text-fg-muted text-sm flex items-center gap-1.5">
            <Clock size={14} /> {release.label}
          </span>
        </div>
        <h1 className="text-5xl font-extrabold mb-2 drop-shadow-xl">{game.title}</h1>
        <p className="text-fg-muted max-w-2xl line-clamp-2 mb-5">{game.short_description}</p>

        <div className="flex gap-3 mb-5">
          <CountdownChip value={days} label="días" />
          <CountdownChip value={hours} label="horas" />
          <CountdownChip value={mins} label="min" />
          <CountdownChip value={secs} label="seg" />
        </div>

        <div className="flex gap-2">
          <Link to={`/game/${game.id}`} className="btn btn-primary text-sm">Ver detalle</Link>
          <WishlistButton gameId={game.id} className="text-sm" />
        </div>
      </div>
    </motion.div>
  );
}
