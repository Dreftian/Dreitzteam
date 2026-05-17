import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, X, Save, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { formatDateTime } from '../lib/format';
import { toast } from 'sonner';

interface Promotion {
  id: number;
  title: string;
  subtitle: string | null;
  hero_image: string | null;
  accent_color: string;
  cta_text: string | null;
  cta_target: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  is_active: number;
  games: Array<{ id: number; title: string; capsule_image: string; header_image: string }>;
}

interface Game { id: number; title: string; capsule_image: string; header_image: string }

const ACCENT_PRESETS = ['#00d4ff', '#a855ff', '#ff3aa6', '#38e07b', '#ffa632', '#ff6b6b', '#06b6d4'];

export default function PromotionsPage() {
  const { admin } = useAuth();
  const [list, setList] = useState<Promotion[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: '', subtitle: '', hero_image: '', accent_color: '#00d4ff',
    cta_text: 'Ver ofertas', cta_target: '/store?onSale=1',
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    priority: 5,
    gameIds: [] as number[]
  });

  async function load() {
    setList(await window.api.promotionsList());
    setGames(await window.api.gamesList());
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (draft.title.length < 3) return toast.error('Título muy corto');
    await window.api.promotionsCreate({
      ...draft,
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      starts_at: new Date().toISOString(),
      is_active: true,
      adminId: admin?.id
    });
    toast.success('Promoción creada');
    setCreating(false);
    setDraft({ title: '', subtitle: '', hero_image: '', accent_color: '#00d4ff',
      cta_text: 'Ver ofertas', cta_target: '/store?onSale=1',
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      priority: 5, gameIds: [] });
    await load();
  }

  async function toggle(p: Promotion) {
    await window.api.promotionsUpdate({ id: p.id, is_active: !p.is_active, adminId: admin?.id });
    await load();
  }

  async function del(p: Promotion) {
    if (!confirm(`¿Eliminar promoción "${p.title}"?`)) return;
    await window.api.promotionsDelete({ id: p.id, adminId: admin?.id });
    toast.success('Eliminada');
    await load();
  }

  function toggleGame(id: number) {
    setDraft((d) => ({
      ...d,
      gameIds: d.gameIds.includes(id) ? d.gameIds.filter((g) => g !== id) : [...d.gameIds, id]
    }));
  }

  function pickFromGameImage(id: number) {
    const g = games.find((x) => x.id === id);
    if (g) setDraft((d) => ({ ...d, hero_image: g.header_image }));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold">Promociones</h2>
        <button onClick={() => setCreating(true)} className="btn btn-primary text-sm">
          <Plus size={14} /> Nueva promoción
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Banners promocionales con arte propio que rotan en la portada de Dreitz.
      </p>

      <div className="grid lg:grid-cols-2 gap-4">
        {list.map((p) => (
          <div key={p.id} className="card overflow-hidden">
            <div className="relative h-32" style={{ background: `linear-gradient(135deg, ${p.accent_color}30, var(--bg-card) 70%)` }}>
              {p.hero_image && <img src={p.hero_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-card to-transparent" />
              <div className="absolute bottom-3 left-4">
                <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: p.accent_color }}>
                  {p.is_active ? 'Activa' : 'Pausada'}
                </div>
                <div className="text-lg font-bold">{p.title}</div>
                {p.subtitle && <div className="text-xs text-fg-muted truncate max-w-md">{p.subtitle}</div>}
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><span className="text-fg-subtle">Inicia:</span> {p.starts_at ? formatDateTime(p.starts_at) : '—'}</div>
                <div><span className="text-fg-subtle">Termina:</span> {p.ends_at ? formatDateTime(p.ends_at) : 'sin fecha'}</div>
                <div><span className="text-fg-subtle">CTA:</span> {p.cta_text} → {p.cta_target}</div>
                <div><span className="text-fg-subtle">Juegos:</span> {p.games.length}</div>
              </div>
              <div className="flex gap-1 flex-wrap mb-3">
                {p.games.slice(0, 4).map((g) => (
                  <img key={g.id} src={g.capsule_image} alt={g.title} className="w-14 h-7 rounded object-cover" />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggle(p)} className="btn btn-secondary text-xs">
                  {p.is_active ? <><EyeOff size={12} /> Pausar</> : <><Eye size={12} /> Activar</>}
                </button>
                <button onClick={() => del(p)} className="btn btn-danger text-xs ml-auto"><Trash2 size={12} /> Eliminar</button>
              </div>
            </div>
          </div>
        ))}
        {!list.length && (
          <div className="col-span-full card p-10 text-center text-fg-muted">
            Aún no hay promociones. Crea la primera para que aparezca en la portada de Dreitz.
          </div>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={create} className="card max-w-2xl w-full p-6 my-8 relative">
            <button type="button" onClick={() => setCreating(false)} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center">
              <X size={15} />
            </button>
            <h3 className="text-lg font-bold mb-4">Nueva promoción</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Título *</label>
                <input className="input" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Festival de RPG" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Subtítulo</label>
                <input className="input" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Hasta -40%" />
              </div>
            </div>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5 flex items-center gap-1"><ImageIcon size={11} /> URL de imagen hero</label>
            <input className="input mb-3" value={draft.hero_image} onChange={(e) => setDraft({ ...draft, hero_image: e.target.value })} placeholder="https://..." />
            <div className="text-[11px] text-fg-subtle mb-3">O reutiliza la imagen de un juego (ver más abajo)</div>

            <label className="block text-xs font-semibold text-fg-muted mb-2">Color de acento</label>
            <div className="flex gap-2 mb-3">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, accent_color: c })}
                  className={`w-8 h-8 rounded-full transition-all ${draft.accent_color === c ? 'ring-2 ring-offset-2 ring-offset-bg-card ring-fg' : 'hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={draft.accent_color} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} className="w-8 h-8 rounded-full cursor-pointer" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">CTA texto</label>
                <input className="input" value={draft.cta_text} onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">CTA destino</label>
                <input className="input" value={draft.cta_target} onChange={(e) => setDraft({ ...draft, cta_target: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Termina</label>
                <input className="input" type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Prioridad</label>
                <input className="input" type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <label className="block text-xs font-semibold text-fg-muted mb-2">Juegos asociados ({draft.gameIds.length})</label>
            <div className="card p-2 max-h-60 overflow-y-auto mb-5 grid grid-cols-2 gap-1">
              {games.map((g) => (
                <div key={g.id} className="flex items-center gap-2 p-1.5 hover:bg-bg-hover rounded">
                  <input type="checkbox" checked={draft.gameIds.includes(g.id)} onChange={() => toggleGame(g.id)} />
                  <img src={g.capsule_image} alt="" className="w-12 h-6 object-cover rounded" />
                  <span className="text-xs truncate flex-1">{g.title}</span>
                  <button type="button" onClick={() => pickFromGameImage(g.id)} className="text-[10px] text-fg-subtle hover:text-accent" title="Usar imagen del juego">
                    Hero
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setCreating(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn btn-primary flex-1"><Save size={14} /> Crear promoción</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
