import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Check, X, Search, MessageCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import EmptyState from '../components/EmptyState';

interface Friend { id: number; username: string; ref_code: string; is_pro: boolean; country: string; created_at: string }
interface Request { id: number; from_id: number; username: string; ref_code: string; message: string | null; created_at: string }

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!user) return;
    const [f, i] = await Promise.all([window.api.friendsList(user.id), window.api.friendsIncoming(user.id)]);
    setFriends(f); setIncoming(i);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function find() {
    if (!searchCode.trim()) return;
    const r = await window.api.friendsFindByCode(searchCode);
    if (!r) toast.error('Código no encontrado');
    setFoundUser(r);
  }

  async function sendRequest() {
    if (!user || !foundUser) return;
    setBusy(true);
    try {
      await window.api.friendsRequest({ fromId: user.id, toRefCode: foundUser.ref_code, message });
      toast.success(`Solicitud enviada a ${foundUser.username}`);
      setSearchCode(''); setMessage(''); setFoundUser(null);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function respond(reqId: number, accept: boolean) {
    if (!user) return;
    await window.api.friendsRespond({ userId: user.id, requestId: reqId, accept });
    toast.success(accept ? 'Amistad aceptada' : 'Solicitud rechazada');
    await load();
  }

  async function removeFriend(f: Friend) {
    if (!user) return;
    if (!confirm(`¿Eliminar a ${f.username} de amigos?`)) return;
    await window.api.friendsRemove({ userId: user.id, friendId: f.id });
    toast.success('Amigo eliminado');
    await load();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-1 flex items-center gap-3"><Users className="text-cyan-400" /> Amigos</h2>
      <p className="text-fg-muted text-sm mb-6">Comparte tu código de referido para agregar a alguien.</p>

      <section className="card p-5 mb-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><UserPlus size={16} /> Agregar por código</h3>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') find(); }}
              placeholder="ABC-XXXXXX"
              className="input pl-9 font-mono"
            />
          </div>
          <button onClick={find} className="btn btn-secondary">Buscar</button>
        </div>
        {foundUser && (
          <div className="card p-3 bg-bg-hover/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-bold text-white">
              {foundUser.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{foundUser.username}</div>
              <div className="text-xs text-fg-muted">{foundUser.ref_code} {foundUser.is_pro && <span className="text-yellow-400 ml-1">PRO</span>}</div>
            </div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensaje (opcional)"
              className="input max-w-[200px] py-1 text-sm"
            />
            <button onClick={sendRequest} disabled={busy} className="btn btn-primary text-sm">
              <UserPlus size={14} /> Enviar
            </button>
          </div>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="mb-5">
          <h3 className="font-bold mb-3">Solicitudes recibidas ({incoming.length})</h3>
          <div className="card divide-y divide-border">
            {incoming.map((r) => (
              <div key={r.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-bold text-white">
                  {r.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.username}</div>
                  {r.message && <div className="text-xs text-fg-muted flex items-center gap-1 truncate"><MessageCircle size={11} /> {r.message}</div>}
                </div>
                <button onClick={() => respond(r.id, true)} className="btn btn-primary text-xs"><Check size={12} /> Aceptar</button>
                <button onClick={() => respond(r.id, false)} className="btn btn-secondary text-xs"><X size={12} /> Rechazar</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-bold mb-3">Tu lista ({friends.length})</h3>
        {!friends.length ? (
          <EmptyState illustration="library" title="Aún no tienes amigos" body="Comparte tu código de referido (mira en Puntos) para que te agreguen." cta={null} />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {friends.map((f) => (
              <div key={f.id} className="card p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-bold text-white shrink-0">
                  {f.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {f.username}
                    {f.is_pro && <span className="text-[10px] font-bold text-yellow-400">PRO</span>}
                  </div>
                  <div className="text-[11px] text-fg-subtle">{f.ref_code}</div>
                </div>
                <Link to={`/friends/${f.id}`} className="btn btn-secondary text-xs">Ver biblioteca</Link>
                <button onClick={() => removeFriend(f)} className="px-2 py-1 rounded hover:bg-red-500/15 hover:text-red-400 text-xs">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
