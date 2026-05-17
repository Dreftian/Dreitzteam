import { useEffect, useRef, useState } from 'react';
import { Wallet, CheckCircle2, Upload, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface Config {
  culqi: { public_key: string; private_key_set: boolean };
  paypal: { client_id: string; client_secret_set: boolean; env: 'sandbox' | 'live' };
  yape: { qr_image_data: string; recipient_name: string; recipient_phone: string };
  anthropic: { api_key_set: boolean };
}

export default function PaymentsAdmin() {
  const { admin } = useAuth();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inputs (vacíos = no cambiar; permitir actualizar parcialmente)
  const [culqiPub, setCulqiPub] = useState('');
  const [culqiPriv, setCulqiPriv] = useState('');
  const [paypalCid, setPaypalCid] = useState('');
  const [paypalCs, setPaypalCs] = useState('');
  const [paypalEnv, setPaypalEnv] = useState<'sandbox' | 'live'>('sandbox');
  const [yapeName, setYapeName] = useState('');
  const [yapePhone, setYapePhone] = useState('');
  const [yapeQr, setYapeQr] = useState<string | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');

  const qrInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const c: Config = await window.api.paymentsAdminGet();
    setCfg(c);
    setCulqiPub(c.culqi.public_key);
    setPaypalCid(c.paypal.client_id);
    setPaypalEnv(c.paypal.env);
    setYapeName(c.yape.recipient_name);
    setYapePhone(c.yape.recipient_phone);
    setYapeQr(c.yape.qr_image_data || null);
  }

  useEffect(() => { load(); }, []);

  function onQrPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('La imagen del QR pesa más de 1.5 MB — comprímela.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setYapeQr(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      const setIf = (k: string, v: string | null) => {
        if (v !== '' && v !== null && v !== undefined) payload[k] = v;
      };
      // Solo enviar campos que el admin tocó (no sobreescribir con cadena vacía).
      if (culqiPub !== cfg?.culqi.public_key) setIf('payments.culqi.public_key', culqiPub);
      if (culqiPriv) setIf('payments.culqi.private_key', culqiPriv);
      if (paypalCid !== cfg?.paypal.client_id) setIf('payments.paypal.client_id', paypalCid);
      if (paypalCs) setIf('payments.paypal.client_secret', paypalCs);
      if (paypalEnv !== cfg?.paypal.env) payload['payments.paypal.env'] = paypalEnv;
      if (yapeName !== cfg?.yape.recipient_name) payload['yape.recipient_name'] = yapeName;
      if (yapePhone !== cfg?.yape.recipient_phone) payload['yape.recipient_phone'] = yapePhone;
      if (yapeQr && yapeQr !== cfg?.yape.qr_image_data) payload['yape.qr_image_data'] = yapeQr;
      if (anthropicKey) setIf('anthropic.api_key', anthropicKey);

      if (Object.keys(payload).length === 0) {
        toast.info('No hay cambios para guardar.');
        return;
      }
      await window.api.paymentsAdminSet(payload);
      toast.success('Configuración de pagos guardada.');
      setCulqiPriv('');
      setPaypalCs('');
      setAnthropicKey('');
      await load();
    } catch (e) {
      toast.error('Error: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) return <div className="p-8 text-fg-muted">Cargando configuración…</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <Wallet className="text-purple-400" size={28} />
        <h2 className="text-3xl font-bold">Pagos</h2>
      </div>
      <p className="text-fg-muted text-sm">
        Configura las pasarelas y el QR de Yape. Sólo guardamos las claves localmente en {`%APPDATA%\\Dreitzteam\\dreitzteam.db`}.
      </p>

      <div className="flex justify-end">
        <button onClick={() => setShowSecrets((v) => !v)} className="text-sm text-fg-muted hover:text-fg flex items-center gap-1.5">
          {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
          {showSecrets ? 'Ocultar' : 'Mostrar'} secretos
        </button>
      </div>

      {/* YAPE */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xl font-bold">Yape</h3>
          {cfg.yape.qr_image_data && cfg.yape.recipient_name && (
            <CheckCircle2 size={18} className="text-green-400" />
          )}
        </div>
        <p className="text-xs text-fg-muted mb-4">
          Sube tu QR personal de Yape y tu nombre completo (el que aparece como destinatario en los comprobantes).
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-semibold text-fg-muted mb-2 block">QR de Yape</span>
            <input type="file" accept="image/*" className="hidden" ref={qrInputRef} onChange={onQrPick} />
            <div
              onClick={() => qrInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:bg-bg-hover transition-colors min-h-[200px] flex items-center justify-center"
            >
              {yapeQr ? (
                <img src={yapeQr} alt="QR Yape" className="max-h-48 rounded" />
              ) : (
                <div>
                  <Upload size={20} className="mx-auto mb-1.5 text-fg-muted" />
                  <div className="text-sm">Subir QR (PNG/JPG · máx 1.5 MB)</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-fg-muted mb-1 block">Nombre destinatario</span>
              <input
                value={yapeName}
                onChange={(e) => setYapeName(e.target.value)}
                placeholder="Ej. Juan Pérez Gonzales"
                className="input w-full"
              />
              <p className="text-[11px] text-fg-subtle mt-1">
                Exactamente como aparece en tus comprobantes (la IA lo usa para verificar).
              </p>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-fg-muted mb-1 block">Celular Yape (opcional)</span>
              <input
                value={yapePhone}
                onChange={(e) => setYapePhone(e.target.value)}
                placeholder="9XX-XXX-XXX"
                className="input w-full"
              />
            </label>
          </div>
        </div>
      </section>

      {/* ANTHROPIC */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xl font-bold">Verificación con IA</h3>
          {cfg.anthropic.api_key_set && <CheckCircle2 size={18} className="text-green-400" />}
        </div>
        <p className="text-xs text-fg-muted mb-4">
          API key de Anthropic — necesaria para que la IA verifique los comprobantes Yape automáticamente. Sin ella, los pagos por Yape se rechazan o quedan pendientes para tu aprobación manual.
        </p>
        <p className="text-[11px] text-fg-subtle mb-2">
          Obtén tu key en <a href="https://console.anthropic.com" target="_blank" className="text-accent hover:underline">console.anthropic.com</a> · pricing ~$0.0005 por verificación con Haiku
        </p>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder={cfg.anthropic.api_key_set ? '••••••••••••••••••••• (configurada)' : 'sk-ant-api03-...'}
          className="input w-full font-mono text-xs"
        />
      </section>

      {/* CULQI */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xl font-bold">Culqi (tarjeta)</h3>
          {cfg.culqi.private_key_set && <CheckCircle2 size={18} className="text-green-400" />}
        </div>
        <p className="text-xs text-fg-muted mb-4">
          Pasarela peruana del BCP. Comisión 3.99% + S/.0.30 · depósito a tu cuenta peruana en 1–2 días. <a href="https://culqi.com" target="_blank" className="text-accent hover:underline">culqi.com</a> → Panel → Configuración → API Keys.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-fg-muted mb-1 block">Public key (pk_*)</span>
            <input
              value={culqiPub}
              onChange={(e) => setCulqiPub(e.target.value)}
              placeholder="pk_test_..."
              className="input w-full font-mono text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-fg-muted mb-1 block">Private key (sk_*)</span>
            <input
              type={showSecrets ? 'text' : 'password'}
              value={culqiPriv}
              onChange={(e) => setCulqiPriv(e.target.value)}
              placeholder={cfg.culqi.private_key_set ? '••••••••• (configurada)' : 'sk_test_...'}
              className="input w-full font-mono text-xs"
            />
          </label>
        </div>
      </section>

      {/* PAYPAL */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xl font-bold">PayPal</h3>
          {cfg.paypal.client_secret_set && <CheckCircle2 size={18} className="text-green-400" />}
        </div>
        <p className="text-xs text-fg-muted mb-4">
          PayPal Business · <a href="https://developer.paypal.com" target="_blank" className="text-accent hover:underline">developer.paypal.com</a>.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="block md:col-span-1">
            <span className="text-xs font-semibold text-fg-muted mb-1 block">Entorno</span>
            <select value={paypalEnv} onChange={(e) => setPaypalEnv(e.target.value as any)} className="input w-full">
              <option value="sandbox">Sandbox</option>
              <option value="live">Live (producción)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-fg-muted mb-1 block">Client ID</span>
            <input
              value={paypalCid}
              onChange={(e) => setPaypalCid(e.target.value)}
              className="input w-full font-mono text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-fg-muted mb-1 block">Client secret</span>
            <input
              type={showSecrets ? 'text' : 'password'}
              value={paypalCs}
              onChange={(e) => setPaypalCs(e.target.value)}
              placeholder={cfg.paypal.client_secret_set ? '••••••••• (configurado)' : ''}
              className="input w-full font-mono text-xs"
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end gap-2 sticky bottom-4 z-10">
        <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2 shadow-lg">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <YapeReceiptsTable adminId={admin?.id} />
    </div>
  );
}

function YapeReceiptsTable({ adminId }: { adminId?: number }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'rejected' | 'verified'>('all');

  async function load() {
    const r: any[] = await window.api.yapeReceiptsList(filter === 'all' ? undefined : { status: filter });
    setRows(r);
  }
  useEffect(() => { load(); }, [filter]);

  async function decide(id: number, approve: boolean) {
    const note = prompt(approve ? 'Nota (opcional):' : 'Motivo del rechazo:') ?? '';
    await window.api.yapeReceiptsDecide({ id, approve, adminId, note });
    toast.success(approve ? 'Comprobante aprobado' : 'Comprobante rechazado');
    await load();
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Sparkles size={18} className="text-cyan-400" /> Comprobantes Yape
        </h3>
        <div className="flex gap-1">
          {(['all', 'verified', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2 py-1 rounded text-xs ${filter === s ? 'bg-accent text-white' : 'bg-bg-hover text-fg-muted hover:text-fg'}`}
            >
              {s === 'all' ? 'Todos' : s === 'verified' ? 'OK' : 'Rechazados'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-fg-muted mb-4">
        Aquí ves todos los comprobantes Yape que la IA procesó. Si rechazó uno por error, puedes aprobarlo manualmente.
      </p>

      {!rows ? (
        <div className="text-fg-muted text-sm">Cargando…</div>
      ) : !rows.length ? (
        <div className="text-fg-muted text-sm">Sin comprobantes para mostrar.</div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="border border-border rounded-md p-3 flex gap-3">
              <img src={r.image_data} alt="comprobante" className="w-32 h-32 object-cover rounded shrink-0" />
              <div className="flex-1 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.verify_status === 'verified' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {r.verify_status}
                  </span>
                  <span className="text-fg-muted">{r.username}</span>
                  <span className="text-fg-subtle">·</span>
                  <span className="font-semibold">S/. {r.amount}</span>
                  <span className="text-fg-subtle">·</span>
                  <span className="text-fg-subtle">{new Date(r.created_at).toLocaleString('es-PE')}</span>
                </div>
                <div className="text-fg-muted">
                  IA vio: monto {r.verify_amount_seen ?? '—'} · destinatario "{r.verify_recipient_seen || '—'}" · conf {r.verify_confidence}
                </div>
                {r.verify_issues && JSON.parse(r.verify_issues).length > 0 && (
                  <div className="text-yellow-400 text-[11px] flex items-start gap-1">
                    <AlertCircle size={11} className="mt-0.5 shrink-0" />
                    {JSON.parse(r.verify_issues).join(' · ')}
                  </div>
                )}
                {r.admin_decision && (
                  <div className="text-fg-subtle italic">Decisión admin: {r.admin_decision}</div>
                )}
              </div>
              {!r.admin_decision && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => decide(r.id, true)} className="btn btn-primary text-xs px-3">Aprobar</button>
                  <button onClick={() => decide(r.id, false)} className="btn text-xs px-3">Rechazar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
