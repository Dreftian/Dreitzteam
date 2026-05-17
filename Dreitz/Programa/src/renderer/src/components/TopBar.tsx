import { Search, ShoppingCart, Heart, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useCart } from '../contexts/CartContext';
import { useUi } from '../contexts/UiContext';
import MegaMenu from './MegaMenu';
import NotificationBell from './NotificationBell';

/**
 * TopBar — el perfil de usuario se moví al header del Sidebar para darle más
 * jerarquía. Aquí queda la marca Dreitz a la izquierda, el menú de categorías,
 * la búsqueda, y las acciones de tienda (wishlist, carrito, amigos, notifs).
 */
export default function TopBar() {
  const { t } = useI18n();
  const { items: cart } = useCart();
  const { friendsRailOpen, toggleFriendsRail, openCart } = useUi();
  const [q, setQ] = useState('');
  const nav = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    nav(`/store?search=${encodeURIComponent(q)}`);
  }

  return (
    <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-bg-base/80 backdrop-blur-md relative z-40">
      {/* Branding Dreitz vive en el TitleBar (arriba). Aquí solo el menú de
          categorías + búsqueda + acciones para no duplicar. */}
      <MegaMenu />

      <form onSubmit={submit} className="flex-1 max-w-md relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none z-10" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('common.search')}
          style={{ paddingLeft: '2.5rem', paddingRight: '4rem' }}
          className="input py-2 text-sm"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-fg-subtle hidden md:inline-block">
          Ctrl K
        </kbd>
      </form>

      <div className="flex-1" />

      <Link
        to="/wishlist"
        title={t('nav.wishlist')}
        className="w-9 h-9 rounded-md hover:bg-bg-hover flex items-center justify-center text-fg-muted hover:text-pink-400 transition-colors"
      >
        <Heart size={16} />
      </Link>

      <button
        onClick={() => openCart()}
        title={t('nav.cart')}
        className="relative w-9 h-9 rounded-md hover:bg-bg-hover flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
      >
        <ShoppingCart size={16} />
        {cart.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
            {cart.length}
          </span>
        )}
      </button>

      <button
        onClick={toggleFriendsRail}
        title={friendsRailOpen ? 'Ocultar amigos' : 'Mostrar amigos'}
        className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${friendsRailOpen ? 'bg-bg-hover text-fg' : 'hover:bg-bg-hover text-fg-muted'}`}
      >
        <Users size={16} />
      </button>

      <NotificationBell />
    </header>
  );
}
