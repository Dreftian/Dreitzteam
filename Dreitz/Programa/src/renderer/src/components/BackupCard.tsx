import { useEffect, useState } from 'react';
import { CloudUpload, RotateCcw, Loader2, Check, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface BackupRow {
  key: string;
  updated_at?: string;
  size?: number;
}

/**
 * Tarjeta de Ajustes que gestiona el backup de la DB local en InsForge Storage.
 *
 * - Botón "Hacer backup ahora" → sube `dreitzteam.db.gz` al bucket privado.
 * - Lista los últimos 7 backups remotos con fecha + tamaño.
 * - "Restaurar" descarga el .gz seleccionado y reemplaza la DB local. La app
 *   pide reiniciar después (un toast con cuenta atrás).
 */
export default function BackupCard() {
  const { user } = useAuth();
  const [list, setList] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'backup' | string | null>(null);

  async function recargar() {
    if (!user) return;
    setLoading(true);
    try {
      const r: any = await window.api.backupList?.(user.id);
      setList(Array.isArray(r) ? r : []);
    } catch { setList([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { recargar(); }, [user?.id]);

  async function backupAhora() {
    if (!user) return;
    setBusy('backup');
    try {
      const r: any = await window.api.backupNow?.(user.id);
      if (r?.key) {
        toast.success(`Backup subido (${r.size_kb} KB)`);
        await recargar();
      } else {
        toast.error('Backup falló');
      }
    } catch (e) {
      toast.error('Backup falló: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function restaurar(key: string) {
    if (!confirm(
      '¿Restaurar este backup?\n\n' +
      'Tu DB actual se renombrará a `.before-restore` por seguridad.\n' +
      'La app se reiniciará después.'
    )) return;
    setBusy(key);
    try {
      const r: any = await window.api.backupRestore?.(key);
      if (r?.ok) {
        toast.success('Restaurado. Reiniciando en 3s…');
        setTimeout(() => window.api.windowClose?.(), 3000);
      } else {
        toast.error('Restore falló: ' + (r?.error ?? 'desconocido'));
      }
    } finally { setBusy(null); }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <CloudUpload size={17} className="text-cyan-400" />
        <h3 className="font-bold">Backup de tu DB</h3>
      </div>
      <p className="text-xs text-fg-muted mb-4">
        Sube un backup comprimido (gzip) de <code className="text-accent">dreitzteam.db</code> al
        bucket privado <code className="text-accent">dreitz-backups</code> en InsForge. Se hace
        automático cada 24h; aquí puedes forzarlo o restaurar uno anterior. Conservamos los
        últimos 7 backups.
      </p>

      <button
        onClick={backupAhora}
        disabled={busy === 'backup' || !user}
        className="btn btn-primary text-sm flex items-center gap-2 mb-4"
      >
        {busy === 'backup' ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
        Hacer backup ahora
      </button>

      <div className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">
        Backups remotos {list.length > 0 ? `· ${list.length}` : ''}
      </div>
      {loading ? (
        <div className="text-sm text-fg-muted">Cargando…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-fg-subtle italic flex items-center gap-2">
          <AlertCircle size={13} /> Aún no hay backups. Pulsa el botón de arriba.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((b) => (
            <li key={b.key} className="py-2.5 flex items-center gap-3">
              <Calendar size={14} className="text-fg-subtle shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono truncate">{b.key}</div>
                <div className="text-[11px] text-fg-subtle">
                  {b.updated_at ? new Date(b.updated_at).toLocaleString() : '—'}
                </div>
              </div>
              <button
                onClick={() => restaurar(b.key)}
                disabled={busy === b.key}
                className="btn text-xs flex items-center gap-1.5 hover:text-cyan-400"
              >
                {busy === b.key ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
