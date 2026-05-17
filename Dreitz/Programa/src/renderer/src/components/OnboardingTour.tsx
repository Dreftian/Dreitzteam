import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart, ShoppingCart, Layers, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../lib/i18n';

/**
 * Tour de bienvenida de 4 pasos — solo aparece la primera vez que un usuario
 * entra al launcher. Cada paso explica un feature clave:
 *   1. Mood filter en la tienda
 *   2. Wishlist con alertas de precio
 *   3. Yape para checkout local
 *   4. Estantes de biblioteca
 *
 * Una vez completado, marca `onboarding_seen=1` en `user_settings`.
 */

interface Paso {
  icon: typeof Sparkles;
  color: string;
  titulo: string;
  cuerpo: string;
}

export default function OnboardingTour() {
  const { user } = useAuth();
  const { t: _t } = useI18n(); // reservado para i18n futuro
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState(0);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    window.api.settingsGet?.(user.id).then((s: any) => {
      if (cancelled) return;
      if (!s || !s.onboarding_seen) {
        setSeen(false);
        setOpen(true);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const pasos: Paso[] = [
    {
      icon: Sparkles,
      color: '#22d3ee',
      titulo: '¿Qué te apetece hoy?',
      cuerpo: 'En la tienda, usa los pills de mood ("Relajante", "Intenso", "Historia"…) para filtrar el catálogo según cómo te sientes. Cada mood mapea a varios géneros — discovery natural en vez de filtros rígidos.'
    },
    {
      icon: Heart,
      color: '#ff3aa6',
      titulo: 'Wishlist con alertas',
      cuerpo: 'Marca cualquier juego con el corazón y entra en tu lista de deseados. Si baja de precio, Dreitz te avisa con una notificación nativa de Windows — sin que tengas que estar revisando.'
    },
    {
      icon: ShoppingCart,
      color: '#fde047',
      titulo: 'Checkout con Yape',
      cuerpo: 'Comprar es directo: tarjeta o Yape (sube screenshot del Yape, una IA verifica el monto y se acredita en segundos). Sin redirects a webs externas, sin comisiones de pasarela.'
    },
    {
      icon: Layers,
      color: '#a855ff',
      titulo: 'Estantes en tu biblioteca',
      cuerpo: 'En Biblioteca, crea estantes ("Para terminar", "Co-op con amigos", "Favoritos"…) y arrastra juegos entre ellos. Organiza como en Steam pero sin los anuncios.'
    }
  ];

  const actual = pasos[paso];
  const esUltimo = paso === pasos.length - 1;

  async function marcarComoVisto() {
    if (!user) return;
    try { await window.api.settingsUpdate?.({ userId: user.id, key: 'onboarding_seen', value: 1 }); } catch {}
    setSeen(true);
    setOpen(false);
  }

  function siguiente() {
    if (esUltimo) marcarComoVisto();
    else setPaso(paso + 1);
  }

  if (seen || !open || !user) return null;
  const Icon = actual.icon;

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur flex items-center justify-center p-6"
      >
        <motion.div
          key={paso}
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          className="card max-w-md w-full p-8 relative overflow-hidden"
          style={{ boxShadow: `0 18px 60px -10px ${actual.color}55` }}
        >
          <button
            onClick={marcarComoVisto}
            className="absolute top-3 right-3 text-fg-subtle hover:text-fg p-1"
            title="Saltar"
          >
            <X size={16} />
          </button>

          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 pointer-events-none"
            style={{ background: actual.color, filter: 'blur(40px)' }}
          />

          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative"
            style={{ background: `${actual.color}22`, color: actual.color }}
          >
            <Icon size={26} />
          </div>

          <div className="text-[10px] uppercase tracking-widest text-fg-subtle font-semibold mb-1">
            Paso {paso + 1} de {pasos.length}
          </div>
          <h2 className="text-2xl font-extrabold mb-3">{actual.titulo}</h2>
          <p className="text-fg-muted text-sm leading-relaxed mb-6">{actual.cuerpo}</p>

          <div className="flex gap-1.5 mb-5">
            {pasos.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all"
                style={{
                  background: i <= paso ? actual.color : 'var(--surface-3)',
                  opacity: i === paso ? 1 : 0.45
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={marcarComoVisto} className="text-xs text-fg-subtle hover:text-fg">
              Saltar tour
            </button>
            <button
              onClick={siguiente}
              className="btn btn-primary text-sm flex items-center gap-2"
              style={{ background: actual.color, color: '#0a0e1a' }}
            >
              {esUltimo ? '¡Empezar!' : 'Siguiente'} <ArrowRight size={13} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
