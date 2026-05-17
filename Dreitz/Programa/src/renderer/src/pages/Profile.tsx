import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Crown, ShoppingBag, Calendar, Award, Library as LibIcon, Heart, BookOpen, Pencil, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatPrice } from '../lib/format';
import type { Order, ProfileStats } from '../lib/types';
import AchievementsList from '../components/AchievementsList';
import ActivityFeed from '../components/ActivityFeed';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';
import { useI18n } from '../lib/i18n';

export default function Profile() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gameImageMap, setGameImageMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!user) return;
    window.api.ordersList(user.id).then(setOrders);
    window.api.achievementsProfileStats(user.id).then(setStats);
    window.api.libraryList(user.id).then((games: any[]) => {
      const m: Record<number, string> = {};
      for (const g of games) m[g.id] = g.capsule_image || g.header_image;
      setGameImageMap(m);
    });
  }, [user?.id]);

  if (!user) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="card p-6 mb-6 flex items-center gap-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <button
          onClick={() => setPickerOpen(true)}
          className="relative group"
          title="Cambiar avatar"
        >
          <Avatar user={user} size={84} gameImageMap={gameImageMap} className="ring-2 ring-border group-hover:ring-accent transition-all" />
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-white rounded-full w-9 h-9 flex items-center justify-center">
              <Pencil size={14} />
            </span>
          </div>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{user.username}</h2>
            {user.is_pro && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                <Crown size={11} /> PRO
              </span>
            )}
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">ADMIN</span>
            )}
          </div>
          <div className="text-sm text-fg-muted">{user.email ?? 'Sin correo registrado'}</div>
          <div className="text-xs text-fg-subtle mt-1">Miembro desde {formatDate(user.created_at)}</div>
        </div>
        <Link
          to="/profile/edit"
          className="btn btn-secondary text-xs flex items-center gap-1.5 shrink-0"
          title="Personalizar banner, marco y bio"
        >
          <Sparkles size={13} className="text-cyan-400" /> Editar perfil
        </Link>
      </div>

      {stats && (
        <section className="mb-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><BookOpen size={17} /> {t('profile.stats')}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile icon={<LibIcon size={18} />} value={stats.games} label="Juegos" tone="cyan" />
            <StatTile icon={<ShoppingBag size={18} />} value={formatPrice(stats.total_spent)} label="Total gastado" tone="purple" />
            <StatTile icon={<Award size={18} />} value={`${stats.unlocked} / ${stats.total_achievements}`} label="Logros" tone="yellow" />
            <StatTile icon={<Heart size={18} />} value={stats.wishlist} label="En deseados" tone="pink" />
            <StatTile icon={<Calendar size={18} />} value={stats.redeemed} label="Canjeadas" tone="green" />
          </div>
        </section>
      )}

      {user.is_pro && user.pro_expires_at && (
        <div className="card p-5 mb-6 pro-glass">
          <div className="flex items-center gap-3">
            <Crown className="text-yellow-400" />
            <div className="flex-1">
              <div className="font-semibold">Suscripción Pro activa</div>
              <div className="text-sm text-fg-muted">
                Plan {user.pro_plan === 'monthly' ? 'mensual' : 'anual'} · vence el {formatDate(user.pro_expires_at)}
              </div>
            </div>
            <a href="#/pro" className="btn btn-secondary text-xs">Gestionar</a>
          </div>
        </div>
      )}

      <section className="mb-8">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Award size={17} /> {t('profile.achievements')}</h3>
        <AchievementsList />
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-bold mb-3">{t('profile.activity')}</h3>
        <ActivityFeed limit={8} />
      </section>

      <section>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <ShoppingBag size={17} /> {t('profile.history')}
        </h3>
        {!orders.length ? (
          <div className="card p-8 text-center text-fg-muted">{t('profile.no_orders')}</div>
        ) : (
          <div className="card divide-y divide-border">
            {orders.map((o) => (
              <div key={o.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-bg-hover flex items-center justify-center text-fg-muted">
                  <Calendar size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Pedido #{o.id}</div>
                  <div className="text-xs text-fg-subtle">
                    {formatDate(o.created_at)} · {o.payment_method === 'card' ? `${o.card_brand} ··${o.card_last4}` : o.payment_method}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatPrice(o.total, o.currency)}</div>
                  <div className="text-[10px] uppercase font-semibold text-green-400">{o.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pickerOpen && <AvatarPicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  cyan: 'text-cyan-400 bg-cyan-500/10',
  purple: 'text-purple-400 bg-purple-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  pink: 'text-pink-400 bg-pink-500/10',
  green: 'text-green-400 bg-green-500/10'
};

function StatTile({ icon, value, label, tone }: { icon: React.ReactNode; value: any; label: string; tone: keyof typeof TONE_CLASS }) {
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 rounded-md flex items-center justify-center mb-2 ${TONE_CLASS[tone]}`}>{icon}</div>
      <div className="text-xl font-extrabold leading-tight">{value}</div>
      <div className="text-[11px] text-fg-muted">{label}</div>
    </div>
  );
}
