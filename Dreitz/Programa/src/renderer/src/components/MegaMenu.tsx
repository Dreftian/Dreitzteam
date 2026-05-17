import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Tag, Calendar, Sparkles, Layers, Heart, Crown, BadgePercent, Gift,
  Store as StoreIcon, Bookmark, Flame, Users, Trophy, Wand2
} from 'lucide-react';
import type { Promotion, Bundle, Collection } from '../lib/types';

const GENRES = ['RPG', 'Action', 'Strategy', 'Indie', 'Adventure', 'Multiplayer', 'Simulation', 'Casual'];

export default function MegaMenu() {
  const [open, setOpen] = useState(false);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [colls, setColls] = useState<Collection[]>([]);
  const closeTimer = useRef<number | null>(null);
  const loc = useLocation();

  // Close when route changes
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // Lazy-load when opened first time
  useEffect(() => {
    if (!open) return;
    if (!promos.length && !bundles.length && !colls.length) {
      Promise.all([
        window.api.promotionsActive(),
        window.api.bundlesList(),
        window.api.collectionsList()
      ]).then(([p, b, c]) => { setPromos(p); setBundles(b); setColls(c); });
    }
  }, [open]);

  function scheduleClose() {
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  }
  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
          open ? 'bg-bg-hover text-fg' : 'text-fg-muted hover:text-fg hover:bg-bg-hover'
        }`}
      >
        <StoreIcon size={15} />
        Tienda
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute top-full left-0 mt-2 w-[860px] z-[90] rounded-2xl shadow-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, var(--bg-elev) 0%, var(--bg-card) 100%)',
                border: '1px solid var(--border)',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.55)'
              }}
            >
              {/* Top accent bar */}
              <div className="h-0.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />

              <div className="p-6 grid grid-cols-12 gap-6">
                {/* Column 1: Explorar */}
                <div className="col-span-4">
                  <SectionTitle icon={<Wand2 size={12} />}>Explorar</SectionTitle>
                  <ul className="space-y-1">
                    <Item to="/store" icon={<StoreIcon size={16} />} label="Catálogo completo" desc="Todos los juegos" />
                    <Item to="/store?onSale=1" icon={<BadgePercent size={16} />} label="Ofertas activas" desc="Descuentos del momento" accent="text-green-400" />
                    <Item to="/coming-soon" icon={<Calendar size={16} />} label="Próximos lanzamientos" desc="Pre-órdenes y release dates" accent="text-cyan-400" />
                    <Item to="/store?free=1" icon={<Gift size={16} />} label="Juegos gratis" desc="A precio cero" accent="text-yellow-400" />
                    <Item to="/store?demo=1" icon={<Layers size={16} />} label="Demos" desc="Prueba antes de comprar" />
                  </ul>

                  <SectionTitle icon={<Tag size={12} />} className="mt-5">Géneros populares</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES.map((g) => (
                      <Link
                        key={g}
                        to={`/store?genre=${encodeURIComponent(g)}`}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-hover hover:bg-accent/15 hover:text-accent text-fg-muted transition-all"
                      >
                        {g}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Column 2: Promociones activas */}
                <div className="col-span-4 border-l border-border pl-6">
                  <SectionTitle icon={<Sparkles size={12} />}>Promociones activas</SectionTitle>
                  {promos.length ? (
                    <ul className="space-y-2">
                      {promos.slice(0, 4).map((p) => (
                        <li key={p.id}>
                          <Link
                            to={p.cta_target || '/store'}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors group"
                          >
                            <div
                              className="w-1 self-stretch rounded-full shrink-0"
                              style={{ background: p.accent_color }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm group-hover:text-accent truncate">{p.title}</div>
                              {p.subtitle && <div className="text-[11px] text-fg-muted line-clamp-2">{p.subtitle}</div>}
                            </div>
                            {p.games.length > 0 && (
                              <div className="flex -space-x-2 shrink-0">
                                {p.games.slice(0, 3).map((g, i) => (
                                  <img
                                    key={g.id}
                                    src={g.capsule_image || g.header_image}
                                    alt=""
                                    className="w-9 h-5 rounded ring-1 ring-bg-card object-cover"
                                    style={{ zIndex: 3 - i }}
                                  />
                                ))}
                              </div>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-fg-subtle p-2">Sin promociones por ahora.</div>
                  )}

                  <SectionTitle icon={<Flame size={12} />} className="mt-5">Acceso rápido</SectionTitle>
                  <ul className="space-y-1">
                    <Item to="/library" icon={<Layers size={16} />} label="Mi biblioteca" />
                    <Item to="/wishlist" icon={<Heart size={16} />} label="Mis deseos" accent="text-pink-400" />
                    <Item to="/pro" icon={<Crown size={16} />} label="Dreitz Pro" accent="text-yellow-400" />
                  </ul>
                </div>

                {/* Column 3: Bundles & curaduría */}
                <div className="col-span-4 border-l border-border pl-6">
                  <SectionTitle icon={<Bookmark size={12} />}>Curaduría</SectionTitle>
                  <ul className="space-y-2 mb-4">
                    {colls.slice(0, 3).map((c) => (
                      <li key={`c-${c.id}`}>
                        <Link to={`/collections/${c.slug}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover group">
                          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center shrink-0 ring-1 ring-border">
                            {c.hero_image ? (
                              <img src={c.hero_image} alt="" className="w-full h-full rounded-md object-cover" />
                            ) : (
                              <Bookmark size={15} className="text-purple-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm group-hover:text-accent truncate">{c.title}</div>
                            <div className="text-[11px] text-fg-subtle truncate">{c.curator_name || 'Dreitzteam'} · {c.games.length} juegos</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                    {!colls.length && <li className="text-xs text-fg-subtle p-2">Cargando colecciones...</li>}
                  </ul>

                  <SectionTitle icon={<Layers size={12} />}>Bundles</SectionTitle>
                  <ul className="space-y-2">
                    {bundles.slice(0, 2).map((b) => (
                      <li key={`b-${b.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover group">
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-green-500/30 to-cyan-500/30 flex items-center justify-center shrink-0 ring-1 ring-border">
                          <Tag size={15} className="text-green-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate">{b.title}</div>
                          <div className="text-[11px] text-fg-subtle">-{b.discount_percent}% en pack</div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/collections"
                    className="mt-4 inline-flex items-center gap-1 text-xs text-accent font-semibold hover:underline"
                  >
                    Ver todas las colecciones <ChevronDown size={11} className="-rotate-90" />
                  </Link>
                </div>
              </div>

              {/* Bottom row: shortcuts to social/account */}
              <div className="border-t border-border bg-bg-base/40 px-6 py-3 flex items-center gap-1 text-xs">
                <BottomLink to="/friends" icon={<Users size={13} />} label="Amigos" />
                <BottomLink to="/missions" icon={<Trophy size={13} />} label="Misiones diarias" />
                <BottomLink to="/stickers" icon={<Sparkles size={13} />} label="Stickers" />
                <BottomLink to="/wrapped" icon={<Sparkles size={13} />} label="Año en revista" />
                <div className="ml-auto text-fg-subtle">Pulsa <kbd className="px-1.5 py-0.5 rounded bg-bg-hover border border-border font-mono">Ctrl K</kbd> para buscar</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({ icon, children, className = '' }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[10px] uppercase tracking-[0.2em] text-fg-subtle font-bold mb-3 flex items-center gap-1.5 ${className}`}>
      <span className="text-accent">{icon}</span>
      {children}
    </div>
  );
}

function Item({ to, icon, label, desc, accent }: { to: string; icon: React.ReactNode; label: string; desc?: string; accent?: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-start gap-3 px-2 py-1.5 rounded-lg hover:bg-bg-hover transition-colors group"
      >
        <span className={`mt-0.5 ${accent ?? 'text-fg-muted group-hover:text-accent'}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-fg group-hover:text-accent">{label}</span>
          {desc && <span className="block text-[11px] text-fg-subtle truncate">{desc}</span>}
        </span>
      </Link>
    </li>
  );
}

function BottomLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-fg-muted hover:text-fg hover:bg-bg-hover font-medium"
    >
      {icon}{label}
    </Link>
  );
}
