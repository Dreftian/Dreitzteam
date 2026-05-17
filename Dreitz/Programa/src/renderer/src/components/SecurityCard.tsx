import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertCircle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { play } from '../lib/sounds';

/**
 * Security card que reúne:
 *  - 2FA TOTP (escanea QR, ingresa código, activa)
 *  - Reset de la pregunta de seguridad
 *  - Cambio de contraseña (placeholder — pendiente de handler dedicado)
 *
 * Drop-in: <SecurityCard /> dentro de Settings.
 */
export default function SecurityCard() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [secret, setSecret] = useState<{ secret: string; uri: string } | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Recovery question state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);

  useEffect(() => {
    if (!user) return;
    window.api.twofaStatus(user.id).then((s) => setEnabled(s.enabled)).catch(() => {});
  }, [user?.id]);

  async function startSetup() {
    if (!user) return;
    setBusy(true);
    try {
      const s = await window.api.twofaGenerate(user.id);
      setSecret(s);
      setShowSetup(true);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function verifyAndEnable() {
    if (!user) return;
    setBusy(true);
    try {
      const r = await window.api.twofaVerifyAndEnable({ userId: user.id, token });
      if (r.enabled) {
        setEnabled(true);
        setShowSetup(false);
        setToken('');
        play('success');
        toast.success('2FA activado · guarda tu clave de respaldo en un lugar seguro');
      } else {
        play('error');
        toast.error('Código incorrecto, prueba de nuevo');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function disable2FA() {
    if (!user) return;
    if (!confirm('¿Desactivar 2FA? Tu cuenta será menos segura.')) return;
    try {
      await window.api.twofaDisable(user.id);
      setEnabled(false);
      toast.success('2FA desactivado');
    } catch (e) { toast.error((e as Error).message); }
  }

  async function saveRecoveryQuestion() {
    if (!user) return;
    if (!newQuestion.trim() || !newAnswer.trim()) return toast.error('Pregunta y respuesta requeridas');
    setSavingRecovery(true);
    try {
      await window.api.recoverySet({ userId: user.id, question: newQuestion.trim(), answer: newAnswer.trim() });
      toast.success('Pregunta de seguridad guardada');
      setNewQuestion(''); setNewAnswer('');
    } catch (e) { toast.error((e as Error).message); } finally { setSavingRecovery(false); }
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret.secret);
    setCopied(true);
    play('copy');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <Shield className="text-cyan-400" size={22} />
        <h3 className="text-xl font-bold">Seguridad</h3>
      </div>
      <p className="text-xs text-fg-muted mb-5">Protege tu cuenta con 2FA y configura tu pregunta de seguridad.</p>

      {/* 2FA */}
      <div className="border border-border rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-bold flex items-center gap-2">
              {enabled ? <ShieldCheck size={16} className="text-green-400" /> : <ShieldOff size={16} className="text-fg-muted" />}
              Autenticación de dos factores (2FA)
            </div>
            <p className="text-xs text-fg-muted mt-1">
              Requiere un código de 6 dígitos de una app authenticator (Google Authenticator, Authy, 1Password…) cada vez que inicies sesión.
            </p>
          </div>
          {enabled ? (
            <button onClick={disable2FA} className="btn text-sm shrink-0">Desactivar</button>
          ) : !showSetup ? (
            <button onClick={startSetup} disabled={busy} className="btn btn-primary text-sm shrink-0 flex items-center gap-2">
              {busy && <Loader2 size={12} className="animate-spin" />}
              Activar 2FA
            </button>
          ) : null}
        </div>

        {showSetup && secret && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-border pt-4 mt-3 space-y-3"
          >
            <div className="text-sm">
              <ol className="list-decimal pl-5 space-y-1 text-fg-muted">
                <li>Abre tu app authenticator (Google Authenticator, Authy, etc.)</li>
                <li>Escanea este QR o ingresa la clave manual:</li>
              </ol>
            </div>

            {/* QR via Google Charts API o api gratuita */}
            <div className="flex gap-4 items-start">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(secret.uri)}`}
                alt="2FA QR"
                className="rounded-md bg-white p-2"
                width={160}
                height={160}
              />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-1">Clave manual</div>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs font-mono bg-bg-elev p-2 rounded break-all">{secret.secret}</code>
                  <button onClick={copySecret} className="btn text-xs px-2" title="Copiar">
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-[11px] text-fg-subtle mt-2">
                  Guarda esta clave en un lugar seguro — si pierdes tu teléfono la necesitarás para recuperar acceso.
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
                className="input font-mono text-lg text-center tracking-widest"
                maxLength={6}
              />
            </label>
            <div className="flex gap-2">
              <button onClick={() => { setShowSetup(false); setSecret(null); setToken(''); }} className="btn text-sm flex-1">Cancelar</button>
              <button onClick={verifyAndEnable} disabled={busy || token.length !== 6} className="btn btn-primary text-sm flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {busy && <Loader2 size={12} className="animate-spin" />}
                Verificar y activar
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Pregunta de seguridad */}
      <div className="border border-border rounded-lg p-4">
        <div className="font-bold flex items-center gap-2 mb-2">
          <KeyRound size={16} className="text-purple-400" />
          Pregunta de seguridad
        </div>
        <p className="text-xs text-fg-muted mb-3">
          Te permite recuperar tu contraseña sin pedirle ayuda al admin. La respuesta se guarda hasheada (nunca en texto plano).
        </p>
        <input
          className="input mb-2"
          placeholder="Pregunta (ej. ¿Cómo se llamaba tu primera mascota?)"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
        />
        <input
          className="input mb-3"
          placeholder="Respuesta (al menos 3 caracteres)"
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
        />
        <button onClick={saveRecoveryQuestion} disabled={savingRecovery || !newQuestion || !newAnswer} className="btn text-sm disabled:opacity-50">
          {savingRecovery ? 'Guardando…' : 'Guardar pregunta'}
        </button>
      </div>
    </div>
  );
}
