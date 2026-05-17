import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Save, Upload, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

/**
 * Edición del perfil — banner, frame del avatar, bio. Lo que verán otros
 * usuarios cuando entren al profile público.
 *
 * - Banner: imagen 1280×320 que se muestra detrás del avatar (data URL, máx 2MB)
 * - Frame: cuatro estilos pre-fabricados (none, gradient, neon, gold)
 * - Bio: texto corto (~280 caracteres)
 */

const FRAMES: Array<{ key: string; label: string; preview: string }> = [
  { key: 'none', label: 'Sin marco', preview: '' },
  { key: 'gradient', label: 'Gradient marca', preview: 'linear-gradient(135deg, #00d4ff, #6e00ff, #ff3aa6)' },
  { key: 'neon', label: 'Neón rosa', preview: 'linear-gradient(135deg, #ec4899, #f97316)' },
  { key: 'gold', label: 'Oro Pro', preview: 'linear-gradient(135deg, #fde047, #f59e0b)' },
  { key: 'aurora', label: 'Aurora', preview: 'linear-gradient(135deg, #7dd3fc, #22d3ee, #a855ff)' },
  { key: 'mint', label: 'Menta', preview: 'linear-gradient(135deg, #5eead4, #2dd4bf)' }
];

export default function ProfileEdit() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [banner, setBanner] = useState<string | null>(null);
  const [frame, setFrame] = useState('none');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    window.api.profileGet?.(user.id).then((p: any) => {
      if (p) {
        setBanner(p.banner ?? null);
        setFrame(p.avatar_frame ?? 'none');
        setBio(p.bio ?? '');
      }
    }).catch(() => {});
  }, [user?.id]);

  function onBannerPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Banner muy grande (máx 2 MB)');
    const reader = new FileReader();
    reader.onload = () => setBanner(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await window.api.profileSet({
        userId: user.id,
        banner: banner ?? '',
        avatar_frame: frame,
        bio: bio.trim()
      });
      toast.success('Perfil actualizado');
      setTimeout(() => nav('/profile'), 600);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  const frameStyle = FRAMES.find((f) => f.key === frame)?.preview;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => nav(-1)} className="text-fg-muted hover:text-fg flex items-center gap-2 mb-4 text-sm">
        <ArrowLeft size={14} /> Volver
      </button>

      <h1 className="text-h2 mb-1">Personaliza tu perfil</h1>
      <p className="text-fg-muted text-sm mb-8">Banner, marco del avatar y bio — esto verán otros usuarios cuando visiten tu perfil.</p>

      {/* PREVIEW */}
      <div className="card overflow-hidden mb-8">
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2 px-4 pt-3">Vista previa</div>
        <div className="relative">
          {/* Banner */}
          <div className="h-32 relative overflow-hidden">
            {banner ? (
              <img src={banner} alt="banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{
                background: 'linear-gradient(135deg, var(--surface-3), var(--surface-1))'
              }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent" />
          </div>
          {/* Avatar centrado sobre banner */}
          <div className="flex items-end gap-4 px-6 -mt-10 pb-4">
            <motion.div
              key={frame}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="shrink-0 p-1 rounded-full"
              style={frameStyle ? { background: frameStyle } : { background: 'var(--surface-3)' }}
            >
              <div className="rounded-full bg-bg-card p-0.5">
                <Avatar size={64} username={user?.username ?? '?'} url={null} />
              </div>
            </motion.div>
            <div className="pb-2 flex-1 min-w-0">
              <div className="font-extrabold text-lg truncate">{user?.username}</div>
              {bio ? (
                <div className="text-sm text-fg-muted leading-tight line-clamp-2">{bio}</div>
              ) : (
                <div className="text-sm text-fg-subtle italic">Sin bio</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BANNER */}
      <section className="card p-5 mb-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-400" /> Banner
        </h3>
        <p className="text-xs text-fg-muted mb-3">Imagen panorámica detrás de tu avatar. 1280×320 recomendado · máx 2 MB.</p>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onBannerPick} />
          <button onClick={() => fileRef.current?.click()} className="btn text-sm flex items-center gap-2">
            <Upload size={14} /> Subir imagen
          </button>
          {banner && (
            <button onClick={() => setBanner(null)} className="btn text-sm hover:text-red-400">
              Quitar
            </button>
          )}
        </div>
      </section>

      {/* FRAME */}
      <section className="card p-5 mb-4">
        <h3 className="font-bold mb-3">Marco del avatar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FRAMES.map((f) => (
            <button
              key={f.key}
              onClick={() => setFrame(f.key)}
              className={`p-3 rounded-md border text-sm flex items-center gap-3 transition-all ${
                frame === f.key
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:bg-bg-hover'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full p-0.5 shrink-0"
                style={f.preview ? { background: f.preview } : { background: 'var(--surface-3)' }}
              >
                <div className="w-full h-full rounded-full bg-bg-card" />
              </div>
              <span className="text-xs font-medium">{f.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* BIO */}
      <section className="card p-5 mb-6">
        <h3 className="font-bold mb-3">Bio</h3>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 280))}
          placeholder="Cuéntales a otros usuarios quién eres como gamer..."
          className="input min-h-[100px] resize-none"
        />
        <div className="text-right text-[11px] text-fg-subtle mt-1">{bio.length}/280</div>
      </section>

      <div className="flex justify-end gap-2 sticky bottom-4">
        <button onClick={() => nav(-1)} className="btn">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar perfil
        </button>
      </div>
    </div>
  );
}
