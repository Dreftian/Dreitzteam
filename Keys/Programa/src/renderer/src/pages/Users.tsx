import { useEffect, useState, useMemo } from 'react';
import type { User } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Shield, KeyRound, Trash2, X, Save, Download, Search } from 'lucide-react';
import { formatDate } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { toast } from 'sonner';

export default function UsersPage() {
  const { admin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  async function load() {
    const list = await window.api.usersList();
    setUsers(list);
    setSelected(new Set());
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      u.username.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  function toggleAll() {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((u) => u.id)));
    }
  }

  function toggleOne(id: number) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await window.api.usersUpdate({
        id: editing.id,
        email: editing.email ?? undefined,
        role: editing.role,
        is_pro: editing.is_pro,
        adminId: admin?.id
      });
      toast.success(`Usuario ${editing.username} actualizado`);
      setEditing(null);
      await load();
    } finally { setBusy(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget || newPassword.length < 4) return;
    setBusy(true);
    try {
      await window.api.usersResetPassword({ id: resetTarget.id, password: newPassword, adminId: admin?.id });
      toast.success('Contraseña actualizada');
      setResetTarget(null);
      setNewPassword('');
    } finally { setBusy(false); }
  }

  async function del(u: User) {
    if (!confirm(`¿Eliminar a ${u.username}? Esta acción no se puede deshacer.`)) return;
    await window.api.usersDelete({ id: u.id, adminId: admin?.id });
    toast.success(`${u.username} eliminado`);
    await load();
  }

  async function bulkSetPro(value: boolean) {
    if (!selected.size) return;
    if (!confirm(`${value ? 'Activar' : 'Quitar'} Pro a ${selected.size} usuario(s)?`)) return;
    const r = await window.api.usersBulkUpdate({ ids: [...selected], is_pro: value, adminId: admin?.id });
    toast.success(`${r.changed} usuarios actualizados`);
    await load();
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Eliminar ${selected.size} usuario(s)? No se puede deshacer.`)) return;
    const r = await window.api.usersBulkDelete({ ids: [...selected], adminId: admin?.id });
    toast.success(`${r.deleted} usuarios eliminados`);
    await load();
  }

  function exportCsv() {
    downloadCsv(`users_${new Date().toISOString().slice(0, 10)}.csv`, visible, [
      'id', 'username', 'email', 'role', 'is_pro', 'pro_plan', 'pro_expires_at', 'country', 'created_at'
    ]);
    toast.success('CSV descargado');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold">Usuarios</h2>
        <button onClick={exportCsv} className="btn btn-secondary text-sm" disabled={!visible.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-4">Total: {users.length} · Mostrando {visible.length}</p>

      <div className="card p-3 mb-3 flex items-center gap-2">
        <Search size={14} className="text-fg-muted ml-2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuario o email..."
          className="input flex-1 py-1.5 text-sm border-0 bg-transparent focus:shadow-none"
        />
      </div>

      {selected.size > 0 && (
        <div className="card p-3 mb-3 flex items-center gap-2 bg-accent/10 border-accent/30">
          <span className="text-sm font-semibold">{selected.size} seleccionado(s)</span>
          <button onClick={() => bulkSetPro(true)} className="btn btn-secondary text-xs">Activar Pro</button>
          <button onClick={() => bulkSetPro(false)} className="btn btn-secondary text-xs">Quitar Pro</button>
          <button onClick={bulkDelete} className="btn btn-danger text-xs ml-auto">
            <Trash2 size={12} /> Eliminar seleccionados
          </button>
          <button onClick={() => setSelected(new Set())} className="btn btn-secondary text-xs">Cancelar</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-hover/40 border-b border-border">
            <tr className="text-left text-fg-muted">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={visible.length > 0 && selected.size === visible.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Pro</th>
              <th className="px-4 py-3 font-semibold">Creado</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((u) => (
              <tr key={u.id} className={`hover:bg-bg-hover/30 ${selected.has(u.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                      {u.username.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="font-semibold">{u.username}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-fg-muted">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  {u.role === 'admin' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 inline-flex items-center gap-1"><Shield size={10} /> ADMIN</span>
                  ) : (
                    <span className="text-xs text-fg-muted">user</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.is_pro ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 inline-flex items-center gap-1"><Crown size={10} /> PRO</span>
                  ) : (
                    <span className="text-xs text-fg-subtle">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-fg-muted">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button onClick={() => setEditing(u)} className="px-2 py-1 rounded hover:bg-bg-hover text-xs">Editar</button>
                  <button onClick={() => setResetTarget(u)} className="px-2 py-1 rounded hover:bg-bg-hover text-xs"><KeyRound size={12} className="inline" /></button>
                  <button onClick={() => del(u)} className="px-2 py-1 rounded hover:bg-red-500/15 hover:text-red-400 text-xs"><Trash2 size={12} className="inline" /></button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-fg-muted">Sin usuarios en esta vista.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={`Editar ${editing.username}`}>
          <form onSubmit={save}>
            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Email</label>
            <input className="input mb-3" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Rol</label>
            <select className="input mb-3" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as any })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>

            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input type="checkbox" checked={editing.is_pro} onChange={(e) => setEditing({ ...editing, is_pro: e.target.checked })} />
              <span className="text-sm">Suscripción Pro activa</span>
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={busy} className="btn btn-primary flex-1"><Save size={14} /> Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal onClose={() => setResetTarget(null)} title={`Resetear contraseña de ${resetTarget.username}`}>
          <form onSubmit={reset}>
            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Nueva contraseña</label>
            <input className="input mb-5" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="mínimo 4 caracteres" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetTarget(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={busy || newPassword.length < 4} className="btn btn-primary flex-1">Cambiar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center"><X size={15} /></button>
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
