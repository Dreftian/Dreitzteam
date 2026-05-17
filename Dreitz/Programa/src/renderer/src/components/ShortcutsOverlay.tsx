import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../lib/i18n';

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], action: 'shortcuts.search' },
  { keys: ['Ctrl', 'S'], action: 'shortcuts.store' },
  { keys: ['Ctrl', 'L'], action: 'shortcuts.library' },
  { keys: ['Ctrl', 'B'], action: 'shortcuts.cart' },
  { keys: ['Ctrl', ','], action: 'shortcuts.settings' },
  { keys: ['?'], action: 'shortcuts.help' },
  { keys: ['Esc'], action: 'common.cancel' }
];

export default function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="card max-w-md w-full p-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">{t('shortcuts.title')}</h3>
            <ul className="space-y-2.5">
              {SHORTCUTS.map((s, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-fg-muted">{t(s.action)}</span>
                  <span className="flex gap-1">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="px-2 py-0.5 rounded text-xs bg-bg-hover border border-border font-mono">{k}</kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-fg-subtle mt-5 text-center">Pulsa <kbd className="px-1.5 py-0.5 rounded bg-bg-hover">Esc</kbd> o haz clic fuera para cerrar.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
