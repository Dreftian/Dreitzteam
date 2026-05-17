import { useEffect, useState } from 'react';
import { Puzzle, FolderOpen, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Plugin {
  slug: string;
  name: string;
  version: string | null;
  author: string | null;
  enabled: boolean;
  hasCss: boolean;
}

export default function Plugins() {
  const [list, setList] = useState<Plugin[]>([]);

  async function load() {
    setList(await window.api.pluginsList());
  }

  useEffect(() => { load(); }, []);

  async function toggle(p: Plugin) {
    await window.api.pluginsSetEnabled({ slug: p.slug, enabled: !p.enabled });
    toast.success(p.enabled ? `${p.name} desactivado` : `${p.name} activado`);
    await load();
    // Reload CSS
    const css = await window.api.pluginsEnabledCss();
    let style = document.getElementById('dreitz-plugin-css') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'dreitz-plugin-css';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  async function openFolder() {
    await window.api.pluginsOpenFolder();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Puzzle className="text-purple-400" size={28} />
        <h2 className="text-3xl font-bold">Plugins</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">Personaliza Dreitz con CSS de la comunidad.</p>

      <div className="card p-4 mb-6 bg-cyan-500/5 border-cyan-500/30">
        <div className="font-bold mb-1 text-sm">¿Cómo crear un plugin?</div>
        <ol className="text-xs text-fg-muted space-y-1 list-decimal pl-5 mb-3">
          <li>Abre la carpeta de plugins (botón debajo).</li>
          <li>Crea una subcarpeta nueva, ej. <code className="text-accent">mi-skin</code>.</li>
          <li>Dentro coloca un archivo <code className="text-accent">plugin.json</code> con: <code className="block bg-bg-hover px-2 py-1 rounded mt-1 text-[11px]">{`{ "slug": "mi-skin", "name": "Mi skin", "version": "1.0.0", "author": "Tú", "css": "style.css" }`}</code></li>
          <li>Crea <code className="text-accent">style.css</code> con tus reglas (ej. cambia <code className="text-accent">--accent</code> en <code className="text-accent">:root</code>).</li>
          <li>Vuelve aquí y activa el plugin.</li>
        </ol>
        <button onClick={openFolder} className="btn btn-secondary text-xs">
          <FolderOpen size={13} /> Abrir carpeta de plugins
        </button>
      </div>

      <div className="card divide-y divide-border">
        {!list.length ? (
          <div className="p-10 text-center text-fg-muted">No hay plugins instalados.</div>
        ) : (
          list.map((p) => (
            <div key={p.slug} className="p-4 flex items-center gap-4">
              <Puzzle className="text-purple-400" size={20} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {p.name}
                  {p.version && <span className="text-[10px] text-fg-subtle font-normal">v{p.version}</span>}
                </div>
                <div className="text-[11px] text-fg-subtle">
                  {p.author ?? 'Anónimo'} · {p.hasCss ? 'CSS detectado' : 'sin CSS'} · slug: <code className="text-accent">{p.slug}</code>
                </div>
              </div>
              <button
                onClick={() => toggle(p)}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors ${p.enabled ? 'bg-accent' : 'bg-bg-hover border border-border'}`}
              >
                <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${p.enabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
