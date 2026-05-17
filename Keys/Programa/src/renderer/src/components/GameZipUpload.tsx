import { useState } from 'react';
import { Upload, Trash2, Loader2, Check, ExternalLink, FileArchive } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Widget admin: subir un .zip de un juego al bucket `dreitz-games` en
 * InsForge. Tras subir, actualiza `games.download_url` y el cliente Dreitz
 * lo descarga automáticamente cuando el usuario lo compra.
 *
 * Uso en Keys Catalog / AddGame:
 *   <GameZipUpload gameId={game.id} currentUrl={game.download_url} />
 */
export default function GameZipUpload({ gameId, currentUrl, currentSize }: {
  gameId: number;
  currentUrl?: string | null;
  currentSize?: number | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');

  async function pickAndUpload() {
    const filePath: string | null = await (window.api as any).storagePickZip?.();
    if (!filePath) return;

    setUploading(true);
    setProgressLabel('Subiendo a InsForge…');
    try {
      const r: any = await (window.api as any).storageUploadGameZip?.({ gameId, filePath });
      if (r?.ok) {
        toast.success(`Subido · ${Math.round(r.size_bytes / 1024 / 1024)} MB`);
        // Recargar la página para reflejar el nuevo download_url
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(r?.error ?? 'Falló');
      }
    } finally {
      setUploading(false);
      setProgressLabel('');
    }
  }

  async function eliminar() {
    if (!confirm('¿Borrar el .zip remoto? Los usuarios ya no podrán descargar este juego (las copias instaladas no se afectan).')) return;
    setDeleting(true);
    try {
      const r: any = await (window.api as any).storageDeleteGameZip?.(gameId);
      if (r?.ok) {
        toast.success('Eliminado del bucket');
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(r?.error ?? 'Falló');
      }
    } finally { setDeleting(false); }
  }

  return (
    <div className="card p-4 mt-3 border-cyan-500/30 bg-cyan-500/5">
      <div className="flex items-center gap-2 mb-2">
        <FileArchive size={16} className="text-cyan-400" />
        <h4 className="font-bold text-sm">Archivo de descarga (CDN)</h4>
      </div>

      {currentUrl ? (
        <>
          <div className="flex items-center gap-2 mb-3 text-xs text-green-400">
            <Check size={13} /> Subido al bucket `dreitz-games`
            {currentSize ? <span className="text-fg-muted">· {Math.round(currentSize / 1024 / 1024)} MB</span> : null}
          </div>
          <div className="text-[11px] font-mono text-fg-muted truncate mb-3" title={currentUrl}>
            {currentUrl}
          </div>
          <div className="flex gap-2">
            <a href={currentUrl} target="_blank" rel="noopener" className="btn text-xs flex items-center gap-1.5">
              <ExternalLink size={11} /> Probar descarga
            </a>
            <button
              onClick={pickAndUpload}
              disabled={uploading}
              className="btn text-xs flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              Reemplazar
            </button>
            <button
              onClick={eliminar}
              disabled={deleting}
              className="btn text-xs hover:text-red-400 flex items-center gap-1.5"
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Eliminar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-fg-muted mb-3">
            Selecciona el <code className="text-accent">.zip</code> del juego (con el ejecutable + assets). Se sube a
            InsForge Storage y queda disponible para que los usuarios lo descarguen desde Dreitz.
          </p>
          <button
            onClick={pickAndUpload}
            disabled={uploading}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? progressLabel : 'Subir .zip del juego'}
          </button>
        </>
      )}
    </div>
  );
}
