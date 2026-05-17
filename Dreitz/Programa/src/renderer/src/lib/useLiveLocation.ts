import { useEffect, useState } from 'react';
import { useLocation, type Location } from 'react-router-dom';

/**
 * Hook que devuelve la `Location` "viva" de React Router pero refrescándola
 * manualmente en cada `hashchange` para evitar el bug conocido de
 * HashRouter + Electron donde `useLocation()` queda desincronizado con
 * `window.location.hash` tras el primer `navigate(...)`.
 *
 * Sintomas que arregla:
 *   - `<Routes location={loc}>` rinde vacío aunque la URL haya cambiado
 *   - `loc.pathname` queda fijo en `/` aunque el hash sea `#/store`
 *
 * Implementación: combinamos el `useLocation` nativo con un `tick` que se
 * incrementa en cada `hashchange`. Reconstruimos un objeto `Location` con
 * `pathname` derivado del hash actual y forzamos re-render.
 */
export function useLiveLocation(): Location {
  const native = useLocation();
  const [, force] = useState(0);

  useEffect(() => {
    const onChange = () => force((n) => n + 1);
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  // Reconstruimos `pathname` desde el hash actual si difiere del nativo
  // (caso de HashRouter desincronizado).
  const hash = window.location.hash.replace(/^#/, '');
  const [pathname, search] = hash.split('?');
  const livePathname = pathname || '/';

  if (livePathname === native.pathname) return native;

  return {
    pathname: livePathname,
    search: search ? '?' + search : '',
    hash: '',
    state: null,
    key: 'live-' + livePathname
  };
}
