import { useEffect, useState } from 'react';
import { Play, FolderOpen, Trash2, CheckCircle, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { LogoMark } from './Logo';

interface InstallRow {
  status: 'not_installed' | 'installing' | 'installed' | 'needs_path';
  install_path?: string | null;
  launch_path?: string | null;
  installed_at?: string | null;
  last_played_at?: string | null;
  playtime_minutes?: number;
}

export default function InstallButton({ gameId, drm = 'steam', big = false }: { gameId: number; drm?: string; big?: boolean }) {
  const { user } = useAuth();
  const [state, setState] = useState<InstallRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!user) return;
    const s = await window.api.installStatus({ userId: user.id, gameId });
    setState(s as any);
  }

  useEffect(() => { refresh(); }, [user?.id, gameId]);

  async function startInstall() {
    if (!user) return;
    setBusy(true);
    try {
      const r = await window.api.installStart({ userId: user.id, gameId });
      if ((r as any).kind === 'steam') {
        toast.info('Abriendo Steam para instalar...');
      } else {
        toast.info('Selecciona el .exe del juego para registrarlo');
        const p = await window.api.installSetStandalonePath({ userId: user.id, gameId });
        if ((p as any).success) toast.success('Ruta guardada');
      }
      await refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function markInstalled() {
    if (!user) return;
    await window.api.installMarkSteamInstalled({ userId: user.id, gameId });
    toast.success('Marcado como instalado');
    await refresh();
  }

  async function launch() {
    if (!user) return;
    setBusy(true);
    try {
      await window.api.launchRun({ userId: user.id, gameId });
      toast.success('Lanzando juego...');
      // Poll: when window regains focus we record stop time
      const onFocus = () => {
        window.removeEventListener('focus', onFocus);
        window.api.launchStop({ userId: user.id, gameId }).then(() => refresh());
      };
      window.addEventListener('focus', onFocus);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function uninstall() {
    if (!user) return;
    if (!confirm('¿Marcar como no instalado? (no se borra el juego del disco)')) return;
    await window.api.installUninstall({ userId: user.id, gameId });
    toast.success('Marcado como no instalado');
    await refresh();
  }

  async function openFolder() {
    if (!user) return;
    try {
      await window.api.installOpenFolder({ userId: user.id, gameId });
    } catch (e) { toast.error((e as Error).message); }
  }

  if (!user || !state) return null;

  const sizeClass = big ? 'text-base px-5 py-3' : 'text-sm';

  if (state.status === 'installed') {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={launch}
          disabled={busy}
          className={`btn ${sizeClass}`}
          style={{ background: 'linear-gradient(135deg,#38e07b,#10b981)', color: 'white', boxShadow: '0 6px 24px rgba(56,224,123,.35)' }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={big ? 20 : 16} fill="currentColor" />}
          Jugar
        </button>
        <button onClick={openFolder} className="btn btn-secondary text-sm" title="Abrir carpeta">
          <FolderOpen size={14} />
        </button>
        <button onClick={uninstall} className="btn btn-secondary text-sm" title="Marcar como no instalado">
          <Trash2 size={14} />
        </button>
        {!!state.playtime_minutes && (
          <span className="text-xs text-fg-subtle">{state.playtime_minutes} min jugado</span>
        )}
      </div>
    );
  }

  if (state.status === 'installing') {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={markInstalled} className={`btn btn-primary ${sizeClass}`}>
          <CheckCircle size={16} /> Ya está instalado
        </button>
        <span className="text-xs text-fg-muted flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Instalando vía Steam…
        </span>
      </div>
    );
  }

  if (state.status === 'needs_path') {
    return (
      <button
        onClick={async () => {
          if (!user) return;
          await window.api.installSetStandalonePath({ userId: user.id, gameId });
          await refresh();
        }}
        className={`btn btn-primary ${sizeClass}`}
      >
        <FileText size={16} /> Seleccionar ejecutable
      </button>
    );
  }

  return (
    <button
      onClick={startInstall}
      disabled={busy}
      className={`btn ${sizeClass}`}
      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', color: 'white', boxShadow: '0 6px 24px color-mix(in srgb, var(--accent) 35%, transparent)' }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <LogoMark size={big ? 'sm' : 'xs'} />}
      {drm === 'steam' ? 'Instalar (vía Steam)' : 'Instalar'}
    </button>
  );
}
