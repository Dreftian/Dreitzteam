import { useEffect, useState } from 'react';
import { Cloud, CheckCircle2, AlertCircle, Loader2, ExternalLink, UploadCloud, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/**
 * Pantalla de administración del backend remoto.
 *
 * Históricamente se llamaba "Supabase"; el proyecto migró a **InsForge** y los
 * defaults del backend ya vienen compilados — el admin normalmente no tiene
 * que tocar nada, solo pulsar "Sincronizar todo" la primera vez. Las claves
 * siguen siendo editables por si se cambia de proyecto.
 *
 * Nota técnica: los IPC `supabase*` se mantienen por compatibilidad pero
 * apuntan internamente al adapter de InsForge.
 */

interface Status {
  enabled: boolean;
  url: string;
  hasAnonKey: boolean;
  hasServiceRole: boolean;
}

export default function InsForgePage() {
  const { admin } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  async function load() {
    const s: Status = await window.api.supabaseStatus();
    setStatus(s);
    setUrl(s.url || '');
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const payload: any = {};
      if (url) payload.url = url.trim();
      if (apiKey) {
        payload.api_key = apiKey.trim();
        // Compatibilidad con la API antigua que esperaba estos nombres.
        payload.anon_key = apiKey.trim();
        payload.service_role = apiKey.trim();
      }
      const r: any = await window.api.supabaseSetCreds(payload);
      toast.success(r.enabled ? 'InsForge conectado · Keys ya puede escribir al catálogo' : 'Credenciales guardadas (faltan datos para conectar)');
      setApiKey('');
      await load();
    } catch (e) {
      toast.error('Error guardando: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pushAll() {
    setPushing(true);
    try {
      const stats: any = await window.api.supabasePushAll({ adminId: admin?.id });
      toast.success(`Push completo · ${stats.games} juegos, ${stats.promotions} promos, ${stats.flash_sales} flash`);
    } catch (e) {
      toast.error('Push falló: ' + (e as Error).message);
    } finally {
      setPushing(false);
    }
  }

  async function disable() {
    if (!confirm('¿Desconectar InsForge? Keys volverá a operar solo en local; Dreitz seguirá leyendo la última copia.')) return;
    await window.api.supabaseDisable();
    toast.success('InsForge desconectado');
    setUrl(''); setApiKey('');
    await load();
  }

  if (!status) return <div className="p-8 text-fg-muted">Cargando estado de InsForge…</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Cloud className="text-cyan-400" size={28} />
        <h2 className="text-3xl font-bold">InsForge</h2>
        <span className="text-[10px] uppercase tracking-widest text-fg-subtle font-semibold ml-1">Backend</span>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Sincroniza el catálogo (juegos, licencias, promociones) con InsForge. Keys escribe, Dreitz lee. Si está
        desconectado, todo sigue funcionando local en SQLite.
      </p>

      <div className={`card p-4 mb-6 flex items-center gap-3 ${status.enabled ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
        {status.enabled ? (
          <CheckCircle2 className="text-green-400 shrink-0" />
        ) : (
          <AlertCircle className="text-yellow-400 shrink-0" />
        )}
        <div className="flex-1">
          <div className="font-semibold">{status.enabled ? 'Conectado' : 'Desconectado'}</div>
          <div className="text-xs text-fg-muted">
            URL: {status.url || 'usando defaults compilados'}<br />
            API key del proyecto: {status.hasServiceRole ? 'configurada' : 'falta'}
          </div>
        </div>
      </div>

      <div className="card p-4 mb-6 bg-cyan-500/5 border-cyan-500/30 flex items-start gap-3">
        <Sparkles size={18} className="text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-xs text-fg-muted leading-relaxed">
          <b className="text-fg">Cero configuración:</b> el proyecto InsForge de Dreitzteam viene precompilado
          con la URL y la API key. Solo pulsa <i>"Sincronizar todo el catálogo ahora"</i> la primera vez para
          subir tu catálogo local. Si quieres usar un proyecto distinto, sobreescribe las credenciales abajo.
        </div>
      </div>

      <div className="card p-5 mb-6 space-y-4">
        <h3 className="font-bold">Credenciales (opcional)</h3>
        <p className="text-xs text-fg-muted">
          Sólo si quieres usar un proyecto distinto al default. Project Settings → API en tu dashboard de
          InsForge — copia el host (<code>https://&lt;app&gt;.&lt;region&gt;.insforge.app</code>) y la API key
          del proyecto.
        </p>

        <label className="block">
          <span className="text-xs text-fg-muted mb-1 block">Project Host</span>
          <input
            type="url"
            placeholder="https://f2i554x7.us-east.insforge.app"
            className="input w-full"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs text-fg-muted mb-1 block flex items-center gap-2">
            API key del proyecto
            <button onClick={() => setShowSecrets((v) => !v)} type="button" className="text-fg-subtle hover:text-fg-muted">
              {showSecrets ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </span>
          <input
            type={showSecrets ? 'text' : 'password'}
            placeholder={status.hasServiceRole ? '••••••••••••••••••••• (configurada)' : 'ik_...'}
            className="input w-full font-mono text-xs"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>

        <div className="flex gap-2 pt-2">
          <button onClick={save} disabled={saving} className="btn btn-primary text-sm flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar y reconectar
          </button>
          {status.enabled && (
            <button onClick={disable} className="btn text-sm">Desconectar</button>
          )}
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-bold mb-1">Sincronización inicial</h3>
        <p className="text-xs text-fg-muted mb-3">
          Sube TODO el catálogo de SQLite a InsForge. Usar la primera vez después de configurar las credenciales,
          o cuando reemplaces el proyecto remoto.
        </p>
        <button
          onClick={pushAll}
          disabled={!status.enabled || pushing}
          className="btn btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {pushing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          Sincronizar todo el catálogo ahora
        </button>
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-1">Setup paso a paso</h3>
        <ol className="text-sm text-fg-muted list-decimal pl-5 space-y-2">
          <li>El backend ya está creado en <a href="https://insforge.dev" target="_blank" className="text-accent inline-flex items-center gap-1">insforge.dev <ExternalLink size={11} /></a> con el schema completo aplicado.</li>
          <li>Pulsa "Sincronizar todo el catálogo ahora" para el push inicial.</li>
          <li>Desde ahora cada cambio en Keys (precios, stock, promos, licencias) sube automáticamente.</li>
          <li>Realtime: Dreitz escucha el canal <code className="text-accent">catalog:updates</code> y refresca en vivo.</li>
          <li>Si fallas la red, todo se cae graceful a SQLite local — no se pierde ningún dato.</li>
        </ol>
      </div>
    </div>
  );
}
