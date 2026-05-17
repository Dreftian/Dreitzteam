import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, AlertCircle, Gift, ShieldQuestion } from 'lucide-react';

const RECOVERY_QUESTION_SUGGESTIONS = [
  '¿Cómo se llamaba tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es tu apodo de la infancia?',
  '¿Cuál es tu juego favorito de toda la vida?',
  '¿Nombre de tu mejor amigo de la infancia?'
];

export default function Register() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [refCode, setRefCode] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState(RECOVERY_QUESTION_SUGGESTIONS[0]);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    if (recoveryAnswer && recoveryAnswer.length < 3) return setError('La respuesta de seguridad debe tener al menos 3 caracteres');
    setLoading(true);
    try {
      await register(username, email, password, refCode || undefined);
      // Si el usuario llenó la pregunta de seguridad, la guardamos. El register() ya guardó
      // el user en localStorage como 'dreitz.userId'; lo recuperamos para tener el id.
      if (recoveryAnswer.trim()) {
        const newId = localStorage.getItem('dreitz.userId');
        if (newId) {
          try {
            await window.api.recoverySet({ userId: parseInt(newId, 10), question: recoveryQuestion, answer: recoveryAnswer.trim() });
          } catch {
            // si falla, no bloqueamos el registro — el usuario puede setear esto luego en Settings
          }
        }
      }
      nav('/store', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  void user;

  return (
    <div className="h-full flex">
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden hero-gradient items-center justify-center">
        <div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{ backgroundImage: 'url(https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_hero.jpg)' }} />
        <div className="relative z-10 text-center px-12 max-w-lg">
          <h1 className="text-5xl font-extrabold mb-3 leading-none shimmer-text">Únete a Dreitz</h1>
          <p className="text-white/80 leading-relaxed">
            Crea tu cuenta gratis y empieza a construir tu biblioteca de juegos. Si te invitó un amigo, ingresa su código y ambos ganan puntos.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <form onSubmit={submit} className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-1">Crear cuenta</h2>
          <p className="text-fg-muted mb-8 text-sm">Regístrate para acceder a la tienda.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <label className="block text-xs font-semibold text-fg-muted mb-1.5">Usuario</label>
          <input className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="tu_usuario" autoFocus />

          <label className="block text-xs font-semibold text-fg-muted mb-1.5">Email</label>
          <input className="input mb-4" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />

          <label className="block text-xs font-semibold text-fg-muted mb-1.5">Contraseña</label>
          <input className="input mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 4 caracteres" />

          <label className="block text-xs font-semibold text-fg-muted mb-1.5">Confirmar contraseña</label>
          <input className="input mb-4" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repite la contraseña" />

          <label className="block text-xs font-semibold text-fg-muted mb-1.5 flex items-center gap-1">
            <Gift size={12} className="text-pink-400" /> Código de referido (opcional)
          </label>
          <input
            className="input mb-6 font-mono uppercase"
            value={refCode}
            onChange={(e) => setRefCode(e.target.value.toUpperCase())}
            placeholder="ABC-XXXXXX"
          />

          <div className="card p-4 bg-bg-elev border-cyan-500/20 mb-6">
            <div className="flex items-center gap-2 mb-2 text-cyan-300">
              <ShieldQuestion size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Pregunta de seguridad (opcional pero recomendado)</span>
            </div>
            <p className="text-[11px] text-fg-subtle mb-3">
              Sirve para recuperar tu cuenta si olvidas la contraseña. Sin esto, sólo el admin podrá resetearte.
            </p>
            <select
              className="input mb-3"
              value={recoveryQuestion}
              onChange={(e) => setRecoveryQuestion(e.target.value)}
            >
              {RECOVERY_QUESTION_SUGGESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <input
              className="input"
              value={recoveryAnswer}
              onChange={(e) => setRecoveryAnswer(e.target.value)}
              placeholder="Tu respuesta (algo que recuerdes fácil)"
            />
          </div>

          <button disabled={loading} type="submit" className="btn btn-primary w-full mb-4">
            <UserPlus size={16} />
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-fg-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-accent hover:underline font-semibold">Iniciar sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
