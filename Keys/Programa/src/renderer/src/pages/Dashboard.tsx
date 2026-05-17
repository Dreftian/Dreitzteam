import { useEffect, useState } from 'react';
import type { Stats, RevenuePoint, TopGame, UserBreakdown } from '../lib/types';
import { Users, Gamepad2, Key, ShoppingBag, DollarSign, Crown, TrendingUp, Activity, Heart, Gift, Megaphone, RotateCcw } from 'lucide-react';
import { formatPrice } from '../lib/format';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const PIE_COLORS = ['#00d4ff', '#a855ff', '#38e07b', '#ffa632', '#ff3aa6'];

interface ExtraStats extends Stats {
  gift_cards_sold?: number;
  promotions_active?: number;
  refunds_pending?: number;
}

interface HeatmapItem {
  id: number;
  title: string;
  capsule_image: string;
  header_image: string;
  price_final: number;
  discount_percent: number;
  wishes: number;
  available_stock: number;
}

interface Funnel {
  views: number;
  cart: number;
  checkouts: number;
  purchases: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<ExtraStats | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topGames, setTopGames] = useState<TopGame[]>([]);
  const [usersBreak, setUsersBreak] = useState<UserBreakdown | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<{ status: string; c: number }[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapItem[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);

  async function load() {
    const [s, r, t, u, l, h, f] = await Promise.all([
      window.api.statsSummary(),
      window.api.statsRevenueByDay(14),
      window.api.statsTopGames(6),
      window.api.statsUserBreakdown(),
      window.api.statsLicenseStatusBreakdown(),
      window.api.statsWishlistHeatmap(),
      window.api.statsFunnel()
    ]);
    setStats(s); setRevenue(r); setTopGames(t); setUsersBreak(u); setLicenseStatus(l); setHeatmap(h); setFunnel(f);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return <div className="p-10 text-fg-muted">Cargando estadísticas...</div>;

  const cards = [
    { icon: Users, label: 'Usuarios', value: stats.users, color: 'cyan' },
    { icon: Crown, label: 'Pro', value: stats.pro, color: 'yellow' },
    { icon: Gamepad2, label: 'Juegos', value: stats.games, color: 'purple' },
    { icon: Key, label: 'Licencias disponibles', value: stats.licenses.available, color: 'green' },
    { icon: ShoppingBag, label: 'Pedidos', value: stats.orders, color: 'pink' },
    { icon: DollarSign, label: 'Ingresos', value: formatPrice(stats.revenue), color: 'orange' },
    { icon: Megaphone, label: 'Promociones activas', value: stats.promotions_active ?? 0, color: 'cyan' },
    { icon: Gift, label: 'Tarjetas vendidas', value: stats.gift_cards_sold ?? 0, color: 'pink' },
    { icon: RotateCcw, label: 'Reembolsos pendientes', value: stats.refunds_pending ?? 0, color: 'orange' }
  ];

  const userPie = usersBreak ? [
    { name: 'Pro', value: usersBreak.pro },
    { name: 'Estándar', value: usersBreak.free }
  ] : [];

  const licensePie = licenseStatus.map((l) => ({ name: l.status, value: l.c }));

  const conversionPct = funnel && funnel.views > 0 ? +((funnel.purchases / funnel.views) * 100).toFixed(2) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-1">Dashboard</h2>
      <p className="text-fg-muted text-sm mb-8">Resumen en tiempo real · se actualiza cada 8s.</p>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 relative overflow-hidden">
            <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-${color}-500/10 blur-2xl pointer-events-none`} />
            <Icon className={`text-${color}-400 mb-2`} size={20} />
            <div className="text-2xl font-extrabold mb-0.5">{value}</div>
            <div className="text-[11px] text-fg-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp size={17} className="text-cyan-400" /> Ingresos · últimos 14 días</h3>
          {revenue.some((r) => r.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenue} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatPrice(v)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex flex-col items-center justify-center text-sm text-fg-muted">
              <Activity size={28} className="mb-2 opacity-50" />
              Aún no hay ventas en los últimos 14 días.
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold mb-3">Distribución usuarios</h3>
          {usersBreak && usersBreak.total > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={userPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {userPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-fg-muted">Sin datos suficientes</div>
          )}
          <div className="flex justify-around text-xs mt-2 text-fg-muted">
            <span>{usersBreak?.total ?? 0} totales</span>
            <span className="text-cyan-300">{usersBreak?.active ?? 0} activos 24h</span>
          </div>
        </div>
      </div>

      {funnel && (
        <div className="card p-5 mb-6">
          <h3 className="font-bold mb-3">Embudo de conversión · últimos 7 días</h3>
          <div className="grid grid-cols-4 gap-3">
            <Funnel label="Vistas" value={funnel.views} color="cyan" pct={100} />
            <Funnel label="Añadir al carrito" value={funnel.cart} color="purple" pct={funnel.views ? (funnel.cart / funnel.views) * 100 : 0} />
            <Funnel label="Checkout" value={funnel.checkouts} color="orange" pct={funnel.views ? (funnel.checkouts / funnel.views) * 100 : 0} />
            <Funnel label="Compras" value={funnel.purchases} color="green" pct={funnel.views ? (funnel.purchases / funnel.views) * 100 : 0} />
          </div>
          <div className="mt-3 text-xs text-fg-muted">
            Tasa de conversión global: <span className="text-fg font-bold">{conversionPct}%</span>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold mb-3">Juegos más vendidos</h3>
          {topGames.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topGames} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="title" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} tickFormatter={(t: string) => t.length > 14 ? t.slice(0, 12) + '…' : t} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="units" fill="#a855ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-fg-muted">Aún no hay ventas registradas.</div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold mb-3">Estado de licencias</h3>
          {licensePie.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={licensePie} dataKey="value" nameKey="name" outerRadius={80}>
                  {licensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-fg-muted">Sin datos</div>
          )}
        </div>
      </div>

      {heatmap.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Heart size={16} className="text-pink-400" /> Top juegos en wishlists</h3>
          <p className="text-xs text-fg-muted mb-3">Lo que más quiere la gente · ideal para decidir qué ofertar primero o reponer stock.</p>
          <div className="space-y-1">
            {heatmap.slice(0, 10).map((h) => {
              const maxWishes = heatmap[0]?.wishes ?? 1;
              const w = (h.wishes / maxWishes) * 100;
              return (
                <div key={h.id} className="flex items-center gap-3">
                  <img src={h.capsule_image || h.header_image} alt="" className="w-16 h-8 rounded object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{h.title}</div>
                    <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden mt-0.5">
                      <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-pink-400">{h.wishes}</div>
                    <div className="text-[10px] text-fg-subtle">{h.available_stock} stock</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-bold mb-2">Acceso rápido</h3>
        <div className="grid sm:grid-cols-4 gap-2">
          <a href="#/promotions" className="btn btn-secondary text-sm justify-start"><Megaphone size={16} /> Promociones</a>
          <a href="#/flash-sales" className="btn btn-secondary text-sm justify-start"><Activity size={16} /> Flash sales</a>
          <a href="#/refunds" className="btn btn-secondary text-sm justify-start"><RotateCcw size={16} /> Reembolsos</a>
          <a href="#/audit" className="btn btn-secondary text-sm justify-start"><Activity size={16} /> Audit log</a>
        </div>
      </div>
    </div>
  );
}

function Funnel({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-fg-muted mb-1">{label}</div>
      <div className={`text-3xl font-extrabold text-${color}-400`}>{value}</div>
      <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden mt-2">
        <div className={`h-full bg-${color}-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-fg-subtle mt-1">{pct.toFixed(1)}%</div>
    </div>
  );
}
