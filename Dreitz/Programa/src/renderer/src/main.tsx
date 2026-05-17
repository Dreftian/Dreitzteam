import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { installViewTransitions } from './lib/viewTransitions';

// Last-resort renderer guard: si cualquier excepción escapa hasta aquí, la pintamos
// en el DOM para que el usuario vea el error en vez de pantalla negra.
function pintarError(titulo: string, detalle: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="padding:32px;font-family:Inter,sans-serif;background:#0a0e1a;color:#e6ecf5;min-height:100vh">
      <h1 style="color:#fb7185;margin:0 0 12px;font-size:18px">⚠ Dreitz no pudo arrancar</h1>
      <div style="font-size:14px;color:#97a3b9;margin-bottom:16px">${titulo}</div>
      <pre style="background:#11172a;border:1px solid #1d2745;border-radius:8px;padding:16px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#c5cde0;overflow:auto;max-height:60vh">${detalle.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</pre>
      <div style="margin-top:16px;font-size:12px;color:#6b7794">
        Toma una captura y compártela. Logs en <code style="background:#1d2745;padding:2px 6px;border-radius:4px">%APPDATA%\\Dreitz\\logs\\dreitz.log</code>
      </div>
    </div>
  `;
}

// Solo mostramos la pantalla de "Dreitz no pudo arrancar" para errores FATALES
// que ocurren ANTES de que React monte. Después de eso, los errores de IPC
// individuales no deben tumbar toda la UI — los loggeamos y dejamos que el
// componente afectado los maneje (con su propio try/catch o error boundary).
let appMounted = false;

window.addEventListener('error', (e) => {
  console.error('[uncaught]', e.error ?? e.message);
  if (!appMounted) {
    pintarError(e.message || 'Error en el script principal', e.error?.stack ?? String(e.error ?? ''));
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled-promise]', e.reason);
  if (!appMounted) {
    pintarError('Promesa rechazada sin atrapar', e.reason?.stack ?? String(e.reason ?? ''));
  } else {
    // Después del mount, suprimimos el `unhandledrejection` para que no aparezca
    // el cartel rojo de error global. El componente que disparó la promesa
    // típicamente ya tiene su propio toast/handler.
    e.preventDefault();
  }
});

try {
  installViewTransitions();
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
  // Después del mount inicial, los errores de promesa NO deben tumbar la UI
  appMounted = true;
} catch (e) {
  console.error('[mount-failed]', e);
  pintarError('React no pudo montar el árbol', (e as Error)?.stack ?? String(e));
}
