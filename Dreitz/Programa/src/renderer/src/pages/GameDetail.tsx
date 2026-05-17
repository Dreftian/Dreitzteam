import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Game, PriceHistoryPoint } from '../lib/types';
import { formatDate, stripHtml } from '../lib/format';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useI18n } from '../lib/i18n';
import { ShoppingCart, Check, Calendar, Cpu, Tag, ArrowLeft, ExternalLink, Maximize2, LineChart, Star, Globe, Award } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import Sparkline from '../components/Sparkline';
import WishlistButton from '../components/WishlistButton';
import PriceAlertButton from '../components/PriceAlertButton';
import HltbCard from '../components/HltbCard';
import GameCard from '../components/GameCard';
import CountdownBanner from '../components/CountdownBanner';
import TrailerPlayer from '../components/TrailerPlayer';
import Reviews from '../components/Reviews';
import CompareSteamPrice from '../components/CompareSteamPrice';
import DrmBadge from '../components/DrmBadge';
import InstallButton from '../components/InstallButton';
import PCCheckCard from '../components/PCCheckCard';
import CinemagraphHero from '../components/CinemagraphHero';
import PriceDisplay from '../components/PriceDisplay';
import SteamOwnedBadge from '../components/SteamOwnedBadge';
import DownloadButton from '../components/DownloadButton';
import { useVibrantAccent } from '../lib/useVibrantAccent';
import { useMagnetic } from '../lib/useMagnetic';
import { useCatalog } from '../contexts/CatalogContext';
import { toast } from 'sonner';

export default function GameDetail({ routeId }: { routeId?: string } = {}) {
  // `useParams()` está desincronizado con HashRouter en Electron y devuelve
  // {} incluso cuando la URL es correcta — por eso aceptamos `routeId` como
  // prop desde el renderPage() de App.tsx (fuente de verdad: el hash vivo).
  const params = useParams<{ id: string }>();
  const id = routeId ?? params.id;
  const nav = useNavigate();
  const { t } = useI18n();
  const { format } = useCurrency();
  const catalog = useCatalog();
  // Si el juego está en el cache global, lo usamos como primer paint (sin
  // "Cargando..."). El IPC `games:get` corre en background para data fresca.
  const gidNum = id ? parseInt(id, 10) : 0;
  const cached = catalog.getGame(gidNum) ?? null;
  const [game, setGame] = useState<Game | null>(cached);
  const [stock, setStock] = useState(0);
  const [activeShot, setActiveShot] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  // Pinta el UI con el color dominante del header del juego mientras lo ves.
  useVibrantAccent(game?.header_image);
  const ctaRef = useMagnetic({ radius: 140, strength: 0.14 });
  void format;
  const [showTrailer, setShowTrailer] = useState(false);
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [related, setRelated] = useState<Game[]>([]);
  const [flash, setFlash] = useState<{ discount_percent: number; ends_at: string; effective_price: number } | null>(null);
  const [owned, setOwned] = useState(false);
  const { add, has } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    if (!id) return;
    const gid = parseInt(id, 10);
    setActiveShot(0);
    setShowTrailer(false);
    // Si el game ya estaba en cache, ya está hidratado. Igual lo refrescamos
    // por si tiene cambios recientes (precio, stock, oferta flash, etc).
    const fromCache = catalog.getGame(gid);
    if (fromCache && !game) setGame(fromCache);
    window.api.gamesGet(gid).then((g) => { if (g) setGame(g); });
    window.api.gamesAvailableStock(gid).then(setStock);
    window.api.gamesPriceHistory(gid).then(setHistory);
    window.api.gamesRelated({ gameId: gid, limit: 6 }).then(setRelated);
    window.api.gamesFlashSale(gid).then(setFlash);
    if (user) {
      window.api.gamesTrackView({ userId: user.id, gameId: gid });
      window.api.libraryList(user.id).then((lib: any[]) => setOwned(lib.some((g) => g.id === gid)));
    }
  }, [id, user?.id, catalog]);

  if (!game) return <div className="p-10 text-fg-muted">{t('common.loading')}</div>;

  const inCart = has(game.id);
  const effectiveBase = flash ? flash.effective_price : game.price_final;
  const proPrice = user?.is_pro ? +(effectiveBase * 0.85).toFixed(2) : effectiveBase;

  function addToCart() {
    if (!game) return;
    add({
      gameId: game.id,
      title: game.title,
      price: proPrice,
      capsule_image: game.capsule_image || game.header_image
    });
    toast.success(`${game.title} añadido al carrito`);
    if (user) window.api.funnelEmit({ userId: user.id, event: 'add_to_cart', targetId: game.id });
  }

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[480px] overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-30">
          <CinemagraphHero videoUrl={game.trailer_url} posterUrl={game.background_image || game.header_image} />
        </div>
        {/* Logo de marca del juego en la ESQUINA SUPERIOR DERECHA del hero —
            antes estaba sobre el `<h1>` y se solapaba con el título textual.
            Si Steam no tiene logo.png para ese appid, onError lo oculta limpio. */}
        {game.steam_app_id && (
          <motion.img
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 0.92, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
            src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_app_id}/logo.png`}
            alt=""
            aria-hidden="true"
            className="steam-logo absolute right-10 top-8 max-w-[260px] max-h-[120px] z-[1] drop-shadow-2xl"
            style={{ filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.65))' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <div className="absolute inset-x-0 top-[420px] h-40 bg-gradient-to-b from-transparent to-bg-base pointer-events-none" />

      <div className="relative max-w-7xl mx-auto p-8">
        <button onClick={() => nav(-1)} className="text-fg-muted hover:text-fg flex items-center gap-2 mb-6 text-sm">
          <ArrowLeft size={15} /> {t('common.back')}
        </button>

        <div className="flex items-center gap-2 mb-2">
          {game.is_preorder && (
            <span className="px-2.5 py-0.5 rounded bg-cyan-500 text-white text-[10px] font-extrabold uppercase tracking-widest">Pre-orden</span>
          )}
          {game.is_demo && (
            <span className="px-2.5 py-0.5 rounded bg-purple-500 text-white text-[10px] font-extrabold uppercase tracking-widest">Demo</span>
          )}
          {flash && (
            <span className="px-2.5 py-0.5 rounded bg-yellow-400 text-black text-[10px] font-extrabold uppercase tracking-widest animate-pulse">
              FLASH SALE -{flash.discount_percent}%
            </span>
          )}
          <DrmBadge drm={game.drm_platform} />
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-4xl md:text-5xl font-extrabold mb-2"
        >
          {game.title}
        </motion.h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-fg-muted mb-6">
          {game.developer && (
            <span>Desarrollador: <Link to={`/store?dev=${encodeURIComponent(game.developer)}`} className="text-fg hover:text-accent">{game.developer}</Link></span>
          )}
          {game.publisher && (
            <span>Editor: <Link to={`/store?pub=${encodeURIComponent(game.publisher)}`} className="text-fg hover:text-accent">{game.publisher}</Link></span>
          )}
          {game.release_date && (
            <span className="flex items-center gap-1.5"><Calendar size={13} /> {game.release_date}</span>
          )}
          {game.metacritic_score && (
            <span className="flex items-center gap-1.5">
              <Award size={13} className="text-yellow-400" /> Metacritic <span className="text-fg font-bold">{game.metacritic_score}</span>
            </span>
          )}
          {typeof game.steam_review_count === 'number' && game.steam_review_count > 0 && (
            <span className="flex items-center gap-1.5">
              <Star size={13} className="text-blue-400" /> Steam <span className="text-fg font-bold">{game.steam_review_count.toLocaleString()}</span>
            </span>
          )}
        </div>

        {flash && (
          <div className="mb-6"><CountdownBanner endsAt={flash.ends_at} label="Flash sale termina en" /></div>
        )}
        {!flash && game.discount_ends_at && game.discount_percent > 0 && (
          <div className="mb-6"><CountdownBanner endsAt={game.discount_ends_at} label="Oferta termina en" /></div>
        )}

        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-2">
            {showTrailer && game.trailer_url ? (
              <TrailerPlayer url={game.trailer_url} poster={game.screenshots[0] || game.header_image} />
            ) : game.screenshots[activeShot] ? (
              <button
                onClick={() => setLightbox(true)}
                className="relative group aspect-video rounded-xl overflow-hidden mb-3 bg-bg-card w-full block"
              >
                <img src={game.screenshots[activeShot]} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-md text-white text-xs flex items-center gap-1.5">
                    <Maximize2 size={13} /> Ver en grande
                  </div>
                </div>
              </button>
            ) : (
              <div className="aspect-video rounded-xl mb-3 bg-bg-card overflow-hidden">
                {game.header_image && <img src={game.header_image} alt="" className="w-full h-full object-cover" />}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              {game.trailer_url && (
                <button
                  onClick={() => setShowTrailer((v) => !v)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${showTrailer ? 'bg-accent text-white' : 'bg-bg-hover text-fg-muted hover:text-fg'}`}
                >
                  ▶ Trailer
                </button>
              )}
              {game.screenshots.slice(0, 8).map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveShot(i); setShowTrailer(false); }}
                  className={`flex-1 aspect-video rounded overflow-hidden ${i === activeShot && !showTrailer ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100'}`}
                  style={{ maxWidth: 100 }}
                >
                  <img src={s} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Description with expand/collapse */}
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-3">{t('detail.about')}</h2>
              <CollapsibleDescription text={stripHtml(game.detailed_description) || game.short_description} />
            </div>

            {/* DLC / contenido descargable */}
            <DlcSection gameId={game.id} />
          </div>

          <aside className="card p-5 h-fit sticky top-4">
            {game.header_image && (
              <img src={game.header_image} alt="" className="rounded-lg mb-4 w-full" />
            )}
            <p className="text-sm text-fg-muted mb-4">{game.short_description}</p>

            <div className="flex flex-wrap gap-1 mb-4">
              {game.genres.map((g) => (
                <Link
                  key={g}
                  to={`/store?genre=${encodeURIComponent(g)}`}
                  className="px-2 py-0.5 rounded text-[11px] bg-bg-hover hover:bg-accent/20 hover:text-accent text-fg-muted transition-colors"
                >{g}</Link>
              ))}
            </div>

            <div className="border-t border-border pt-4 mb-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-fg-muted text-sm mt-1">Precio</span>
                <div className="text-right">
                  <PriceDisplay
                    priceInitial={game.price_initial}
                    priceFinal={effectiveBase}
                    discountPercent={flash ? flash.discount_percent : game.discount_percent}
                    size="lg"
                  />
                </div>
              </div>
              {user?.is_pro && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-yellow-400 font-semibold">Precio Pro (-15%)</span>
                  <span className="font-bold text-yellow-400 price-final">{format(proPrice)}</span>
                </div>
              )}
              {!game.is_preorder && (
                <div className={`text-xs mt-2 ${stock > 3 ? 'text-green-400' : stock > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                  {stock > 0 ? `${stock} ${t('detail.copies_available')}` : t('detail.no_stock')}
                </div>
              )}
            </div>

            {/* Detección Steam: si el usuario tiene este mismo juego instalado en
                Steam, le ofrecemos lanzarlo desde allí en vez de obligarlo a
                comprarlo otra vez. */}
            <SteamOwnedBadge steamAppId={game.steam_app_id} />

            {owned ? (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
                  <Check size={15} /> Ya tienes este juego en tu biblioteca
                </div>
                {/* Descarga + extracción desde InsForge Storage (cuando el catálogo trae download_url).
                    Si no hay URL todavía, el botón está disabled y explica al usuario. */}
                <DownloadButton
                  gameId={game.id}
                  licenseId={(game as any).licenseId ?? null}
                  downloadUrl={(game as any).download_url}
                />
                <InstallButton gameId={game.id} drm={game.drm_platform} big />
                <Link to="/library" className="btn btn-secondary w-full text-sm">Ir a biblioteca</Link>
              </div>
            ) : game.is_preorder ? (
              <button
                onClick={() => toast.info('Función de pre-orden próximamente · agrega a deseados para no perderlo')}
                className="btn btn-primary w-full mb-2"
              >
                <Calendar size={16} /> Reservar pre-orden
              </button>
            ) : (
              <>
                <button
                  ref={ctaRef as any}
                  disabled={inCart || stock === 0}
                  onClick={addToCart}
                  className="magnetic btn btn-primary w-full mb-2 py-3 text-base"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                    boxShadow: '0 10px 30px -10px color-mix(in srgb, var(--accent) 55%, transparent)'
                  }}
                >
                  {inCart ? <><Check size={16} /> {t('common.in_cart')}</> : <><ShoppingCart size={16} /> {t('common.add_to_cart')}</>}
                </button>
                <Link to="/cart" className="btn btn-secondary w-full text-sm mb-2">{t('common.go_to_cart')}</Link>
                <WishlistButton gameId={game.id} className="w-full text-sm mb-3" />
                <div className="mb-3"><PriceAlertButton gameId={game.id} currentPrice={game.price_final} /></div>
              </>
            )}

            {!owned && <CompareSteamPrice gameId={game.id} />}
            <div className="mt-3"><PCCheckCard gameId={game.id} /></div>
            <div className="mt-3"><HltbCard gameId={game.id} /></div>

            <div className="mt-4 flex items-center gap-2 text-xs text-fg-subtle">
              <ExternalLink size={12} />
              <a href={`https://store.steampowered.com/app/${game.steam_app_id}/`} target="_blank" rel="noreferrer" className="hover:text-accent">
                {t('common.see_steam')}
              </a>
            </div>
          </aside>
        </div>

        {/* Specs strip — balanced columns so no card grows much taller than its neighbors */}
        <section className="mb-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.length >= 2 && (
            <div className="card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm"><LineChart size={15} /> {t('detail.price_history')}</h3>
              <Sparkline points={history} />
              <div className="text-[11px] text-fg-subtle mt-2">Última actualización: {formatDate(history[history.length - 1].recorded_at)}</div>
            </div>
          )}

          <div className="card p-4 text-sm text-fg-muted lg:col-span-1">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm text-fg"><Cpu size={15} /> {t('detail.requirements.min')}</h3>
            <div className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: game.pc_requirements_min || '<p>No especificado</p>' }} />
          </div>

          <div className="card p-4 text-sm text-fg-muted lg:col-span-1">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm text-fg"><Cpu size={15} /> {t('detail.requirements.rec')}</h3>
            <div className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: game.pc_requirements_rec || '<p>No especificado</p>' }} />
          </div>

          {game.languages && (
            <div className="card p-4">
              <div className="font-semibold mb-2 flex items-center gap-2 text-sm"><Globe size={14} /> Idiomas soportados</div>
              <div className="text-xs text-fg-muted">{game.languages}</div>
            </div>
          )}

          {game.categories.length > 0 && (
            <div className="card p-4 md:col-span-2 lg:col-span-2">
              <div className="font-semibold mb-2 flex items-center gap-2 text-sm"><Tag size={14} /> Categorías</div>
              <div className="flex flex-wrap gap-1">
                {game.categories.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded text-[11px] bg-bg-hover text-fg-muted">{c}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        <Reviews gameId={game.id} />

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-4">{t('detail.related')}</h2>
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar">
                {related.map((g) => <GameCard key={g.id} game={g} />)}
              </div>
              <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-bg-base to-transparent pointer-events-none" />
            </div>
          </section>
        )}
      </div>

      {lightbox && game.screenshots.length > 0 && (
        <Lightbox
          images={game.screenshots}
          startIndex={activeShot}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

function CollapsibleDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split(/\n/).filter((l) => l.trim());
  const isLong = text.length > 600 || lines.length > 8;

  return (
    <div>
      <div
        className={`text-fg-muted leading-relaxed text-sm whitespace-pre-line transition-all relative ${
          !expanded && isLong ? 'max-h-44 overflow-hidden' : ''
        }`}
      >
        {text}
        {!expanded && isLong && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg-base to-transparent pointer-events-none" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-accent font-semibold hover:underline"
        >
          {expanded ? '↑ Ver menos' : '↓ Ver descripción completa'}
        </button>
      )}
    </div>
  );
}

function DlcSection({ gameId }: { gameId: number }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    window.api.gamesDlcs(gameId).then((d) => alive && setList(d as any[])).catch(() => {});
    return () => { alive = false; };
  }, [gameId]);

  if (!list.length) return null;

  return (
    <section className="mt-8">
      <h3 className="text-base font-bold mb-3 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-widest">DLC</span>
        Contenido descargable y expansiones
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((d) => (
          <Link key={d.id} to={`/game/${d.id}`} className="card p-3 flex gap-3 hover:bg-bg-hover transition-colors">
            <img src={d.capsule_image || d.header_image} alt="" className="w-24 h-12 rounded object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{d.title}</div>
              <div className="text-[11px] text-fg-subtle truncate">{d.short_description}</div>
            </div>
            {d.price_final > 0 && (
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-accent">S/. {d.price_final.toFixed(2)}</div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
