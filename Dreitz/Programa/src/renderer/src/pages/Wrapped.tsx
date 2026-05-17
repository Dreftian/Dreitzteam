import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShoppingBag, Heart, Award, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatPrice } from '../lib/format';
import { Skeleton } from '../components/Skeleton';

interface WrappedData {
  year: number;
  total_spent: number;
  games_acquired: number;
  reviews_written: number;
  wishlist_added: number;
  top_genres: { genre: string; count: number }[];
  most_expensive: { title: string; price: number } | null;
  monthly: { month: number; revenue: number; orders: number }[];
}

const MONTH_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Wrapped() {
  const { user } = useAuth();
  const [data, setData] = useState<WrappedData | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    window.api.wrappedGet({ userId: user.id, year }).then(setData);
  }, [user?.id]);

  if (!data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-72 mb-2" />
        <Skeleton className="h-3 w-96 mb-8" />
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6">
              <Skeleton className="h-3 w-32 mb-2" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
        <div className="card p-6">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="flex items-end gap-2 h-40">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${30 + Math.random() * 70}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const maxMonth = Math.max(1, ...data.monthly.map((m) => m.revenue));
  const peak = data.monthly.reduce((a, b) => (b.revenue > a.revenue ? b : a), data.monthly[0]);

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 hero-gradient opacity-50 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 text-xs font-bold tracking-widest mb-4">
            <Sparkles size={11} /> DREITZ WRAPPED · {data.year}
          </div>
          <h1 className="text-6xl md:text-7xl font-extrabold leading-none">
            <span className="shimmer-text">Tu año en Dreitz</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8"
        >
          <BigStat icon={<ShoppingBag />} value={formatPrice(data.total_spent)} label="Gastado" tone="cyan" />
          <BigStat icon={<Award />} value={data.games_acquired} label="Juegos adquiridos" tone="yellow" />
          <BigStat icon={<Sparkles />} value={data.reviews_written} label="Reseñas escritas" tone="purple" />
          <BigStat icon={<Heart />} value={data.wishlist_added} label="A deseados" tone="pink" />
        </motion.div>

        {data.most_expensive && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-fg-subtle font-bold mb-2">Tu compra más grande</div>
            <div className="text-3xl font-extrabold mb-1">{data.most_expensive.title}</div>
            <div className="text-xl text-yellow-400 font-bold">{formatPrice(data.most_expensive.price)}</div>
          </motion.div>
        )}

        {data.top_genres.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-6">
            <h3 className="text-xs uppercase tracking-widest text-fg-subtle font-bold mb-4 text-center">Tus géneros favoritos</h3>
            <div className="space-y-2">
              {data.top_genres.map((g, i) => (
                <div key={g.genre} className="flex items-center gap-3">
                  <span className="text-2xl font-extrabold w-8 text-fg-subtle">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-lg font-bold">{g.genre}</div>
                    <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                        style={{ width: `${(g.count / data.top_genres[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-fg-muted text-sm">{g.count} juegos</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="card p-6">
          <h3 className="text-xs uppercase tracking-widest text-fg-subtle font-bold mb-4 text-center flex items-center justify-center gap-1.5">
            <Calendar size={12} /> Tu año mes a mes
          </h3>
          <div className="grid grid-cols-12 gap-1 h-40 items-end">
            {data.monthly.map((m) => {
              const h = Math.max(2, (m.revenue / maxMonth) * 100);
              return (
                <div key={m.month} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${h}%`,
                      background: m === peak ? 'linear-gradient(180deg, #fde047, #f59e0b)' : 'linear-gradient(180deg, var(--accent), var(--accent-hover))'
                    }}
                    title={`${formatPrice(m.revenue)} · ${m.orders} pedidos`}
                  />
                  <div className="text-[10px] text-fg-subtle">{MONTH_LABEL[m.month - 1]}</div>
                </div>
              );
            })}
          </div>
          {peak.revenue > 0 && (
            <div className="text-center text-xs text-fg-muted mt-3 flex items-center justify-center gap-1.5">
              <TrendingUp size={12} className="text-yellow-400" />
              Tu mes top fue <span className="text-yellow-400 font-bold mx-1">{MONTH_LABEL[peak.month - 1]}</span>
              con {formatPrice(peak.revenue)} en compras.
            </div>
          )}
        </motion.div>

        <div className="text-center text-xs text-fg-subtle pt-4">
          ¿Querés que tu próximo año se vea aún mejor? Sigue jugando y comprando con Dreitz 💚
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  cyan: 'text-cyan-300 bg-cyan-500/10',
  yellow: 'text-yellow-300 bg-yellow-500/10',
  purple: 'text-purple-300 bg-purple-500/10',
  pink: 'text-pink-300 bg-pink-500/10'
};

function BigStat({ icon, value, label, tone }: { icon: React.ReactNode; value: any; label: string; tone: keyof typeof TONE }) {
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-3 ${TONE[tone]}`}>{icon}</div>
      <div className="text-3xl font-extrabold mb-0.5">{value}</div>
      <div className="text-[11px] text-fg-muted uppercase tracking-widest font-bold">{label}</div>
    </div>
  );
}
