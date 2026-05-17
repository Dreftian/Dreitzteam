import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Rocket, Bell, Users, Trophy, Coins, Globe2, Gift, Layers, ChevronRight } from 'lucide-react';

interface ChangeItem {
  icon: any;
  title: string;
  body: string;
  tone?: 'cyan' | 'purple' | 'pink' | 'yellow' | 'green';
}

const VERSION = '1.1.0';
const STORAGE_KEY = 'dreitz.whatsNewSeen';

const CHANGES: ChangeItem[] = [
  { icon: Rocket, title: 'Nuevo diseño Steam-style', body: 'Sidebar minimalista, menú de usuario top-right, mega-menú con bundles y promociones.', tone: 'cyan' },
  { icon: Bell, title: 'Notificaciones en vivo', body: 'Bell con badge para bajadas de precio, solicitudes de amistad y misiones completadas.', tone: 'pink' },
  { icon: Users, title: 'Panel de amigos lateral', body: 'Toggle al estilo Discord para ver quién está conectado y qué juega ahora mismo.', tone: 'cyan' },
  { icon: Trophy, title: 'Misiones diarias', body: 'Tres retos por día — completalos para ganar puntos. Se renuevan a la medianoche.', tone: 'yellow' },
  { icon: Coins, title: 'Sistema de niveles', body: 'Bronze · Silver · Gold · Platinum — más cashback y colores de acento exclusivos.', tone: 'purple' },
  { icon: Layers, title: 'Catálogo en grid 6×6', body: 'Tienda con tabs Catálogo / Destacados. Vista paginada para que no scrollees al infinito.', tone: 'green' },
  { icon: Globe2, title: 'Multi-idioma + multi-moneda', body: 'Español (LA / España), Inglés y Portugués. Cambia moneda PEN/USD/BRL/ARS/MXN/EUR.', tone: 'cyan' },
  { icon: Gift, title: 'Tarjetas de regalo + referidos', body: 'Comparte tu código y ambos ganan puntos. Compra tarjetas para regalar saldo.', tone: 'pink' }
];

export default function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== VERSION) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    localStorage.setItem(STORAGE_KEY, VERSION);
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="card max-w-2xl w-full relative overflow-hidden"
            initial={{ scale: 0.94, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-0.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />
            <button onClick={close} className="absolute top-3 right-3 w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center text-fg-muted z-10">
              <X size={15} />
            </button>

            <div className="p-7 text-center border-b border-border bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-bold tracking-widest mb-3">
                <Sparkles size={11} /> NOVEDADES · v{VERSION}
              </div>
              <h2 className="text-3xl font-extrabold mb-1">¡Hay cosas nuevas en Dreitz!</h2>
              <p className="text-sm text-fg-muted">Esto es lo que cambió desde la última vez que abriste el launcher.</p>
            </div>

            <div className="p-5 max-h-[55vh] overflow-y-auto thin-scrollbar grid sm:grid-cols-2 gap-3">
              {CHANGES.map((c, i) => {
                const Icon = c.icon;
                const tone = c.tone ?? 'cyan';
                const TONE_CLS: Record<string, string> = {
                  cyan: 'text-cyan-400 bg-cyan-500/10',
                  purple: 'text-purple-400 bg-purple-500/10',
                  pink: 'text-pink-400 bg-pink-500/10',
                  yellow: 'text-yellow-400 bg-yellow-500/10',
                  green: 'text-green-400 bg-green-500/10'
                };
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex gap-3 p-3 rounded-md bg-bg-hover/40 hover:bg-bg-hover transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${TONE_CLS[tone]}`}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{c.title}</div>
                      <div className="text-xs text-fg-muted leading-snug">{c.body}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-fg-subtle">Pulsa <kbd className="px-1.5 py-0.5 rounded bg-bg-hover">?</kbd> para ver atajos</span>
              <button onClick={close} className="btn btn-primary text-sm">
                ¡Genial, vamos! <ChevronRight size={14} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
