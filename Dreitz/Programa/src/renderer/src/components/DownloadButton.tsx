import { useEffect, useState } from 'react';
import { Download, Loader2, Check, FolderOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface Progreso {
  juego_id: number;
  porcentaje: number;
  bytes_descargados: number;
  bytes_total: number;
  estado: 'descargando' | 'extrayendo' | 'completado' | 'error';
  mensaje?: string;
}

/**
 * Botón "Descargar juego" que aparece en GameDetail si el usuario tiene una
 * licencia y el catálogo trae `download_url`. Muestra una barra de progreso
 * en vivo (eventos `download:progress` desde el main).
 *
 * Al terminar, queda en estado "Instalado" con botón "Jugar" que llama al
 * launcher (gameLaunch IPC ya existe).
 */
export default function DownloadButton({ gameId, licenseId, downloadUrl }: {
  gameId: number;
  licenseId: number | null;
  downloadUrl?: string | null;
}) {
  const { user } = useAuth();
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [installPath, setInstallPath] = useState<string | null>(null);

  // Verificar si ya está instalado al cargar el botón
  useEffect(() => {
    if (!user) return;
    window.api.downloadsInstallPath?.({ userId: user.id, gameId })
      .then((p: string | null) => setInstallPath(p))
      .catch(() => {});
  }, [user?.id, gameId]);

  // Escuchar eventos de progreso filtrados al gameId actual
  useEffect(() => {
    const off = window.api.onDownloadProgress?.((p: Progreso) => {
      if (p.juego_id !== gameId) return;
      setProgreso(p);
      if (p.estado === 'completado') {
        toast.success('Descarga completa');
        setInstallPath('installed');
      } else if (p.estado === 'error') {
        toast.error('Descarga falló: ' + (p.mensaje ?? 'desconocido'));
      }
    });
    return () => off?.();
  }, [gameId]);

  async function iniciar() {
    if (!user || !licenseId) {
      toast.error('Necesitas una licencia activa para descargar');
      return;
    }
    if (!downloadUrl) {
      toast.error('Este juego aún no tiene URL de descarga (el admin debe subirlo)');
      return;
    }
    setProgreso({ juego_id: gameId, porcentaje: 0, bytes_descargados: 0, bytes_total: 0, estado: 'descargando' });
    const r: any = await window.api.downloadsStart?.({ userId: user.id, gameId, licenseId });
    if (!r?.ok) {
      toast.error(r?.error ?? 'Falló al iniciar');
      setProgreso(null);
    }
  }

  // Estados
  if (installPath) {
    return (
      <div className="card p-3 mb-3 border-green-500/40 bg-green-500/8 flex items-center gap-3">
        <Check className="text-green-400 shrink-0" size={18} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Instalado</div>
          <div className="text-[11px] text-fg-muted truncate">{installPath}</div>
        </div>
        <button className="btn btn-primary text-xs">
          <FolderOpen size={12} /> Abrir carpeta
        </button>
      </div>
    );
  }

  if (progreso && progreso.estado !== 'completado' && progreso.estado !== 'error') {
    const pct = progreso.porcentaje;
    const mb = (b: number) => (b / 1024 / 1024).toFixed(1);
    return (
      <div className="card p-3 mb-3 border-cyan-500/40 bg-cyan-500/8">
        <div className="flex items-center gap-2 mb-2 text-sm">
          {progreso.estado === 'extrayendo' ? (
            <><Loader2 size={14} className="animate-spin text-purple-400" /> Extrayendo…</>
          ) : (
            <><Loader2 size={14} className="animate-spin text-cyan-400" /> Descargando {pct}%</>
          )}
        </div>
        <div className="h-2 bg-bg-elev rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progreso.bytes_total > 0 && (
          <div className="text-[11px] text-fg-muted">
            {mb(progreso.bytes_descargados)} MB / {mb(progreso.bytes_total)} MB
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={iniciar}
      disabled={!downloadUrl || !licenseId}
      className="btn btn-primary w-full mb-3 flex items-center justify-center gap-2 disabled:opacity-50"
      title={!downloadUrl ? 'El admin debe subir el .zip primero' : !licenseId ? 'Sin licencia' : 'Descargar e instalar'}
    >
      <Download size={14} />
      {downloadUrl ? 'Descargar juego' : 'Sin URL de descarga'}
    </button>
  );
}
