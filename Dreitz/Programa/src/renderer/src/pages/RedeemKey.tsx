import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key as KeyIcon, CheckCircle2, AlertCircle, Loader2, Gamepad2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { play } from '../lib/sounds';

/**
 * Pantalla "Activar producto" estilo Steam.
 * El usuario pega una clave DRZ-XXXXX y, si es válida, el juego entra en
 * su biblioteca. Si ya tiene el juego, se le redirige a Library.
 */
export default function RedeemKey() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ game: any; alreadyOwned: boolean } | null>(null);

  /** Auto-formatea mientras se escribe: agrupa de 5 en 5 con guiones, mayúsculas */
  function formatCode(raw: string): string {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    // Si arranca con DRZ, lo dejamos como prefijo
    if (cleaned.startsWith('DRZ')) {
      const rest = cleaned.slice(3);
      const grouped = rest.match(/.{1,5}/g)?.join('-') ?? '';
      return grouped ? `DRZ-${grouped}` : 'DRZ';
    }
    const grouped = cleaned.match(/.{1,5}/g)?.join('-') ?? '';
    return grouped;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await window.api.redeemFromCode({ userId: user.id, code });
      play(res.alreadyOwned ? 'notify' : 'achievement');
      setSuccess({ game: res.game, alreadyOwned: res.alreadyOwned });
    } catch (err) {
      play('error');
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="w-20 h-20 rounded-full bg-green-500/15 text-green-400 mx-auto mb-5 flex items-center justify-center"
          >
            <CheckCircle2 size={44} />
          </motion.div>

          <h2 className="text-2xl font-bold mb-2">
            {success.alreadyOwned ? 'Ya tenías este juego' : '¡Clave activada!'}
          </h2>
          <p className="text-fg-muted mb-6">
            <span className="font-semibold text-fg">{success.game.title}</span> está en tu biblioteca.
          </p>

          {success.game.header_image && (
            <img
              src={success.game.header_image}
              alt=""
              className="w-full rounded-lg mb-6 shadow-xl"
            />
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => nav(`/library`)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Gamepad2 size={16} /> Ir a Biblioteca <ArrowRight size={14} />
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                setCode('');
              }}
              className="btn"
            >
              Activar otra clave
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <KeyIcon className="text-cyan-400" size={28} />
        <h2 className="text-3xl font-bold">Activar producto</h2>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Pega una clave DRZ que recibiste para añadir el juego a tu biblioteca.
      </p>

      <form onSubmit={submit} className="card p-6 space-y-5">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-fg-muted mb-2 block">
            Clave de activación
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            placeholder="DRZ-XXXXX-XXXXX-XXXXX-XXXXX"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="input w-full font-mono text-lg tracking-wider text-center"
          />
        </label>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 text-red-300 text-sm"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={!code || submitting}
          className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Activando…' : 'Activar y añadir a biblioteca'}
        </button>

        <p className="text-xs text-fg-subtle text-center">
          ¿No tienes una clave? <Link to="/store" className="text-accent hover:underline">Compra un juego en la tienda</Link>.
        </p>
      </form>

      <details className="mt-6 text-sm text-fg-muted">
        <summary className="cursor-pointer hover:text-fg">¿De dónde sacas una clave?</summary>
        <ul className="mt-3 space-y-2 pl-4 list-disc">
          <li>Te la envió el administrador por WhatsApp después de pagar por Yape.</li>
          <li>La compraste en la tienda con tarjeta — en ese caso ya aparece automáticamente en tu biblioteca.</li>
          <li>Es un regalo de alguien que generó una clave en Keys.</li>
        </ul>
      </details>
    </div>
  );
}
