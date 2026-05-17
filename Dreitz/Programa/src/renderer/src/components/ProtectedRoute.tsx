import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';
import Login from '../pages/Login';
import AuthShell from './AuthShell';

/**
 * Guard de ruta SIN navegación interna. En vez de redirigir vía Navigate (que
 * en este Electron + HashRouter no propaga el cambio al árbol), renderizamos
 * directamente la pantalla de Login cuando no hay usuario autenticado. Cuando
 * el usuario hace login, AuthContext setea `user` y el guard rinde `children`.
 *
 * Esto elimina la dependencia en useLocation/useNavigate para el flujo más
 * crítico (el primer arranque).
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-fg-muted">
        Cargando…
      </div>
    );
  }
  if (!user) {
    return (
      <AuthShell>
        <Login />
      </AuthShell>
    );
  }
  return <>{children}</>;
}
