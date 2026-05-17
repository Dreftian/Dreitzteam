import { useEffect, useState } from 'react';
import { ExternalLink, Gamepad2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Badge "Ya lo tienes en Steam".
 *
 * Si el usuario tiene el juego instalado en Steam (detectado por
 * `appmanifest_*.acf` en steamapps), mostramos un banner verde con el
 * tamaño en disco y un botón "Jugar desde Steam" que lanza
 * `steam://rungameid/<appid>`. Esto evita que pague 2 veces y le da continuidad
 * a su biblioteca cruzada.
 */
export default function SteamOwnedBadge({ steamAppId }: { steamAppId?: number | null }) {
  const [status, setStatus] = useState<'loading' | 'owned' | 'not-owned'>('loading');
  const [info, setInfo] = useState<{ install_dir?: string; title?: string }>({});
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!steamAppId) { setStatus('not-owned'); return; }
    let cancelled = false;
    window.api.steamIsOwned?.(steamAppId)
      .then((r: any) => {
        if (cancelled) return;
        if (r?.owned) {
          setStatus('owned');
          setInfo({ install_dir: r.install_dir, title: r.title });
        } else {
          setStatus('not-owned');
        }
      })
      .catch(() => { if (!cancelled) setStatus('not-owned'); });
    return () => { cancelled = true; };
  }, [steamAppId]);

  if (status !== 'owned') return null;

  async function lanzar() {
    if (!steamAppId) return;
    setLaunching(true);
    try {
      const r: any = await window.api.steamLaunch?.(steamAppId);
      if (r?.ok) {
        toast.success('Steam abriendo el juego…');
      } else {
        toast.error(`No se pudo lanzar: ${r?.error ?? 'desconocido'}`);
      }
    } finally {
      setTimeout(() => setLaunching(false), 1500);
    }
  }

  return (
    <div className="card p-4 mb-4 border-green-500/40 bg-green-500/8 flex items-center gap-3">
      <div className="w-10 h-10 rounded-md bg-green-500/15 flex items-center justify-center shrink-0">
        <Check size={20} className="text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold">Ya lo tienes en Steam</span>
          <span className="text-[10px] uppercase tracking-wider text-green-400 font-semibold px-1.5 py-0.5 rounded bg-green-500/15">
            Instalado
          </span>
        </div>
        <div className="text-xs text-fg-muted truncate">
          {info.title ? <>Como <b className="text-fg">"{info.title}"</b></> : null}
          {info.install_dir ? <> · <span className="text-fg-subtle">{info.install_dir}</span></> : null}
        </div>
      </div>
      <button
        onClick={lanzar}
        disabled={launching}
        className="btn btn-primary text-sm flex items-center gap-2 shrink-0"
        title="Abrir el juego en Steam (steam://rungameid/...)"
      >
        {launching ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
        Jugar desde Steam
        <ExternalLink size={11} />
      </button>
    </div>
  );
}
