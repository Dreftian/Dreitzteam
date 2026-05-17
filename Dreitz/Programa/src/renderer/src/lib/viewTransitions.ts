/**
 * View Transitions DESACTIVADAS.
 *
 * Antes: parchaba `history.pushState/replaceState` para envolver cada
 * navegación en un `document.startViewTransition()` que hacía crossfade
 * nativo. SE VEÍA bonito pero:
 *
 *   - `startViewTransition` BLOQUEA la cola hasta que la animación termina
 *     (típicamente 200-300ms con páginas grandes — el navegador toma snapshot
 *     del DOM completo, lo cual es costoso con glassmorphism + 100+ cards).
 *   - Si el usuario hacía click ANTES de que terminara la transición previa,
 *     el nuevo click quedaba encolado y luego saltaba en orden incorrecto.
 *   - El síntoma exacto que reportó el usuario: "presiono algo, demora, presiono
 *     otra cosa y luego muestra lo primero".
 *
 * La fluidez ahora es prioritaria sobre el efecto visual. Las animaciones de
 * mounting siguen funcionando vía `motion.div` por componente.
 */
export function installViewTransitions() {
  // No-op intencional. Mantenemos el export para no romper imports existentes.
}
