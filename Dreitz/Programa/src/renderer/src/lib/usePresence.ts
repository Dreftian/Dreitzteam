import { useEffect, useRef } from 'react';

/**
 * Hook que envía heartbeat de presencia cada 30s al main process.
 * Cuando el componente se desmonta o el user se desloguea, se detiene.
 *
 * Uso: en el `<Shell>` global, llamar `usePresence(userId)`.
 *
 * Esto alimenta `presence:friendStatuses` para que los amigos vean quién está
 * online y qué juego está jugando.
 */
export function usePresence(userId: number | null | undefined, currentGameId?: number | null) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const send = () => {
      try { window.api.presenceHeartbeat({ userId, gameId: currentGameId ?? null }); } catch { /* silent */ }
    };
    // Heartbeat inmediato + cada 30s
    send();
    intervalRef.current = window.setInterval(send, 30_000) as unknown as number;
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [userId, currentGameId]);
}
