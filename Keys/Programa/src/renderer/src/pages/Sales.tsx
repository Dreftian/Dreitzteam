import { Fragment, useEffect, useState } from 'react';
import type { Order } from '../lib/types';
import { formatDateTime, formatPrice } from '../lib/format';
import { ChevronDown, Download } from 'lucide-react';
import { downloadCsv } from '../lib/csv';
import { toast } from 'sonner';

export default function Sales() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, any[]>>({});

  useEffect(() => { window.api.ordersList().then(setOrders); }, []);

  async function toggle(id: number) {
    if (open === id) { setOpen(null); return; }
    if (!items[id]) {
      const list = await window.api.ordersItems(id);
      setItems((s) => ({ ...s, [id]: list }));
    }
    setOpen(id);
  }

  function exportCsv() {
    if (!orders.length) return;
    downloadCsv(`sales_${new Date().toISOString().slice(0, 10)}.csv`, orders, [
      'id', 'username', 'total', 'currency', 'payment_method', 'card_brand', 'card_last4', 'status', 'created_at'
    ]);
    toast.success('CSV descargado');
  }

  const totalRevenue = orders.reduce((s, o) => s + (o.status === 'paid' ? o.total : 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-3xl font-bold">Ventas</h2>
        <button onClick={exportCsv} className="btn btn-secondary text-sm" disabled={!orders.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">{orders.length} pedidos · Ingresos: <span className="text-fg font-semibold">{formatPrice(totalRevenue)}</span></p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-hover/40 border-b border-border">
            <tr className="text-left text-fg-muted">
              <th className="px-4 py-3 font-semibold">Pedido</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr className="hover:bg-bg-hover/30 cursor-pointer" onClick={() => toggle(o.id)}>
                  <td className="px-4 py-3 font-mono text-xs">#{o.id}</td>
                  <td className="px-4 py-3 font-semibold">{o.username}</td>
                  <td className="px-4 py-3 text-fg-muted text-xs">
                    {o.payment_method === 'card' ? `${o.card_brand} ··${o.card_last4}` : o.payment_method}
                  </td>
                  <td className="px-4 py-3 font-bold">{formatPrice(o.total, o.currency)}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-500/15 text-green-400">{o.status}</span></td>
                  <td className="px-4 py-3 text-xs text-fg-muted">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronDown size={14} className={`transition-transform ${open === o.id ? 'rotate-180' : ''}`} />
                  </td>
                </tr>
                {open === o.id && items[o.id] && (
                  <tr className="bg-bg-hover/20">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="space-y-2">
                        {items[o.id].map((it: any) => (
                          <div key={it.id} className="flex items-center gap-3 text-xs">
                            <span className="font-semibold flex-1">{it.title}</span>
                            <code className="font-mono px-2 py-0.5 rounded bg-bg-hover">{it.license_code}</code>
                            <span className="text-fg-muted">{formatPrice(it.price)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!orders.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-fg-muted">Aún no hay ventas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
