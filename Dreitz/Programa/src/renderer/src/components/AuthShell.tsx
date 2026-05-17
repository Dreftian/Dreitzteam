import type { ReactNode } from 'react';
import TitleBar from './TitleBar';

/**
 * Layout mínimo para pantallas pre-login (Login, Register, ResetPassword).
 * Originalmente esto vivía en App.tsx pero extraerlo permite que ProtectedRoute
 * lo reutilice cuando renderiza Login directamente.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
