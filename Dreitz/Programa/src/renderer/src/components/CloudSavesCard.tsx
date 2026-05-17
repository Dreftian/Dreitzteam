import { useEffect, useState } from 'react';
import { CloudUpload, FolderOpen, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/format';
import { toast } from 'sonner';

interface Snapshot { id: number; label: string | null; file_path: string; size_bytes: number; created_at: string }

export default function CloudSavesCard({ gameId, gameTitle }: { gameId: number; gameTitle: string }) {
  const { user } = useAuth();
  const [folder, setFolder] = useState<string | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!user) return;
    setFolder(await window.api.savesGetFolder(gameId) as any);
    setSnaps(await window.api.savesList({ userId: user.id, gameId }) as any);
  }

  useEffect(() => { load(); }, [user?.id, gameId]);

  async function pickFolder() {
    const p = await window.api.savesPickFolder() as any;
    if (!p) return;
    await window.api.savesSetFolder({ gameId, folder: p });
    setFolder(p);
    toast.success('Carpeta de guardado configurada');
  }

  async function backup() {
    if (!user) return;
    setBusy(true);
    try {
      const r = await window.api.savesBackup({ userId: user.id, gameId }) as any;
      toast.success(`Snapshot guardado · ${(r.size / 1024 ** 2).toFixed(1)} MB`);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function restore(s: Snapshot) {
    if (!user) return;
    if (!confirm(`Restaurar snapshot del ${formatDate(s.created_at)}? Las partidas actuales serán reemplazadas.`)) return;
    try {
      await window.api.savesRestore({ userId: user.id, snapshotId: s.id });
      toast.success('Restaurado · vuelve a abrir el juego');
    } catch (e) { toast.error((e as Error).message); }
  }

  async function del(s: Snapshot) {
    if (!user) return;
    if (!confirm('Eliminar este snapshot?')) return;
    await window.api.savesDelete({ userId: user.id, snapshotId: s.id });
    await load();
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <CloudUpload size={15} className="text-cyan-400" />
        <h3 className="font-semibold text-sm">Guardados de {gameTitle}</h3>
      </div>
      {!folder ? (
        <>
          <p className="text-xs text-fg-muted mb-3">
            Configura la carpeta donde el juego guarda partidas (típicamente en <code>%AppData%</code>, <code>Documents/My Games</code>, etc).
            Puedes apuntarla a OneDrive/Dropbox para sync entre PCs.
          </p>
          <button onClick={pickFolder} className="btn btn-secondary text-xs"><FolderOpen size={12} /> Elegir carpeta</button>
        </>
      ) : (
        <>
          <div className="text-[11px] text-fg-subtle mb-3 truncate" title={folder}>📁 {folder}</div>
          <div className="flex gap-2 mb-3">
            <button onClick={backup} disabled={busy} className="btn btn-primary text-xs flex-1">
              <CloudUpload size={12} /> {busy ? 'Guardando…' : 'Guardar ahora'}
            </button>
            <button onClick={pickFolder} className="btn btn-secondary text-xs"><FolderOpen size={12} /></button>
          </div>
          {snaps.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto thin-scrollbar pr-1">
              {snaps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-1.5 rounded bg-bg-hover/40 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{formatDate(s.created_at)}</div>
                    <div className="text-[10px] text-fg-subtle">{(s.size_bytes / 1024 ** 2).toFixed(1)} MB</div>
                  </div>
                  <button onClick={() => restore(s)} className="px-1.5 py-0.5 rounded hover:bg-bg-hover text-[10px]" title="Restaurar"><RotateCcw size={11} /></button>
                  <button onClick={() => del(s)} className="px-1.5 py-0.5 rounded hover:bg-red-500/15 hover:text-red-400 text-[10px]"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
