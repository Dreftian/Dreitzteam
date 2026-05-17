/**
 * Ilustraciones SVG inline para empty states.
 *
 * Diseñadas con la paleta de marca (cyan + purple + accent dorado). Cada una
 * cuenta una "historia visual" relevante al contexto (no son iconos genéricos).
 *
 * Uso:
 *   import { IllustrationCart } from '../components/Illustrations';
 *   <IllustrationCart className="w-44 mx-auto mb-4" />
 *
 * Todas usan currentColor para la base + sus propios gradients para el detalle,
 * así heredan el modo light/dark sin código adicional.
 */

import { type CSSProperties } from 'react';

interface BaseProps { className?: string; style?: CSSProperties; }

/** 🛒 Carrito vacío con sparkles flotantes */
export function IllustrationCart({ className = '', style }: BaseProps) {
  return (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id="ill-cart-bag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25"/>
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.08"/>
        </linearGradient>
        <linearGradient id="ill-cart-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)"/>
          <stop offset="1" stopColor="#a855ff"/>
        </linearGradient>
      </defs>
      {/* Bag body */}
      <path d="M 60 70 L 70 160 Q 70 168 78 168 L 142 168 Q 150 168 150 160 L 160 70 Z"
        fill="url(#ill-cart-bag)" stroke="url(#ill-cart-stroke)" strokeWidth="3" strokeLinejoin="round"/>
      {/* Handles */}
      <path d="M 85 70 Q 85 35 110 35 Q 135 35 135 70" fill="none" stroke="url(#ill-cart-stroke)" strokeWidth="3" strokeLinecap="round"/>
      {/* Sparkles flotantes */}
      <g fill="#ffd500" opacity="0.85">
        <circle cx="40" cy="50" r="3"/>
        <circle cx="180" cy="40" r="2.5"/>
        <circle cx="195" cy="105" r="2"/>
        <circle cx="30" cy="120" r="2.5"/>
      </g>
      <g stroke="#ffd500" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <line x1="32" y1="42" x2="32" y2="58"/>
        <line x1="24" y1="50" x2="40" y2="50"/>
        <line x1="172" y1="32" x2="172" y2="48"/>
        <line x1="164" y1="40" x2="180" y2="40"/>
      </g>
    </svg>
  );
}

/** 💖 Wishlist — corazones flotando en una constelación */
export function IllustrationWishlist({ className = '', style }: BaseProps) {
  return (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id="ill-wish-heart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ec4899"/>
          <stop offset="1" stopColor="#a855ff"/>
        </linearGradient>
      </defs>
      {/* Corazón grande central */}
      <path d="M 110 130 C 50 95 70 50 95 60 Q 110 65 110 80 Q 110 65 125 60 C 150 50 170 95 110 130 Z"
        fill="url(#ill-wish-heart)" opacity="0.85"/>
      {/* Corazones secundarios */}
      <g fill="#ec4899" opacity="0.45">
        <path d="M 45 70 C 25 55 35 35 47 40 Q 55 43 55 50 Q 55 43 63 40 C 75 35 85 55 55 70 Z"/>
        <path d="M 175 55 C 160 42 170 26 178 30 Q 185 32 185 38 Q 185 32 192 30 C 200 26 210 42 185 55 Z"/>
      </g>
      {/* Líneas conectoras (constelación) */}
      <g stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" fill="none">
        <line x1="55" y1="55" x2="100" y2="85"/>
        <line x1="185" y1="42" x2="120" y2="85"/>
      </g>
    </svg>
  );
}

/** 🎮 Library vacía — controlador de videojuego */
export function IllustrationLibrary({ className = '', style }: BaseProps) {
  return (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id="ill-lib-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface-3)"/>
          <stop offset="1" stopColor="var(--surface-1)"/>
        </linearGradient>
      </defs>
      {/* Controlador */}
      <path d="M 30 80 Q 30 60 55 60 L 165 60 Q 190 60 190 80 L 190 120 Q 190 140 170 140 L 145 140 Q 135 140 130 132 Q 125 124 110 124 Q 95 124 90 132 Q 85 140 75 140 L 50 140 Q 30 140 30 120 Z"
        fill="url(#ill-lib-body)" stroke="var(--accent)" strokeWidth="2.5"/>
      {/* D-pad */}
      <g fill="var(--accent)">
        <rect x="48" y="92" width="20" height="6" rx="2"/>
        <rect x="55" y="85" width="6" height="20" rx="2"/>
      </g>
      {/* Botones */}
      <g>
        <circle cx="148" cy="88" r="5" fill="#ffd500"/>
        <circle cx="166" cy="98" r="5" fill="#ec4899"/>
        <circle cx="148" cy="108" r="5" fill="#22d3ee"/>
        <circle cx="130" cy="98" r="5" fill="#a855ff"/>
      </g>
      {/* Joystick líneas decorativas */}
      <circle cx="80" cy="115" r="6" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5"/>
      {/* Sparkles arriba */}
      <g fill="var(--accent)" opacity="0.6">
        <circle cx="40" cy="40" r="2"/>
        <circle cx="195" cy="35" r="2.5"/>
        <circle cx="110" cy="25" r="3"/>
      </g>
    </svg>
  );
}

/** 👥 Friends — dos personas conectándose */
export function IllustrationFriends({ className = '', style }: BaseProps) {
  return (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id="ill-friends-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00d4ff"/><stop offset="1" stopColor="#0284c7"/>
        </linearGradient>
        <linearGradient id="ill-friends-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ec4899"/><stop offset="1" stopColor="#a855ff"/>
        </linearGradient>
      </defs>
      {/* Persona 1 (izquierda) */}
      <circle cx="70" cy="60" r="22" fill="url(#ill-friends-1)"/>
      <path d="M 35 140 Q 35 100 70 100 Q 105 100 105 140 L 105 160 L 35 160 Z" fill="url(#ill-friends-1)"/>
      {/* Persona 2 (derecha) */}
      <circle cx="150" cy="60" r="22" fill="url(#ill-friends-2)"/>
      <path d="M 115 140 Q 115 100 150 100 Q 185 100 185 140 L 185 160 L 115 160 Z" fill="url(#ill-friends-2)"/>
      {/* Línea de conexión + nodo central */}
      <line x1="95" y1="70" x2="125" y2="70" stroke="#ffd500" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 3"/>
      <circle cx="110" cy="70" r="6" fill="#ffd500"/>
      <path d="M 107 70 L 109.5 73 L 113 67" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 🔍 Sin resultados — lupa con un signo de interrogación */
export function IllustrationSearchEmpty({ className = '', style }: BaseProps) {
  return (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <radialGradient id="ill-search-lens" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.2"/>
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.05"/>
        </radialGradient>
      </defs>
      {/* Lente */}
      <circle cx="95" cy="80" r="48" fill="url(#ill-search-lens)" stroke="var(--accent)" strokeWidth="4"/>
      {/* Mango */}
      <line x1="130" y1="115" x2="170" y2="155" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"/>
      {/* Signo de pregunta dentro */}
      <text x="95" y="95" textAnchor="middle" fontSize="46" fontWeight="800" fill="var(--accent)" fontFamily="system-ui">?</text>
    </svg>
  );
}

/** 🔌 Sin conexión / Error genérico — enchufe desconectado */
export function IllustrationError({ className = '', style }: BaseProps) {
  return (
    <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <defs>
        <linearGradient id="ill-err-plug" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef4444"/>
          <stop offset="1" stopColor="#a855ff"/>
        </linearGradient>
      </defs>
      {/* Plug body */}
      <rect x="60" y="60" width="50" height="60" rx="6" fill="url(#ill-err-plug)"/>
      <rect x="70" y="50" width="6" height="12" fill="url(#ill-err-plug)"/>
      <rect x="94" y="50" width="6" height="12" fill="url(#ill-err-plug)"/>
      {/* Outlet (separado por desconexión) */}
      <rect x="140" y="65" width="50" height="50" rx="6" fill="var(--surface-3)" stroke="var(--text-muted)" strokeWidth="2"/>
      <circle cx="155" cy="80" r="3" fill="var(--text-muted)"/>
      <circle cx="175" cy="80" r="3" fill="var(--text-muted)"/>
      <rect x="153" y="92" width="24" height="6" rx="2" fill="var(--text-muted)"/>
      {/* Spark gap */}
      <g stroke="#ffd500" strokeWidth="2" strokeLinecap="round">
        <line x1="115" y1="80" x2="125" y2="75"/>
        <line x1="115" y1="90" x2="125" y2="95"/>
        <line x1="120" y1="85" x2="130" y2="85"/>
      </g>
      {/* Sad face on plug */}
      <g fill="white">
        <circle cx="75" cy="85" r="2.5"/>
        <circle cx="95" cy="85" r="2.5"/>
      </g>
      <path d="M 73 102 Q 85 95 97 102" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}
