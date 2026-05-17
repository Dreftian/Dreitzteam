import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Loader2 } from 'lucide-react';
import BrandMark from '../components/BrandMark';

const REMEMBER_KEY = 'dreitz.keys.login.credentials';

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
      nav('/dashboard', { replace: true });
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
      nav('/dashboard', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex">
      <div className="hidden md:flex md:w-1/2 hero-gradient items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-25 bg-cover bg-center" style={{ backgroundImage: 'url(https://cdn.akamai.steamstatic.com/steam/apps/2767030/library_hero.jpg)' }} />
        <div className="relative z-10 text-center px-12 max-w-lg">
          <BrandMark size={112} className="mx-auto mb-6 shadow-[0_0_36px_rgba(143,48,54,0.35)]" />
          <div className="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold tracking-widest mb-6">PANEL ADMIN</div>
          <h1 className="text-6xl font-extrabold leading-none mb-4 shimmer-text">Keys</h1>
          <p className="text-white/80 text-lg leading-relaxed">
            Gestion de cuentas, catalogo, licencias y ventas de la tienda Dreitz.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        {totpStep ? (
          <form onSubmit={submitTotp} className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-3">
              <BrandMark size={32} />
              <h2 className="text-2xl font-bold">Codigo 2FA</h2>
            </div>
            <p className="text-sm text-fg-muted mb-6">Ingresa el codigo de 6 digitos de tu app authenticator.</p>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle size={15} /> {error}
              </div>
            )}
            <input
              autoFocus
              className="input mb-4 font-mono text-2xl text-center tracking-widest"
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
            <div className="flex items-center gap-3 mb-6">
              <BrandMark size={34} />
              <div>
                <h2 className="text-2xl font-bold">Acceso restringido</h2>
                <p className="text-sm text-fg-muted">Solo administradores Dreitzteam.</p>
              </div>
            </div>

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

            <button disabled={loading} type="submit" className="btn btn-primary w-full">
              {loading ? 'Verificando...' : 'Entrar al panel'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
