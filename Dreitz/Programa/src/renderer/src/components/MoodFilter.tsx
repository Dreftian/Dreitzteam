import { motion } from 'framer-motion';
import { Coffee, Zap, Users, BookOpen, Brain, Swords, Compass, Sparkles, type LucideIcon } from 'lucide-react';

/**
 * MoodFilter — pills de "estado de ánimo" que mapean a géneros Steam.
 * Permite discovery natural ("¿qué me apetece HOY?") vs filtros rígidos por género.
 *
 * Cada mood mapea a un conjunto de géneros/etiquetas; la página llama
 * `onMoodChange(genres)` con el array de géneros a filtrar.
 *
 * Diseño: row horizontal de pills colorizadas, scrollable en mobile.
 */

export interface Mood {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  genres: string[];
  description: string;
}

export const MOODS: Mood[] = [
  {
    key: 'relax',
    label: 'Relajante',
    icon: Coffee,
    color: '#5eead4',
    genres: ['Casual', 'Simulation', 'Indie', 'Adventure'],
    description: 'Juegos chill para desconectar'
  },
  {
    key: 'intense',
    label: 'Intenso',
    icon: Zap,
    color: '#f97316',
    genres: ['Action', 'Shooter', 'FPS', 'Racing'],
    description: 'Adrenalina pura'
  },
  {
    key: 'coop',
    label: 'Con amigos',
    icon: Users,
    color: '#a855ff',
    genres: ['Co-op', 'Multiplayer', 'Online Co-Op', 'Party'],
    description: 'Para jugar con amigos'
  },
  {
    key: 'story',
    label: 'Historia',
    icon: BookOpen,
    color: '#fb7185',
    genres: ['RPG', 'Adventure', 'Story Rich', 'Narrative'],
    description: 'Cuando quieres una buena historia'
  },
  {
    key: 'puzzle',
    label: 'Mente',
    icon: Brain,
    color: '#22d3ee',
    genres: ['Puzzle', 'Strategy', 'Turn-Based', 'Logic'],
    description: 'Estrategia y resolución'
  },
  {
    key: 'action',
    label: 'Acción rápida',
    icon: Swords,
    color: '#ef4444',
    genres: ['Action', 'Hack and Slash', 'Souls-like', 'Beat \'em up'],
    description: 'Combate sin parar'
  },
  {
    key: 'explore',
    label: 'Explorar',
    icon: Compass,
    color: '#0284c7',
    genres: ['Open World', 'Sandbox', 'Survival', 'Exploration'],
    description: 'Mundos enormes para perderte'
  }
];

export default function MoodFilter({
  active,
  onChange
}: {
  active: string | null;
  onChange: (mood: Mood | null) => void;
}) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2 flex items-center gap-1.5">
        <Sparkles size={12} className="text-yellow-400" /> ¿Qué te apetece hoy?
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => onChange(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            !active
              ? 'bg-accent/15 border-accent/40 text-accent'
              : 'bg-bg-card border-border text-fg-muted hover:bg-bg-hover'
          }`}
        >
          Todo
        </button>
        {MOODS.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.key;
          return (
            <motion.button
              key={m.key}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(isActive ? null : m)}
              title={m.description}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'text-white border-transparent'
                  : 'bg-bg-card border-border text-fg-muted hover:bg-bg-hover'
              }`}
              style={isActive ? {
                background: m.color,
                boxShadow: `0 6px 18px -6px ${m.color}99`
              } : undefined}
            >
              <Icon size={12} style={{ color: isActive ? 'white' : m.color }} />
              {m.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
