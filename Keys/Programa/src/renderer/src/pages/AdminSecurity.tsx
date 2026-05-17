import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/**
 * 2FA TOTP setup para admin. Después de activar 2FA, todo login admin
 * pedirá un código de 6 dígitos antes de entrar.
 */
export default function AdminSecurity() {
  const { admin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState<{ secret: string; uri: string } | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!admin) return;
    window.api.adminTwofaStatus(admin.id).then((s: any) => setEnabled(s.enabled));
  }, [admin?.id]);

  async function startSetup() {
    if (!admin) return;
    setBusy(true);
    try {
      const s = await window.api.adminTwofaGenerate(admin.id);
      setSecret(s);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!admin) return;
    setBusy(true);
    try {
      const r: any = await window.api.adminTwofaVerifyAndEnable({ userId: admin.id, token });
      if (r.enabled) {
        setEnabled(true);
        setSecret(null);
        setToken('');
        toast.success('2FA activado. La próxima vez que inicies sesión te pedirá el código.');
      } else {
        toast.error('Código incorrecto');
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function disable() {
    if (!admin) return;
    if (!password) return toast.error('Necesitas confirmar tu contraseña para desactivar 2FA');
    try {
      await window.api.adminTwofaDisable({ userId: admin.id, password });
      setEnabled(false);
      setPassword('');
      toast.success('2FA desactivado');
    } catch (e) { toast.error((e as Error).message); }
  }

  function copy() {
    if (!secret) return;
    navigator.clipboard.writeText(secret.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Shield className="text-cyan-400" size={28} />
        <h2 className="text-3xl font-bold">Seguridad admin</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Activa 2FA con app authenticator (Google Authenticator, Authy, 1Password, Microsoft Authenticator…).
      </p>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="font-bold flex items-center gap-2 text-lg">
              {enabled ? <ShieldCheck className="text-green-400" size={20} /> : <ShieldOff size={20} className="text-fg-muted" />}
              2FA {enabled ? 'activado' : 'desactivado'}
            </div>
            <p className="text-xs text-fg-muted mt-1">
              {enabled
                ? 'Tu sesión está protegida. Cada login te pedirá un código de 6 dígitos.'
                : 'Tu cuenta admin sólo está protegida por contraseña.'}
            </p>
          </div>
          {!enabled && !secret && (
            <button onClick={startSetup} disabled={busy} className="btn btn-primary flex items-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin" />}
              Activar 2FA
            </button>
          )}
        </div>

        {!enabled && secret && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-border pt-4 space-y-4">
            <div>
              <ol className="text-sm text-fg-muted list-decimal pl-5 space-y-1.5 mb-3">
                <li>Abre tu app authenticator</li>
                <li>Escanea este QR <strong>o</strong> ingresa la clave manualmente</li>
                <li>Pega el código de 6 dígitos abajo y verifica</li>
              </ol>
            </div>

            <div className="flex gap-4 items-start">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(secret.uri)}`}
                alt="2FA QR"
                className="rounded-md bg-white p-2"
                width={180} height={180}
              />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-1">Clave manual (guárdala como backup)</div>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs font-mono bg-bg-elev p-2 rounded break-all">{secret.secret}</code>
                  <button onClick={copy} className="btn text-xs px-2">
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-[11px] text-yellow-300/80 mt-3">
                  ⚠ Si pierdes tu teléfono y no tienes esta clave, perderás acceso de admin para siempre. Guárdala en un gestor de contraseñas.
                </p>
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-fg-muted mb-1.5 block">Código de verificación</span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                className="input font-mono text-lg text-center tracking-widest"
              />
            </label>

            <div className="flex gap-2">
              <button onClick={() => { setSecret(null); setToken(''); }} className="btn flex-1">Cancelar</button>
              <button onClick={verify} disabled={busy || token.length !== 6} className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {busy && <Loader2 size={12} className="animate-spin" />}
                Verificar y activar
              </button>
            </div>
          </motion.div>
        )}

        {enabled && (
          <div className="border-t border-border pt-4">
            <p className="text-sm text-fg-muted mb-3">
              Para desactivar 2FA, confirma tu contraseña:
            </p>
            <input
              type="password"
              placeholder="Tu contraseña actual"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mb-3"
            />
            <button onClick={disable} disabled={!password} className="btn text-sm disabled:opacity-50">
              Desactivar 2FA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
