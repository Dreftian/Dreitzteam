import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldQuestion, ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { play } from '../lib/sounds';

/**
 * Reset de contraseña via pregunta de seguridad (offline, sin SMTP).
 *
 * Pasos:
 *   1. Username → look up question
 *   2. Question + answer + new password → reset
 *   3. Success → redirect to login
 */
export default function ResetPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState<'username' | 'answer' | 'done'>('username');
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookupQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const q = await window.api.recoveryGetQuestion(username);
      if (!q) throw new Error('Este usuario no tiene pregunta de seguridad configurada. Contacta al admin (WhatsApp +51 904 957 354).');
      setQuestion(q);
      setStep('answer');
    } catch (err) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Las contraseñas no coinciden');
    if (newPassword.length < 4) return setError('Mínimo 4 caracteres');
    setLoading(true);
    try {
      await window.api.recoveryReset({ username, answer, newPassword });
      play('success');
      setStep('done');
    } catch (err) {
      play('error');
      setError((err as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/login" className="text-fg-muted hover:text-fg flex items-center gap-2 mb-6 text-sm">
          <ArrowLeft size={15} /> Volver al login
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <ShieldQuestion className="text-cyan-400" size={28} />
          <h2 className="text-3xl font-bold">Recuperar contraseña</h2>
        </div>
        <p className="text-fg-muted text-sm mb-6">
          {step === 'username' && 'Ingresa tu usuario para responder tu pregunta de seguridad.'}
          {step === 'answer' && 'Responde tu pregunta y elige una nueva contraseña.'}
          {step === 'done' && '¡Listo! Ya puedes iniciar sesión con tu nueva contraseña.'}
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'username' && (
          <form onSubmit={lookupQuestion}>
            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Usuario</label>
            <input className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <button disabled={loading || !username} className="btn btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Continuar
            </button>
          </form>
        )}

        {step === 'answer' && (
          <form onSubmit={reset}>
            <div className="card p-3 mb-4 bg-cyan-500/10 border-cyan-500/30 text-sm">
              <div className="text-xs uppercase text-fg-subtle mb-1">Tu pregunta</div>
              <div className="font-semibold">{question}</div>
            </div>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Tu respuesta</label>
            <input className="input mb-4" value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus placeholder="Responde tal como la registraste" />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Nueva contraseña</label>
            <input className="input mb-4" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Repite la contraseña</label>
            <input className="input mb-6" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />

            <button disabled={loading || !answer || !newPassword} className="btn btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Restablecer contraseña
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-20 h-20 rounded-full bg-green-500/15 text-green-400 mx-auto mb-4 flex items-center justify-center"
            >
              <CheckCircle2 size={44} />
            </motion.div>
            <button onClick={() => nav('/login')} className="btn btn-primary">Ir al login</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
