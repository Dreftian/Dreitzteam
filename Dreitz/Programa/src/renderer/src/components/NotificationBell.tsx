import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, Users, Trophy, Activity, Check, DownloadCloud, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface AlertItem {
  id: string;
  kind: 'wishlist_drop' | 'friend_request' | 'mission_ready' | 'live_activity' | 'update_available' | 'update_downloaded' | 'update_error';
  title: string;
  body: string;
  href?: string;
  actionLabel?: string;
  actionKind?: 'install-update';
  ts: number;
}

interface FeedItem {
  id: number;
  username: string;
  kind: string;
  target_label: string | null;
  created_at: string;
}

function relTime(iso: string | number): string {
  const ms = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'ahora';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

const STORAGE_KEY = 'dreitz.notif.dismissed';

function upsertAlert(list: AlertItem[], next: AlertItem): AlertItem[] {
  return [next, ...list.filter((item) => item.id !== next.id)].slice(0, 20);
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'alerts' | 'activity'>('alerts');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [runtimeAlerts, setRuntimeAlerts] = useState<AlertItem[]>([]);
  const [activity, setActivity] = useState<FeedItem[]>([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Aggregate alerts
  async function refresh() {
    if (!user) return;
    const items: AlertItem[] = [];
    try {
      const incoming = await window.api.friendsIncoming(user.id);
      for (const r of incoming as any[]) {
        items.push({
          id: `fr-${r.id}`,
          kind: 'friend_request',
          title: 'Solicitud de amistad',
          body: `${r.username} quiere ser tu amigo`,
          href: '/friends',
          ts: new Date(r.created_at).getTime()
        });
      }
    } catch {}
    try {
      const missions = await window.api.missionsToday(user.id);
      const ready = (missions as any[]).filter((m) => m.completed && !m.claimed);
      for (const m of ready) {
        items.push({
          id: `m-${m.id}`,
          kind: 'mission_ready',
          title: 'Misión completada',
          body: `${m.title} · +${m.reward_points} pts listos para reclamar`,
          href: '/missions',
          ts: Date.now()
        });
      }
    } catch {}
    items.sort((a, b) => b.ts - a.ts);
    setAlerts(items);

    try {
      const list = await window.api.activityList({ limit: 12, global: true });
      setActivity(list as any);
    } catch {}
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 12_000);
    return () => clearInterval(id);
  }, [user?.id]);

  // Listen to live price drops
  useEffect(() => {
    const off = window.api.onPriceAlert?.((p: any) => {
      const id = `wd-${p.gameId}-${Date.now()}`;
      setRuntimeAlerts((curr) => [{
        id,
        kind: 'wishlist_drop',
        title: 'Bajada de precio',
        body: `${p.title} ahora a S/. ${p.price.toFixed(2)}`,
        href: `/game/${p.gameId}`,
        ts: Date.now()
      }, ...curr]);
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    const off = window.api.onUpdaterEvent?.((event, payload) => {
      if (event === 'updater:checking') {
        setCheckingUpdate(true);
        return;
      }
      setCheckingUpdate(false);
      if (event === 'updater:upToDate') {
        toast.success('Dreitz ya esta actualizado');
        return;
      }
      if (event === 'updater:available') {
        const version = payload?.version ?? 'nueva';
        setRuntimeAlerts((curr) => upsertAlert(curr, {
          id: `update-available-${version}`,
          kind: 'update_available',
          title: 'Actualizacion disponible',
          body: `Dreitz ${version} se descargara desde GitHub Releases.`,
          ts: Date.now()
        }));
      }
      if (event === 'updater:downloaded') {
        const version = payload?.version ?? 'nueva';
        setRuntimeAlerts((curr) => upsertAlert(curr, {
          id: `update-downloaded-${version}`,
          kind: 'update_downloaded',
          title: 'Actualizacion lista',
          body: `Dreitz ${version} ya se descargo desde GitHub. Reinicia para instalarla.`,
          actionLabel: 'Actualizar',
          actionKind: 'install-update',
          ts: Date.now()
        }));
      }
      if (event === 'updater:error') {
        setRuntimeAlerts((curr) => upsertAlert(curr, {
          id: `update-error-${Date.now()}`,
          kind: 'update_error',
          title: 'No se pudo buscar actualizacion',
          body: payload?.message ?? 'GitHub Releases no respondio correctamente.',
          ts: Date.now()
        }));
      }
    });
    return () => off?.();
  }, []);

  async function checkForUpdates() {
    setCheckingUpdate(true);
    try {
      const r: any = await window.api.updaterCheckNow?.();
      if (r?.skipped) toast.info('Las actualizaciones se revisan en la app instalada.');
      else if (r?.ok === false) toast.error(r.error ?? 'No se pudo revisar GitHub Releases.');
      else toast.info('Buscando actualizaciones en GitHub...');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => setCheckingUpdate(false), 800);
    }
  }

  function runAlertAction(a: AlertItem) {
    if (a.actionKind === 'install-update') {
      window.api.updaterInstallAndRestart?.();
    }
  }

  function dismiss(id: string) {
    setDismissed((s) => {
      const next = new Set(s); next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }
  function clearAll() {
    const next = new Set<string>([...dismissed, ...alerts.map((a) => a.id), ...runtimeAlerts.map((a) => a.id)]);
    setDismissed(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    toast.success('Marcadas como leídas');
  }

  const visibleAlerts = [...runtimeAlerts, ...alerts]
    .sort((a, b) => b.ts - a.ts)
    .filter((a) => !dismissed.has(a.id));
  const count = visibleAlerts.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative w-9 h-9 rounded-md flex items-center justify-center transition-colors ${open ? 'bg-bg-hover text-fg' : 'hover:bg-bg-hover text-fg-muted'}`}
        title="Notificaciones"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
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
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex gap-1">
              <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')}>
                Alertas {count > 0 && <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-red-500 text-white">{count}</span>}
              </TabBtn>
              <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')}>En vivo</TabBtn>
            </div>
            {tab === 'alerts' && (
              <button onClick={checkForUpdates} className="text-[10px] text-fg-subtle hover:text-fg flex items-center gap-1">
                <RefreshCw size={11} className={checkingUpdate ? 'animate-spin' : ''} /> GitHub
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto thin-scrollbar">
            {tab === 'alerts' ? (
              <>
                {count > 0 && (
                  <div className="px-3 pt-2 flex justify-end">
                    <button onClick={clearAll} className="text-[10px] text-fg-subtle hover:text-fg flex items-center gap-1">
                      <Check size={11} /> Marcar todas
                    </button>
                  </div>
                )}
                {!visibleAlerts.length ? (
                  <div className="p-8 text-center text-xs text-fg-muted">Sin alertas pendientes</div>
                ) : (
                  <ul className="py-1">
                  {visibleAlerts.map((a) => {
                    const Icon = a.kind === 'wishlist_drop'
                      ? Heart
                      : a.kind === 'friend_request'
                        ? Users
                        : a.kind === 'mission_ready'
                          ? Trophy
                          : a.kind.startsWith('update_')
                            ? DownloadCloud
                            : Activity;
                    const color = a.kind === 'wishlist_drop'
                      ? 'text-pink-400'
                      : a.kind === 'friend_request'
                        ? 'text-cyan-400'
                        : a.kind === 'mission_ready'
                          ? 'text-yellow-400'
                          : a.kind === 'update_error'
                            ? 'text-red-400'
                            : a.kind.startsWith('update_')
                              ? 'text-green-400'
                              : 'text-fg-muted';
                    return (
                      <li key={a.id} className="px-3 py-2 hover:bg-bg-hover flex items-start gap-3 group">
                        <Icon size={15} className={`mt-0.5 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{a.title}</div>
                          <div className="text-[11px] text-fg-muted line-clamp-2">{a.body}</div>
                          <div className="text-[10px] text-fg-subtle mt-0.5">hace {relTime(a.ts)}</div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {a.actionLabel && (
                            <button onClick={() => runAlertAction(a)} className="text-[10px] text-green-400 font-semibold hover:underline">
                              {a.actionLabel}
                            </button>
                          )}
                          {a.href && (
                            <Link to={a.href} onClick={() => { setOpen(false); dismiss(a.id); }} className="text-[10px] text-accent font-semibold hover:underline">
                              Ver
                            </Link>
                          )}
                          <button onClick={() => dismiss(a.id)} className="text-[10px] text-fg-subtle hover:text-fg">×</button>
                        </div>
                      </li>
                    );
                  })}
                  </ul>
                )}
              </>
            ) : (
              !activity.length ? (
                <div className="p-8 text-center text-xs text-fg-muted">Sin actividad reciente</div>
              ) : (
                <ul className="py-1">
                  {activity.map((it) => {
                    const action = it.kind === 'purchase' ? 'compró' : it.kind === 'wishlist_add' ? 'agregó a deseados' : it.kind === 'pro_subscribe' ? 'activó' : 'hizo';
                    return (
                      <li key={it.id} className="px-3 py-1.5 text-xs hover:bg-bg-hover flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="font-semibold truncate max-w-[60px]">{it.username}</span>
                        <span className="text-fg-muted">{action}</span>
                        <span className="font-medium text-fg truncate flex-1">{it.target_label ?? '—'}</span>
                        <span className="text-fg-subtle text-[10px]">{relTime(it.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center ${active ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg hover:bg-bg-hover'}`}
    >{children}</button>
  );
}
