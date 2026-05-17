import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, Link } from 'react-router-dom';
import type { LibraryGame } from '../lib/types';
import { Copy, Check, ExternalLink, PartyPopper, RotateCcw, Clock, Cloud, CloudOff } from 'lucide-react';
import { formatDate } from '../lib/format';
import EmptyState from '../components/EmptyState';
import { GameCardSkeleton } from '../components/Skeleton';
import RefundDialog from '../components/RefundDialog';
import InstallButton from '../components/InstallButton';
import GiftButton from '../components/GiftButton';
import ShelvesSection from '../components/ShelvesSection';
import CloudSavesCard from '../components/CloudSavesCard';
import { toast } from 'sonner';
import { useI18n } from '../lib/i18n';

function CloudSaveBadge({ userId, gameId }: { userId: number; gameId: number }) {
  // Indica si hay snapshots de saves locales — si los hay y user apuntó a carpeta
  // OneDrive/Dropbox, está "en la nube" funcionalmente.
  const [status, setStatus] = useState<'none' | 'local' | 'cloud'>('none');
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      window.api.savesList({ userId, gameId }),
      window.api.savesGetFolder(gameId)
    ]).then(([snaps, folder]: any) => {
      if (cancelled) return;
      if (!snaps?.length) return setStatus('none');
      const isCloud = typeof folder === 'string' && /(OneDrive|Dropbox|Google\s?Drive)/i.test(folder);
      setStatus(isCloud ? 'cloud' : 'local');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, gameId]);
  if (status === 'none') return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
        status === 'cloud' ? 'bg-green-500/15 text-green-300' : 'bg-bg-hover text-fg-subtle'
      }`}
      title={status === 'cloud' ? 'Saves respaldados en la nube' : 'Saves respaldados localmente'}
    >
      {status === 'cloud' ? <Cloud size={10} /> : <CloudOff size={10} />}
      {status === 'cloud' ? 'Cloud' : 'Local'}
    </span>
  );
}

export default function LibraryPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const justPurchased = params.get('order');
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(!!justPurchased);
  const [refundTarget, setRefundTarget] = useState<LibraryGame | null>(null);
  const [filter, setFilter] = useState<'all' | 'installed' | 'not_installed'>('all');
  const [installs, setInstalls] = useState<Record<number, any>>({});
  const [savesOpen, setSavesOpen] = useState<LibraryGame | null>(null);
  const { t } = useI18n();

  async function load() {
    if (!user) return;
    setLoading(true);
    const list = await window.api.libraryList(user.id);
    setGames(list);
    const inst = await window.api.installList(user.id);
    const map: Record<number, any> = {};
    for (const i of inst) map[i.game_id] = i;
    setInstalls(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  function copy(licenseId: number, code: string) {
    navigator.clipboard.writeText(code);
    setCopied(licenseId);
    toast.success('Clave copiada al portapapeles');
    setTimeout(() => setCopied(null), 1800);
  }

  async function redeem(licenseId: number) {
    if (!user) return;
    await window.api.libraryRedeem({ userId: user.id, licenseId });
    toast.success('Marcada como canjeada');
    await load();
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-1">{t('library.title')}</h2>
        <p className="text-fg-muted text-sm mb-6">{t('common.loading')}</p>
        <div className="grid md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <GameCardSkeleton key={i} size="lg" />)}
        </div>
      </div>
    );
  }

  const filtered = games.filter((g) => {
    if (filter === 'installed') return installs[g.id]?.status === 'installed';
    if (filter === 'not_installed') return installs[g.id]?.status !== 'installed';
    return true;
  });

  const installedCount = games.filter((g) => installs[g.id]?.status === 'installed').length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {showSuccess && (
        <div className="mb-6 card p-4 flex items-center gap-3 border-green-500/40 bg-green-500/10">
          <PartyPopper className="text-green-400" />
          <div className="flex-1">
            <div className="font-bold">¡Compra confirmada!</div>
            <div className="text-sm text-fg-muted">Tus claves ya están disponibles abajo.</div>
          </div>
          <button
            onClick={() => { setShowSuccess(false); params.delete('order'); setParams(params); }}
            className="text-fg-muted hover:text-fg"
          >×</button>
        </div>
      )}

      <h2 className="text-3xl font-bold mb-1">{t('library.title')}</h2>
      <p className="text-fg-muted text-sm mb-4">
        {games.length} juego{games.length === 1 ? '' : 's'} · {installedCount} instalado{installedCount === 1 ? '' : 's'}
      </p>

      {games.length > 0 && (
        <div className="flex gap-2 mb-6">
          {([
            ['all', 'Todos', games.length],
            ['installed', 'Instalados', installedCount],
            ['not_installed', 'Sin instalar', games.length - installedCount]
          ] as const).map(([k, label, n]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filter === k ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-bg-card border-border text-fg-muted hover:bg-bg-hover'}`}
            >
              {label} <span className="ml-1 text-fg-subtle">{n}</span>
            </button>
          ))}
        </div>
      )}

      {/* Custom Shelves estilo Steam */}
      {games.length > 0 && (
        <ShelvesSection libraryGames={games.map((g) => ({
          id: g.id,
          title: g.title,
          capsule_image: g.capsule_image ?? null,
          header_image: g.header_image ?? null,
          drm_platform: g.drm_platform
        }))} />
      )}

      {!games.length ? (
        <EmptyState
          illustration="library"
          title={t('library.empty.title')}
          body={t('library.empty.body')}
          cta={<Link to="/store" className="btn btn-primary text-sm">{t('common.go_to_store')}</Link>}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((g) => {
            const inst = installs[g.id];
            return (
              <div key={g.id} className="card overflow-hidden">
                <div className="flex">
                  <Link to={`/game/${g.id}`} className="shrink-0 relative">
                    <img src={g.capsule_image || g.header_image} alt="" className="w-44 h-28 object-cover" />
                    {inst?.status === 'installed' && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-green-500 text-white text-[9px] font-extrabold uppercase">
                        Instalado
                      </span>
                    )}
                  </Link>
                  <div className="flex-1 p-4 min-w-0">
                    <Link to={`/game/${g.id}`} className="font-bold mb-1 block hover:text-accent truncate">{g.title}</Link>
                    <div className="text-[11px] text-fg-subtle mb-2 flex items-center gap-2">
                      <span>{t('library.acquired_on')} {formatDate(g.acquired_at)}</span>
                      {user && <CloudSaveBadge userId={user.id} gameId={g.id} />}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <InstallButton gameId={g.id} drm={g.drm_platform} />
                      <GiftButton gameId={g.id} gameTitle={g.title} />
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-border bg-bg-base/60">
                  <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-1 flex items-center justify-between">
                    <span>Tu clave de activación</span>
                    {inst?.last_played_at && (
                      <span className="flex items-center gap-1 text-fg-muted normal-case tracking-normal">
                        <Clock size={10} /> última vez {formatDate(inst.last_played_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="flex-1 font-mono text-sm bg-bg-hover px-3 py-2 rounded select-text min-w-[200px]">{g.license_code}</code>
                    <button onClick={() => copy(g.license_id, g.license_code)} className="btn btn-secondary text-xs px-3 py-2">
                      {copied === g.license_id ? <><Check size={13} /> Copiada</> : <><Copy size={13} /> Copiar</>}
                    </button>
                    {!g.redeemed && (
                      <button onClick={() => redeem(g.license_id)} className="btn btn-secondary text-xs px-3 py-2">
                        Marcar canjeada
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {g.redeemed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">CANJEADA</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">DISPONIBLE</span>
                    )}
                    <a href={`https://store.steampowered.com/app/${g.steam_app_id}/`} target="_blank" rel="noreferrer" className="text-[11px] text-fg-muted hover:text-accent flex items-center gap-1">
                      Steam <ExternalLink size={11} />
                    </a>
                    <button
                      onClick={() => setSavesOpen(g)}
                      className="text-[11px] text-fg-muted hover:text-cyan-400 flex items-center gap-1"
                      title="Saves en la nube"
                    >
                      ☁ Saves
                    </button>
                    {g.order_item_id && !g.redeemed && (
                      <button
                        onClick={() => setRefundTarget(g)}
                        className="text-[11px] text-fg-muted hover:text-orange-400 flex items-center gap-1 ml-auto"
                        title="Solicitar reembolso"
                      >
                        <RotateCcw size={11} /> Reembolso
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {refundTarget && refundTarget.order_id && refundTarget.order_item_id && (
        <RefundDialog
          orderId={refundTarget.order_id}
          orderItemId={refundTarget.order_item_id}
          gameTitle={refundTarget.title}
          onClose={() => setRefundTarget(null)}
        />
      )}

      {savesOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSavesOpen(null)}>
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CloudSavesCard gameId={savesOpen.id} gameTitle={savesOpen.title} />
            <button onClick={() => setSavesOpen(null)} className="btn btn-secondary w-full mt-3 text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
