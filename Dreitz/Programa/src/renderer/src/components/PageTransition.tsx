import type { ReactNode } from 'react';

/**
 * Wrapper de páginas — antes hacía fade-in con framer-motion, pero al
 * combinarlo con `key={loc.pathname}` + nuestro switch manual de rutas, la
 * animación se interrumpía y dejaba las páginas con `opacity: 0` permanente
 * ("Activar producto" invisible). Ahora es un wrapper trivial sin animación —
 * la fluidez la da el render directo de cada página. Si quieres recuperar
 * el fade más tarde, hazlo dentro de cada Page con su propio `<motion.div>`.
 */
export default function PageTransition({ children }: { children: ReactNode; k?: string }) {
  return <>{children}</>;
}
