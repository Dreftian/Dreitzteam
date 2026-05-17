import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import type { Game, Bundle, Promotion } from '../lib/types';
import GameRow from '../components/GameRow';
import GameCard from '../components/GameCard';
import PagedGameGrid from '../components/PagedGameGrid';
import { HeroSkeleton, RowSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import type { SortKey } from '../components/SortPills';
import CountdownBanner from '../components/CountdownBanner';
import PromoCarousel from '../components/PromoCarousel';
import DailyDealStrip from '../components/DailyDealStrip';
import CinematicHero from '../components/CinematicHero';
import RecommendationsRow from '../components/RecommendationsRow';
import FreeGameBanner from '../components/FreeGameBanner';
import FilterSidebar from '../components/FilterSidebar';
import MoodFilter, { type Mood } from '../components/MoodFilter';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useCatalog } from '../contexts/CatalogContext';
import { useI18n } from '../lib/i18n';

export default function Store() {
  const [params] = useSearchParams();
  const search = params.get('search') ?? '';
  const genreParam = params.get('genre') ?? '';
  const onSaleParam = params.get('onSale') === '1';
  const freeParam = params.get('free') === '1';
  const demoParam = params.get('demo') === '1';
  const { user } = useAuth();
  const { format } = useCurrency();
  const { t } = useI18n();
  // Cache global de juegos — la primera carga llena este contexto desde Login.
  // Aquí solo aplicamos filtros sobre el cache (sincrónico, instantáneo).
  const catalog = useCatalog();

  const [games, setGames] = useState<Game[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [recent, setRecent] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('featured');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(genreParam ? [genreParam] : []);
  const [selectedDrm, setSelectedDrm] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [onSale, setOnSale] = useState(onSaleParam);
  const [freeOnly, setFreeOnly] = useState(freeParam);
  const [preorderOnly, setPreorderOnly] = useState(false);
  const [priceMax, setPriceMax] = useState(500);
  const [mood, setMood] = useState<Mood | null>(null);

  // Si hay query de búsqueda Y el catálogo está cargado → Fuse.js (fuzzy match,
  // tolera typos). Si hay filtros complejos (precio/DLC/oferta) → IPC SQL.
  // Sin filtros → catálogo en memoria, instantáneo.
  useEffect(() => {
    // Fuzzy search en memoria — bypass del IPC
    if (search && catalog.loaded && catalog.games.length > 0) {
      import('../lib/fuzzySearch').then(({ buildIndex, fuzzySearch }) => {
        buildIndex(catalog.games as any);
        let list = fuzzySearch(search, 100) as Game[];
        // Aplicar filtros adicionales sobre el resultado fuzzy
        if (onSale) list = list.filter((x) => x.discount_percent > 0);
        if (freeOnly) list = list.filter((x) => x.price_final === 0);
        if (selectedGenres.length) {
          list = list.filter((x) => {
            const gs = (typeof x.genres === 'string' ? JSON.parse(x.genres || '[]') : x.genres) || [];
            return selectedGenres.some((sel) => gs.some((g: string) => g.toLowerCase() === sel.toLowerCase()));
          });
        }
        if (priceMax < 500) list = list.filter((x) => x.price_final <= priceMax);
        if (selectedDrm.length) list = list.filter((x) => selectedDrm.includes(x.drm_platform));
        if (selectedLanguages.length) {
          list = list.filter((x) => {
            const langs = (x.languages ?? '').split(',').map((s) => s.trim());
            return selectedLanguages.some((sel) => langs.includes(sel));
          });
        }
        setGames(list);
        setLoading(false);
      });
      return;
    }

    const hasComplexFilter = !!(onSale || freeOnly || preorderOnly || selectedGenres.length || priceMax < 500 || demoParam || sort !== 'featured');

    if (!hasComplexFilter && catalog.loaded) {
      let list = catalog.games;
      if (selectedDrm.length) list = list.filter((x) => selectedDrm.includes(x.drm_platform));
      if (selectedLanguages.length) {
        list = list.filter((x) => {
          const langs = (x.languages ?? '').split(',').map((s) => s.trim());
          return selectedLanguages.some((sel) => langs.includes(sel));
        });
      }
      setGames(list);
      setLoading(false);
      return;
    }

    setLoading(true);
    window.api.gamesList({
      search: search || undefined,
      sort: sort === 'featured' ? undefined : sort,
      onSaleOnly: onSale,
      freeOnly,
      preorderOnly,
      demoOnly: demoParam,
      genres: selectedGenres.length ? selectedGenres : undefined,
      maxPrice: priceMax >= 500 ? undefined : priceMax
    })
      .then((g: Game[]) => {
        let list = g;
        if (selectedDrm.length) list = list.filter((x) => selectedDrm.includes(x.drm_platform));
        if (selectedLanguages.length) {
          list = list.filter((x) => {
            const langs = (x.languages ?? '').split(',').map((s) => s.trim());
            return selectedLanguages.some((sel) => langs.includes(sel));
          });
        }
        setGames(list);
      })
      .finally(() => setLoading(false));
  }, [search, sort, onSale, freeOnly, preorderOnly, selectedGenres, selectedDrm, selectedLanguages, priceMax, demoParam, catalog.loaded, catalog.games]);

  useEffect(() => {
    window.api.bundlesList().then(setBundles);
    window.api.promotionsActive().then(setPromos);
  }, []);

  useEffect(() => {
    if (!user) return;
    window.api.gamesRecentlyViewed({ userId: user.id, limit: 8 }).then(setRecent);
  }, [user?.id]);

  function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }
  function resetAll() {
    setSelectedGenres([]); setSelectedDrm([]); setSelectedLanguages([]);
    setOnSale(false); setFreeOnly(false); setPreorderOnly(false);
    setPriceMax(500); setSort('featured');
  }

  // IMPORTANTE: el `useMemo` del mood DEBE ir antes de cualquier return condicional —
  // si va después, en un render se llama y en otro no, y React tira error #310
  // "Rendered fewer hooks than expected".
  const moodFiltered = useMemo(() => {
    if (!mood) return games;
    const wanted = mood.genres.map((g) => g.toLowerCase());
    return games.filter((g) => {
      const raw = g.genres ?? '';
      let arr: string[] = [];
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        arr = String(raw).split(',').map((s) => s.trim());
      }
      const lower = arr.map((s) => s.toLowerCase());
      return wanted.some((w) => lower.some((g) => g.includes(w) || w.includes(g)));
    });
  }, [games, mood]);

  const isFilteredView = !!(search || onSale || freeOnly || preorderOnly || selectedGenres.length || selectedDrm.length || selectedLanguages.length || priceMax < 500 || demoParam);

  if (loading && !isFilteredView) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <HeroSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (isFilteredView) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {search && <h2 className="text-2xl font-bold mb-2">Resultados para "{search}"</h2>}
        {!search && <h2 className="text-2xl font-bold mb-2">Catálogo</h2>}
        <p className="text-fg-muted text-sm mb-6">{games.length} juego{games.length === 1 ? '' : 's'}</p>

        <div className="flex gap-6">
          <FilterSidebar
            games={games}
            sort={sort}
            setSort={setSort}
            selectedGenres={selectedGenres}
            toggleGenre={(g) => setSelectedGenres((s) => toggle(s, g))}
            selectedDrm={selectedDrm}
            toggleDrm={(d) => setSelectedDrm((s) => toggle(s, d))}
            selectedLanguages={selectedLanguages}
            toggleLanguage={(l) => setSelectedLanguages((s) => toggle(s, l))}
            onSale={onSale}
            toggleOnSale={() => setOnSale((v) => !v)}
            freeOnly={freeOnly}
            toggleFree={() => setFreeOnly((v) => !v)}
            preorderOnly={preorderOnly}
            togglePreorder={() => setPreorderOnly((v) => !v)}
            priceMin={0}
            priceMax={priceMax}
            setPriceMax={setPriceMax}
            resetAll={resetAll}
          />

          <div className="flex-1 min-w-0">
            {!games.length ? (
              <EmptyState
                illustration="search"
                title="Nada coincide con esos filtros"
                body="Prueba con otra combinación o limpia para empezar de cero."
                cta={<button onClick={resetAll} className="btn btn-secondary text-sm">Limpiar filtros</button>}
              />
            ) : (
              <PagedGameGrid games={games} />
            )}
          </div>
        </div>
      </div>
    );
  }

  const featured = moodFiltered.filter((g) => g.is_featured && !g.is_preorder);
  const onSaleList = moodFiltered.filter((g) => g.discount_percent > 0 && !g.is_preorder);
  const newest = [...moodFiltered].filter((g) => !g.is_preorder).sort((a, b) => b.id - a.id).slice(0, 10);
  const preorders = moodFiltered.filter((g) => g.is_preorder).slice(0, 8);
  const all = moodFiltered.filter((g) => !g.is_preorder);
  const tab = (params.get('tab') as 'catalog' | 'featured') || 'catalog';

  function setTab(t: 'catalog' | 'featured') {
    const next = new URLSearchParams(params);
    if (t === 'catalog') next.delete('tab'); else next.set('tab', t);
    const qs = next.toString();
    location.hash = `#/store${qs ? '?' + qs : ''}`;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <DailyDealStrip />
      {promos.length > 0 ? <PromoCarousel promos={promos} /> : null}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        <TabBtn active={tab === 'catalog'} onClick={() => setTab('catalog')}>{t('store.full_catalog')}</TabBtn>
        <TabBtn active={tab === 'featured'} onClick={() => setTab('featured')}>Destacados y novedades</TabBtn>
      </div>

      {tab === 'featured' ? (
        <>
          {featured.length >= 2 && <CinematicHero games={featured} />}
          <FreeGameBanner />
          <MoodFilter active={mood?.key ?? null} onChange={setMood} />
          <RecommendationsRow />
          {recent.length > 0 && <GameRow title={t('store.continue_browsing')} games={recent} />}
          {featured.length > 0 && <GameRow title="Destacados" games={featured} size="lg" />}
          <GameRow title={t('store.recently_added')} games={newest} />
          {onSaleList.length > 0 && <GameRow title={t('store.deals')} games={onSaleList} />}
          {preorders.length > 0 && <GameRow title="Próximos lanzamientos" games={preorders} />}

          {bundles.length > 0 && (
            <section className="mb-10">
              <h3 className="text-xl font-bold tracking-tight mb-4">{t('store.bundles')}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {bundles.map((b) => (
                  <BundleTile key={b.id} bundle={b} format={format} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <PagedGameGrid games={all} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-5 py-3 text-sm font-semibold transition-all ${active ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
    >
      {children}
      {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent rounded-full" />}
    </button>
  );
}

function BundleTile({ bundle, format }: { bundle: Bundle; format: (v: number) => string }) {
  const total = bundle.games.reduce((s, g) => s + g.price_final, 0);
  const final = +(total * (1 - bundle.discount_percent / 100)).toFixed(2);

  return (
    <div className="card overflow-hidden p-5 relative bg-gradient-to-br from-purple-500/10 via-bg-card to-cyan-500/10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-semibold">Bundle</div>
          <h4 className="text-xl font-bold">{bundle.title}</h4>
        </div>
        <div className="px-2.5 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400">
          -{bundle.discount_percent}%
        </div>
      </div>
      {bundle.description && <p className="text-xs text-fg-muted mb-3">{bundle.description}</p>}
      {bundle.ends_at && <div className="mb-3"><CountdownBanner endsAt={bundle.ends_at} /></div>}

      <div className="flex gap-1 mb-4">
        {bundle.games.slice(0, 4).map((g) => (
          <Link key={g.id} to={`/game/${g.id}`} className="flex-1 aspect-[460/215] rounded overflow-hidden bg-bg-base">
            <img src={g.capsule_image || g.header_image} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform" />
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-fg-subtle">{bundle.games.length} juegos · valor original</div>
          <div className="text-xs text-fg-muted line-through">{format(total)}</div>
          <div className="text-2xl font-extrabold text-accent">{format(final)}</div>
        </div>
        <Link to={`/game/${bundle.games[0]?.id ?? ''}`} className="btn btn-primary text-sm">Ver juegos</Link>
      </div>
    </div>
  );
}
