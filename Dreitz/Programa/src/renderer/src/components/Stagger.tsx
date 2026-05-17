import { motion, type Variants } from 'framer-motion';
import { type ReactNode, Children } from 'react';

/**
 * Wrapper que aplica un stagger cascade sobre todos sus children. Cada hijo
 * aparece con un pequeño delay incremental — sensación "alive" sin overhead.
 *
 * Uso:
 *   <Stagger as="div" className="grid grid-cols-3 gap-4" delay={0.04}>
 *     {games.map(g => <GameCard key={g.id} game={g} />)}
 *   </Stagger>
 *
 * Respeta `reduce-motion` (saltea las animaciones).
 */

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } }
};

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  initialDelay?: number;
}

export default function Stagger({ children, className, delay = 0.04, initialDelay = 0 }: Props) {
  const items = Children.toArray(children);
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: delay, delayChildren: initialDelay } } }}
    >
      {items.map((child, i) => (
        <motion.div key={(child as any).key ?? i} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
