import { useEffect, useState } from 'react';
import { X, Upload, Image as ImageIcon, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { LibraryGame } from '../lib/types';
import { toast } from 'sonner';
import Avatar from './Avatar';

export default function AvatarPicker({ onClose }: { onClose: () => void }) {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState<'game' | 'upload'>('game');
  const [library, setLibrary] = useState<LibraryGame[]>([]);
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    window.api.libraryList(user.id).then(setLibrary);
  }, [user?.id]);

  async function pickFile() {
    setBusy(true);
    try {
      const r: any = await window.api.avatarPickFile();
      if (r?.dataUrl) {
        setPendingUpload(r.dataUrl);
      }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function applyValue(value: string | null) {
    if (!user) return;
    setBusy(true);
    try {
      await window.api.avatarSet({ userId: user.id, value });
      toast.success('Avatar actualizado');
      await refresh();
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card max-w-3xl w-full p-6 relative max-h-[88vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center">
          <X size={15} />
        </button>
        <h3 className="text-lg font-bold mb-1">Cambiar avatar</h3>
        <p className="text-xs text-fg-muted mb-5">Elige una imagen propia o usa la portada de un juego que tengas.</p>

        <div className="flex gap-2 mb-5">
          <TabBtn active={tab === 'game'} onClick={() => setTab('game')} icon={<ImageIcon size={14} />} label={`Juegos (${library.length})`} />
          <TabBtn active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload size={14} />} label="Subir imagen" />
          {user?.avatar && (
            <button
              onClick={() => applyValue(null)}
              disabled={busy}
              className="ml-auto px-3 py-1.5 rounded-md text-xs text-fg-muted hover:bg-red-500/15 hover:text-red-300 flex items-center gap-1.5"
              title="Quitar avatar"
            >
              <Trash2 size={12} /> Quitar avatar
            </button>
          )}
        </div>

        {tab === 'game' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {library.map((g) => (
              <button
                key={g.id}
                onClick={() => applyValue(`game:${g.id}`)}
                disabled={busy}
                className="group relative rounded-lg overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-accent transition-all"
                title={g.title}
              >
                <img src={g.capsule_image || g.header_image} alt={g.title} className="w-full aspect-[460/215] object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-white rounded-full w-8 h-8 flex items-center justify-center">
                    <Check size={14} />
                  </div>
                </div>
                <div className="px-2 py-1 text-[10px] font-semibold truncate">{g.title}</div>
              </button>
            ))}
            {!library.length && (
              <div className="col-span-full card p-8 text-center text-fg-muted text-sm">
                Aún no tienes juegos. Compra uno para usar su portada como avatar.
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div className="space-y-4">
            <div className="card p-6 flex flex-col items-center text-center bg-bg-hover/30">
              {pendingUpload ? (
                <img src={pendingUpload} alt="" className="w-32 h-32 rounded-full object-cover mb-4 ring-2 ring-accent" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-bg-hover flex items-center justify-center mb-4 text-fg-subtle">
                  <ImageIcon size={42} />
                </div>
              )}
              <button onClick={pickFile} disabled={busy} className="btn btn-secondary text-sm">
                <Upload size={14} /> {pendingUpload ? 'Elegir otra' : 'Seleccionar imagen…'}
              </button>
              <p className="text-[11px] text-fg-subtle mt-2">PNG, JPG, WEBP o GIF · máximo 1.5 MB</p>
            </div>

            {pendingUpload && (
              <button
                onClick={() => applyValue(pendingUpload)}
                disabled={busy}
                className="btn btn-primary w-full"
              >
                <Check size={14} /> Usar como avatar
              </button>
            )}

            <div className="card p-3 flex items-center gap-3 bg-bg-base/40">
              <Avatar user={user} size={48} />
              <div className="text-xs text-fg-muted">
                <div>Avatar actual</div>
                <div className="text-fg-subtle">{user?.avatar ? (user.avatar.startsWith('game:') ? 'Portada de juego' : user.avatar.startsWith('data:') ? 'Imagen subida' : 'URL externa') : 'Inicial automática'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all ${active ? 'bg-accent/15 text-accent border border-accent/40' : 'bg-bg-hover text-fg-muted hover:text-fg border border-transparent'}`}
    >
      {icon} {label}
    </button>
  );
}
