import { useEffect, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { Layers, Plus, Edit2, Trash2, X, Check, Loader2, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { Game } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useCachedImage } from '../lib/useCachedImage';

interface Shelf {
  id: number;
  name: string;
  ord: number;
  games: Game[];
}

/**
 * Custom shelves estilo Steam para organizar la biblioteca personal.
 * Cada user puede crear N estantes ("Para terminar", "Co-op con amigos", etc).
 * Drag-and-drop con framer-motion Reorder para mover juegos dentro y entre estantes.
 *
 * Props:
 *   libraryGames: lista de juegos comprados — necesarios para el dropdown "Añadir"
 */
export default function ShelvesSection({ libraryGames }: { libraryGames: Array<{ id: number; title: string; capsule_image: string | null; header_image: string | null; drm_platform?: string }> }) {
  const { user } = useAuth();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [addingToShelf, setAddingToShelf] = useState<number | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const list = await window.api.shelvesList(user.id);
      setShelves(list as Shelf[]);
    } catch (e) {
      console.warn('[shelves]', e);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user?.id]);

  async function createShelf() {
    if (!user || !newName.trim()) return;
    try {
      await window.api.shelvesCreate({ userId: user.id, name: newName.trim() });
      toast.success(`Estante "${newName}" creado`);
      setNewName('');
      setCreating(false);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function rename(shelfId: number) {
    if (!user || !renameDraft.trim()) return;
    try {
      await window.api.shelvesRename({ userId: user.id, shelfId, name: renameDraft.trim() });
      toast.success('Estante renombrado');
      setRenamingId(null);
      setRenameDraft('');
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteShelf(shelfId: number) {
    if (!user) return;
    if (!confirm('¿Eliminar este estante? Los juegos siguen en tu biblioteca.')) return;
    try {
      await window.api.shelvesDelete({ userId: user.id, shelfId });
      toast.success('Estante eliminado');
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function addGame(shelfId: number, gameId: number) {
    if (!user) return;
    try {
      await window.api.shelvesAddGame({ userId: user.id, shelfId, gameId });
      setAddingToShelf(null);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function removeGame(shelfId: number, gameId: number) {
    try {
      await window.api.shelvesRemoveGame({ shelfId, gameId });
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (!user || libraryGames.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title text-xl flex items-center gap-2">
          <Layers size={18} className="text-purple-400" />
          Mis estantes
          {shelves.length > 0 && (
            <span className="text-xs text-fg-muted font-normal">({shelves.length})</span>
          )}
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="btn text-sm flex items-center gap-1.5"
        >
          <Plus size={14} /> Nuevo estante
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-4 mb-4 flex gap-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createShelf()}
              placeholder="Ej. Para terminar, Co-op con amigos, Favoritos..."
              className="input flex-1"
              maxLength={50}
            />
            <button onClick={createShelf} disabled={!newName.trim()} className="btn btn-primary text-sm">
              <Check size={14} /> Crear
            </button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="btn text-sm">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="card p-6 text-center text-fg-muted text-sm">Cargando estantes…</div>
      ) : shelves.length === 0 ? (
        <div className="card p-8 text-center">
          <Layers size={40} className="mx-auto mb-3 text-fg-subtle" strokeWidth={1.3} />
          <p className="text-sm text-fg-muted mb-1">No tienes estantes aún.</p>
          <p className="text-xs text-fg-subtle">Crea uno para organizar tu biblioteca como en Steam.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shelves.map((shelf) => (
            <div key={shelf.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                {renamingId === shelf.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && rename(shelf.id)}
                      className="input flex-1 max-w-sm"
                      maxLength={50}
                    />
                    <button onClick={() => rename(shelf.id)} className="btn text-xs"><Check size={12} /></button>
                    <button onClick={() => setRenamingId(null)} className="btn text-xs"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <h4 className="font-bold text-base">{shelf.name}</h4>
                    <div className="text-xs text-fg-subtle">{shelf.games.length} juego{shelf.games.length === 1 ? '' : 's'}</div>
                  </>
                )}
                {renamingId !== shelf.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAddingToShelf(addingToShelf === shelf.id ? null : shelf.id)}
                      className="btn text-xs"
                      title="Añadir juego"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => { setRenamingId(shelf.id); setRenameDraft(shelf.name); }}
                      className="btn text-xs"
                      title="Renombrar"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => deleteShelf(shelf.id)}
                      className="btn text-xs hover:text-red-400"
                      title="Eliminar estante"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {addingToShelf === shelf.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 p-3 bg-bg-elev rounded-md"
                  >
                    <div className="text-xs text-fg-muted mb-2">Selecciona un juego de tu biblioteca:</div>
                    <div className="grid sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto thin-scrollbar">
                      {libraryGames
                        .filter((g) => !shelf.games.some((sg) => sg.id === g.id))
                        .map((g) => (
                          <button
                            key={g.id}
                            onClick={() => addGame(shelf.id, g.id)}
                            className="text-left p-2 rounded hover:bg-bg-hover text-xs font-medium truncate flex items-center gap-2"
                          >
                            {(g.capsule_image || g.header_image) && (
                              <img src={g.capsule_image || g.header_image!} className="w-12 aspect-[460/215] object-cover rounded shrink-0" alt="" />
                            )}
                            <span className="truncate">{g.title}</span>
                          </button>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {shelf.games.length === 0 ? (
                <div className="text-xs text-fg-subtle text-center py-4">
                  Estante vacío — pulsa <Plus size={11} className="inline align-middle" /> para añadir juegos.
                </div>
              ) : (
                <Reorder.Group
                  axis="x"
                  values={shelf.games}
                  onReorder={(newOrder) => {
                    // Local-only reorder (no persiste todavía — el backend tiene `ord` pero no hay
                    // endpoint de bulk reorder; queda como iteración).
                    setShelves((curr) => curr.map((s) => s.id === shelf.id ? { ...s, games: newOrder } : s));
                  }}
                  className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
                >
                  {shelf.games.map((g) => (
                    <ShelfGameCard key={g.id} game={g} onRemove={() => removeGame(shelf.id, g.id)} />
                  ))}
                </Reorder.Group>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ShelfGameCard({ game, onRemove }: { game: Game; onRemove: () => void }) {
  const cached = useCachedImage(game.capsule_image || game.header_image);
  return (
    <Reorder.Item value={game} className="shrink-0 group relative">
      <Link to={`/game/${game.id}`} className="block w-40 rounded-md overflow-hidden card lift">
        {cached && (
          <img src={cached} alt={game.title} className="w-full aspect-[460/215] object-cover" />
        )}
        <div className="p-2">
          <div className="text-xs font-bold truncate">{game.title}</div>
        </div>
      </Link>
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="bg-black/70 backdrop-blur p-1 rounded cursor-grab active:cursor-grabbing">
          <GripVertical size={11} className="text-white" />
        </span>
      </div>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/85"
        title="Quitar del estante"
      >
        <X size={11} className="text-white" />
      </button>
    </Reorder.Item>
  );
}
