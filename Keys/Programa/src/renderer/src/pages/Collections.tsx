import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bookmark, Plus, Trash2, X, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Collection {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  hero_image: string | null;
  curator_name: string | null;
  is_published: number;
  created_at: string;
  games: Array<{ id: number; title: string; capsule_image: string }>;
}

interface Game { id: number; title: string; capsule_image: string }

export default function CollectionsAdmin() {
  const { admin } = useAuth();
  const [list, setList] = useState<Collection[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    slug: '', title: '', description: '', hero_image: '', curator_name: 'Dreitzteam Editorial', is_published: true,
    gameIds: [] as number[]
  });

  async function load() {
    setList(await window.api.collectionsList());
    setGames(await window.api.gamesList());
  }
  useEffect(() => { load(); }, []);

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title || !draft.slug) return toast.error('Título y slug requeridos');
    await window.api.collectionsCreate({ ...draft, adminId: admin?.id });
    toast.success('Colección creada');
    setCreating(false);
    setDraft({ slug: '', title: '', description: '', hero_image: '', curator_name: 'Dreitzteam Editorial', is_published: true, gameIds: [] });
    await load();
  }

  async function del(c: Collection) {
    if (!confirm(`¿Eliminar "${c.title}"?`)) return;
    await window.api.collectionsDelete({ id: c.id, adminId: admin?.id });
    toast.success('Eliminada');
    await load();
  }

  function toggleGame(id: number) {
    setDraft((d) => ({
      ...d,
      gameIds: d.gameIds.includes(id) ? d.gameIds.filter((g) => g !== id) : [...d.gameIds, id]
    }));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold flex items-center gap-3"><Bookmark className="text-purple-400" /> Colecciones curadas</h2>
        <button onClick={() => setCreating(true)} className="btn btn-primary text-sm">
          <Plus size={14} /> Nueva colección
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">Listas seleccionadas como "Top RPGs 2026" o "Indies para llorar". Aparecen en el mega menú y en /collections.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((c) => (
          <div key={c.id} className="card overflow-hidden">
            <div className="relative h-32 bg-gradient-to-br from-purple-500/20 via-bg-card to-cyan-500/20">
              {c.hero_image && <img src={c.hero_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-card to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-lg font-bold truncate">{c.title}</h3>
                <div className="text-[10px] uppercase tracking-widest text-fg-muted font-bold">/collections/{c.slug}</div>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-fg-muted mb-2">{c.curator_name || '—'} · {c.games.length} juegos</div>
              {c.description && <p className="text-xs text-fg-muted line-clamp-2 mb-3">{c.description}</p>}
              <button onClick={() => del(c)} className="btn btn-danger text-xs w-full"><Trash2 size={12} /> Eliminar</button>
            </div>
          </div>
        ))}
        {!list.length && (
          <div className="col-span-full card p-10 text-center text-fg-muted">Aún no hay colecciones publicadas.</div>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={create} className="card max-w-2xl w-full p-6 my-8 relative">
            <button type="button" onClick={() => setCreating(false)} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center">
              <X size={15} />
            </button>
            <h3 className="text-lg font-bold mb-4">Nueva colección</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Título *</label>
                <input className="input" required value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: draft.slug || slugify(e.target.value) })}
                  placeholder="Top RPGs 2026" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Slug *</label>
                <input className="input font-mono" required value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
                  placeholder="top-rpgs-2026" />
              </div>
            </div>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Descripción</label>
            <textarea className="input mb-3 min-h-[80px]" value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Imagen hero (URL)</label>
            <input className="input mb-3" value={draft.hero_image}
              onChange={(e) => setDraft({ ...draft, hero_image: e.target.value })} placeholder="https://..." />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Curador</label>
            <input className="input mb-4" value={draft.curator_name}
              onChange={(e) => setDraft({ ...draft, curator_name: e.target.value })} />

            <label className="block text-xs font-semibold text-fg-muted mb-2">Juegos ({draft.gameIds.length} seleccionados)</label>
            <div className="card p-2 max-h-60 overflow-y-auto mb-5 grid grid-cols-2 gap-1">
              {games.map((g) => (
                <label key={g.id} className="flex items-center gap-2 p-1.5 hover:bg-bg-hover rounded cursor-pointer">
                  <input type="checkbox" checked={draft.gameIds.includes(g.id)} onChange={() => toggleGame(g.id)} />
                  <img src={g.capsule_image} alt="" className="w-12 h-6 object-cover rounded" />
                  <span className="text-xs truncate flex-1">{g.title}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setCreating(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn btn-primary flex-1"><Save size={14} /> Crear</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
