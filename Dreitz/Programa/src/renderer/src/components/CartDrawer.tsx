import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Trash2, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useUi } from '../contexts/UiContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useCachedImage } from '../lib/useCachedImage';
import { useMagnetic } from '../lib/useMagnetic';

/**
 * Cart drawer que se desliza desde la derecha. Lo abre cualquier botón
 * llamando `useUi().openCart()`. La página /cart sigue existiendo como fallback
 * (deep-link, navegación por teclado, etc.).
 */
export default function CartDrawer() {
  const { cartOpen, closeCart } = useUi();
  const { items, total, remove, clear } = useCart();
  const { format } = useCurrency();
  const nav = useNavigate();
  const checkoutBtnRef = useMagnetic({ radius: 130, strength: 0.16 });

  function goToCheckout() {
    closeCart();
    nav('/checkout');
  }

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.aside
            key="cart-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-elev shadow-2xl flex flex-col"
            style={{ borderLeft: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <ShoppingBag size={20} className="text-accent" />
                Carrito
                {items.length > 0 && (
                  <span className="text-xs text-fg-muted font-normal">({items.length})</span>
                )}
              </h2>
              <button
                onClick={closeCart}
                className="w-9 h-9 rounded-full hover:bg-bg-hover flex items-center justify-center text-fg-muted hover:text-fg"
                aria-label="Cerrar carrito"
              >
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="text-center py-20">
                  <ShoppingBag size={48} className="mx-auto mb-4 text-fg-subtle" strokeWidth={1.4} />
                  <p className="text-fg-muted text-sm mb-1">Tu carrito está vacío.</p>
                  <p className="text-fg-subtle text-xs mb-6">Explora la tienda y añade juegos.</p>
                  <Link onClick={closeCart} to="/store" className="btn btn-primary text-sm inline-flex items-center gap-2">
                    Ir a la tienda <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {items.map((it, i) => (
                    <CartRow key={it.gameId} item={it} onRemove={() => remove(it.gameId)} index={i} />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border p-5 space-y-3 bg-bg-base/50">
                <div className="flex items-center justify-between">
                  <span className="text-fg-muted text-sm">Subtotal</span>
                  <span className="text-2xl font-extrabold price-final">{format(total)}</span>
                </div>
                <button
                  ref={checkoutBtnRef as any}
                  onClick={goToCheckout}
                  className="magnetic btn btn-primary w-full justify-center flex items-center gap-2 py-3 text-base"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                    boxShadow: '0 10px 28px -10px color-mix(in srgb, var(--accent) 60%, transparent)'
                  }}
                >
                  Ir al checkout <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => { if (confirm('¿Vaciar carrito?')) clear(); }}
                  className="text-xs text-fg-subtle hover:text-red-400 flex items-center gap-1.5 mx-auto"
                >
                  <Trash2 size={11} /> Vaciar carrito
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function CartRow({ item, onRemove, index }: { item: any; onRemove: () => void; index: number }) {
  const { format } = useCurrency();
  const thumb = useCachedImage(item.capsule_image || item.header_image);
  return (
    <motion.li
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 320, damping: 26 }}
      className="card p-3 flex items-center gap-3 group"
    >
      {thumb && (
        <img src={thumb} alt="" className="w-20 aspect-[460/215] object-cover rounded shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <Link to={`/game/${item.gameId}`} className="font-semibold text-sm truncate block hover:text-accent">
          {item.title}
        </Link>
        <div className="text-xs price-final mt-0.5">{format(item.price)}</div>
      </div>
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 transition-all flex items-center justify-center"
        aria-label="Quitar del carrito"
      >
        <Trash2 size={14} />
      </button>
    </motion.li>
  );
}
