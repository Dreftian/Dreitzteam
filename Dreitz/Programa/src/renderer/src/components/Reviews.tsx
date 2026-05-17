import { useEffect, useState } from 'react';
import { Star, MessageSquarePlus, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Review, ReviewSummary } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/format';
import { toast } from 'sonner';

function HelpfulVote({ reviewId }: { reviewId: number }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ helpful: number; not_helpful: number } | null>(null);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    window.api.reviewsVoteCount?.(reviewId).then(setCounts).catch(() => {});
  }, [reviewId]);

  async function vote(helpful: boolean) {
    if (!user) return toast.error('Inicia sesión para votar');
    try {
      const r = await window.api.reviewsVote({ userId: user.id, reviewId, helpful });
      setCounts(r);
      setVoted(helpful ? 'up' : 'down');
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-fg-subtle">
      <button
        onClick={() => vote(true)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bg-hover ${voted === 'up' ? 'text-green-400' : ''}`}
      >
        <ThumbsUp size={11} /> {counts?.helpful ?? 0}
      </button>
      <button
        onClick={() => vote(false)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bg-hover ${voted === 'down' ? 'text-red-400' : ''}`}
      >
        <ThumbsDown size={11} /> {counts?.not_helpful ?? 0}
      </button>
    </div>
  );
}

export default function Reviews({ gameId }: { gameId: number }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [mine, setMine] = useState<Review | null>(null);
  const [composing, setComposing] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  async function load() {
    const [list, sum] = await Promise.all([
      window.api.reviewsList(gameId),
      window.api.reviewsSummary(gameId)
    ]);
    setReviews(list); setSummary(sum);
    if (user) {
      const m = await window.api.reviewsMine({ userId: user.id, gameId });
      setMine(m);
      if (m) {
        setRating(m.rating);
        setTitle(m.title || '');
        setBody(m.body || '');
      }
    }
  }
  useEffect(() => { load(); }, [gameId, user?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    try {
      await window.api.reviewsCreate({ userId: user.id, gameId, rating, title, body });
      toast.success(mine ? 'Reseña actualizada' : 'Reseña publicada');
      setComposing(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-3">
          Reseñas
          {summary && summary.count > 0 && (
            <span className="flex items-center gap-1 text-base text-fg-muted font-normal">
              <Star size={16} className="fill-yellow-400 text-yellow-400" /> {summary.average?.toFixed(1)} · {summary.count}
            </span>
          )}
        </h2>
        {user && (
          <button onClick={() => setComposing(true)} className="btn btn-secondary text-sm">
            <MessageSquarePlus size={14} /> {mine ? 'Editar mi reseña' : 'Escribir reseña'}
          </button>
        )}
      </div>

      {!reviews.length ? (
        <div className="card p-8 text-center text-sm text-fg-muted">
          Aún no hay reseñas. {user ? '¡Sé el primero en compartir tu opinión!' : 'Inicia sesión para reseñar.'}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                  {r.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{r.username}</div>
                  <div className="text-[10px] text-fg-subtle">{formatDate(r.created_at)}</div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} className={n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-bg-hover'} />
                  ))}
                </div>
              </div>
              {r.title && <div className="font-semibold text-sm mb-1">{r.title}</div>}
              {r.body && <p className="text-sm text-fg-muted leading-relaxed">{r.body}</p>}
              <HelpfulVote reviewId={r.id} />
            </div>
          ))}
        </div>
      )}

      {composing && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submit} className="card max-w-md w-full p-6 relative">
            <button type="button" onClick={() => setComposing(false)} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center">
              <X size={15} />
            </button>
            <h3 className="text-lg font-bold mb-4">{mine ? 'Editar reseña' : 'Escribir reseña'}</h3>

            <label className="block text-xs font-semibold text-fg-muted mb-2">Tu calificación</label>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="hover:scale-110 transition-transform"
                >
                  <Star size={28} className={n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-bg-hover'} />
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Título (opcional)</label>
            <input className="input mb-3" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumen breve" />

            <label className="block text-xs font-semibold text-fg-muted mb-1.5">Tu opinión</label>
            <textarea className="input mb-5 min-h-[120px]" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="¿Qué te pareció?" />

            <div className="flex gap-2">
              <button type="button" onClick={() => setComposing(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn btn-primary flex-1">Publicar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
