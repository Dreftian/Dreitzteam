import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import Cinemagraph from '../components/Cinemagraph';

const REMEMBER_KEY = 'dreitz.login.credentials';

function readRememberedCredentials() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string; password?: string };
    if (typeof parsed.username !== 'string' || typeof parsed.password !== 'string') return null;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

function saveRememberedCredentials(username: string, password: string, remember: boolean) {
  if (!remember) {
    localStorage.removeItem(REMEMBER_KEY);
    return;
  }
  localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
}

export default function Login() {
  const { login, verifyTotp } = useAuth();
  const nav = useNavigate();
  const [initialCredentials] = useState(readRememberedCredentials);
  const [username, setUsername] = useState(initialCredentials?.username ?? '');
  const [password, setPassword] = useState(initialCredentials?.password ?? '');
  const [rememberCredentials, setRememberCredentials] = useState(Boolean(initialCredentials));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpStep, setTotpStep] = useState<{ userId: number } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanUsername = username.trim();
      const r = await login(cleanUsername, password);
      saveRememberedCredentials(cleanUsername, password, rememberCredentials);
      if (r && r.requiresTotp) {
        setTotpStep({ userId: r.userId! });
        setLoading(false);
        return;
      }
      nav('/store', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitTotp(e: FormEvent) {
    e.preventDefault();
    if (!totpStep) return;
    setError('');
    setLoading(true);
    try {
      await verifyTotp(totpStep.userId, totpCode);
      nav('/store', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex">
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden items-center justify-center">
        <Cinemagraph variant="aurora" className="absolute inset-0" />
        <div className="relative z-10 text-center px-12 max-w-lg">
          <Logo size="xl" layout="vertical" showTagline animated className="mx-auto mb-6" />
          <p className="text-white/80 text-lg leading-relaxed mt-4">
            La nueva forma de descubrir y comprar tus juegos favoritos. Catalogo curado, precios reales, biblioteca personal.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-10">
            <div className="card p-4 pro-glass">
              <div className="text-2xl font-bold shimmer-text">+1000</div>
              <div className="text-xs text-white/70">Titulos</div>
            </div>
            <div className="card p-4 pro-glass">
              <div className="text-2xl font-bold shimmer-text">24/7</div>
              <div className="text-xs text-white/70">Soporte</div>
            </div>
            <div className="card p-4 pro-glass">
              <div className="text-2xl font-bold shimmer-text">PRO</div>
              <div className="text-xs text-white/70">Beneficios</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        {totpStep ? (
          <form onSubmit={submitTotp} className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="text-cyan-400" size={28} />
              <h2 className="text-3xl font-bold">Verificacion 2FA</h2>
            </div>
            <p className="text-fg-muted mb-6 text-sm">Ingresa el codigo de 6 digitos de tu app authenticator.</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <input
              autoFocus
              className="input mb-6 font-mono text-2xl text-center tracking-widest"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
            />

            <button disabled={loading || totpCode.length !== 6} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Verificar
            </button>
            <button type="button" onClick={() => { setTotpStep(null); setTotpCode(''); }} className="btn w-full mt-2 text-sm">
              Volver
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="w-full max-w-md">
            <h2 className="text-3xl font-bold mb-1">Iniciar sesion</h2>
            <p className="text-fg-muted mb-8 text-sm">Bienvenido de vuelta a Dreitz.</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Usuario</label>
            <input className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario" autoFocus />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Contrasena</label>
            <input className="input mb-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />

            <label className="mb-6 flex cursor-pointer items-center gap-3 rounded-md border border-border bg-bg-card/60 px-3 py-2.5 text-sm text-fg-muted hover:text-fg">
              <input
                type="checkbox"
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
                className="h-4 w-4 rounded border-border"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span>Recordar credenciales</span>
            </label>

            <button disabled={loading} type="submit" className="btn btn-primary w-full mb-4">
              <LogIn size={16} />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="flex items-center justify-between mb-4">
              <Link to="/reset-password" className="text-xs text-fg-muted hover:text-accent">
                Olvidaste tu contrasena?
              </Link>
            </div>

            <p className="text-center text-sm text-fg-muted">
              Aun no tienes cuenta?{' '}
              <Link to="/register" className="text-accent hover:underline font-semibold">Registrate</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
