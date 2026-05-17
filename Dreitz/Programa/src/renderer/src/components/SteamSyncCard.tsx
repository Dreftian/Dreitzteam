import { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

interface DetectedRow { steam_app_id: number; title: string; install_dir: string; size_bytes: number; detected_at: string }

export default function SteamSyncCard() {
  const [list, setList] = useState<DetectedRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [info, setInfo] = useState<{ count: number; library_paths: string[]; steam_path: string | null } | null>(null);

  async function load() {
    setList(await window.api.steamList() as any);
  }

  useEffect(() => { load(); }, []);

  async function scan() {
    setScanning(true);
    try {
      const r = await window.api.steamScan() as any;
      setInfo(r);
      toast.success(`${r.count} juego${r.count === 1 ? '' : 's'} detectado${r.count === 1 ? '' : 's'} en Steam`);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setScanning(false); }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-sm flex items-center gap-2">Sincronizar con Steam</div>
          {info?.steam_path && <div className="text-[11px] text-fg-subtle truncate">Steam en: <code>{info.steam_path}</code></div>}
          {info && info.library_paths.length > 0 && (
            <div className="text-[11px] text-fg-subtle">Bibliotecas: {info.library_paths.length}</div>
          )}
        </div>
        <button onClick={scan} disabled={scanning} className="btn btn-secondary text-xs">
          {scanning ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
          {scanning ? 'Escaneando…' : 'Escanear'}
        </button>
      </div>
      {!list.length ? (
        <div className="text-xs text-fg-muted">
          Pulsa <b>Escanear</b> para detectar tus juegos ya instalados de Steam. Cuando un juego en tu biblioteca de Dreitz coincida con uno detectado, lo marcaremos automáticamente como "instalado".
        </div>
      ) : (
        <div className="text-xs text-fg-muted">
          <div className="mb-2">{list.length} juego{list.length === 1 ? '' : 's'} detectado{list.length === 1 ? '' : 's'} en Steam:</div>
          <div className="grid sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto thin-scrollbar pr-2">
            {list.map((g) => (
              <div key={g.steam_app_id} className="flex items-center gap-2 text-[11px] py-0.5">
                <code className="text-accent">#{g.steam_app_id}</code>
                <span className="truncate">{g.title}</span>
                {g.size_bytes > 0 && <span className="text-fg-subtle ml-auto shrink-0">{(g.size_bytes / 1024 ** 3).toFixed(1)} GB</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
