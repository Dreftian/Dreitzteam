import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingCart, Bell, Gift, Eye, EyeOff, Share2, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Game } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { toast } from 'sonner';

/**
 * Right-click context menu para GameCards.
 *
 * Patrón estilo Steam — acciones rápidas sin entrar al detalle:
 *   - Añadir al carrito / wishlist
 *   - Configurar alerta de precio
 *   - Regalar (P2P si lo tienes en biblioteca)
 *   - Compartir (Steam URL)
 *   - Abrir página de Steam
 *
 * Uso:
 *   <ContextMenuTarget game={g}><GameCard ... /></ContextMenuTarget>
 */

interface MenuPos { x: number; y: number }

export function ContextMenuTarget({ game, children }: { game: Game; children: ReactNode }) {
  const [pos, setPos] = useState<MenuPos | null>(null);
  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {children}
      </div>
      <GameContextMenu game={game} pos={pos} onClose={() => setPos(null)} />
    </>
  );
}

function GameContextMenu({ game, pos, onClose }: { game: Game; pos: MenuPos | null; onClose: () => void }) {
  const { user } = useAuth();
  const { add, has } = useCart();
  const { openCart } = useUi();
  const nav = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pos, onClose]);

  if (!pos) return null;

  // Reposición si el menú se saldría del viewport
  const W = 220, H = 320;
  const x = Math.min(pos.x, window.innerWidth - W - 12);
  const y = Math.min(pos.y, window.innerHeight - H - 12);

  const inCart = has(game.id);

  async function addToWishlist() {
    if (!user) { toast.error('Inicia sesión'); return; }
    try {
      await window.api.wishlistToggle({ userId: user.id, gameId: game.id });
      toast.success(`${game.title} guardado en deseos`);
    } catch (e) { toast.error((e as Error).message); }
    onClose();
  }

  function addToCartAndClose() {
    if (game.is_preorder) { toast.info('Pre-orden: usa "Reservar" desde el detalle'); return; }
    add({
      gameId: game.id,
      title: game.title,
      capsule_image: game.capsule_image,
      header_image: game.header_image,
      price: game.price_final
    } as any);
    onClose();
  }

  function shareSteam() {
    if (!game.steam_app_id) { toast.info('Este juego no tiene página Steam'); return; }
    const url = `https://store.steampowered.com/app/${game.steam_app_id}/`;
    navigator.clipboard.writeText(url);
    toast.success('Link Steam copiado');
    onClose();
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="ctx-menu"
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        className="fixed z-[100] card p-1.5 min-w-[220px]"
        style={{ left: x, top: y, boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="px-3 py-2 border-b border-border mb-1">
          <div className="text-xs text-fg-subtle mb-0.5">Juego</div>
          <div className="text-sm font-bold truncate">{game.title}</div>
        </div>

        <MenuItem
          icon={inCart ? <ShoppingCart size={14} className="text-green-400" /> : <ShoppingCart size={14} />}
          label={inCart ? 'En el carrito' : 'Añadir al carrito'}
          disabled={inCart || game.is_preorder}
          onClick={addToCartAndClose}
          shortcut="A"
        />
        {inCart && (
          <MenuItem icon={<Eye size={14} />} label="Ver carrito" onClick={() => { openCart(); onClose(); }} />
        )}
        <MenuItem icon={<Heart size={14} />} label="Añadir a deseos" onClick={addToWishlist} shortcut="W" />
        <MenuItem
          icon={<Bell size={14} />}
          label="Configurar alerta de precio"
          onClick={() => { nav(`/game/${game.id}#price-alert`); onClose(); }}
        />
        <MenuItem
          icon={<Gift size={14} />}
          label="Regalar (si lo tienes)"
          onClick={() => { nav(`/library?gift=${game.id}`); onClose(); }}
        />
        <div className="h-px bg-border my-1" />
        <MenuItem icon={<Eye size={14} />} label="Ver detalle" onClick={() => { nav(`/game/${game.id}`); onClose(); }} />
        <MenuItem icon={<Share2 size={14} />} label="Copiar link Steam" onClick={shareSteam} />
        <MenuItem
          icon={<ExternalLink size={14} />}
          label="Abrir en Steam"
          onClick={() => {
            if (game.steam_app_id) window.open(`https://store.steampowered.com/app/${game.steam_app_id}/`, '_blank');
            onClose();
          }}
          disabled={!game.steam_app_id}
        />
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function MenuItem({
  icon, label, onClick, disabled, shortcut
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 px-3 py-1.5 rounded text-sm
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-hover cursor-pointer'}`}
    >
      <span className="text-fg-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-fg-subtle">{shortcut}</kbd>}
    </button>
  );
}
