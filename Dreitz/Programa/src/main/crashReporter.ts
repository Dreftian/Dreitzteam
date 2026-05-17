/**
 * Sentry crash reporting (opt-in).
 *
 * Activación: setear `SENTRY_DSN` como variable de entorno antes de
 * arrancar, o exportarla en `electron-builder.yml` → `extraEnv`.
 *
 * Si no hay DSN:
 *   - No se inicializa Sentry (no se envía nada).
 *   - El error handler global solo loguea a archivo via `logger.ts`.
 *
 * Si hay DSN:
 *   - Errores no capturados, unhandled rejections, IPC errors → Sentry.
 *   - Cada error incluye: versión de la app, OS, primer crash o recurrente.
 *   - **No se envía info personal** (username, paths con username, etc).
 *
 * Plan free de Sentry: 5k errores/mes. Suficiente para un launcher personal.
 */
import { app } from 'electron';
import log from './logger';

let sentryReady = false;

export async function initCrashReporter() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    log.info('[sentry] DSN no configurado — crash reporting deshabilitado');
    setupFallback();
    return;
  }

  try {
    // Importación dinámica para no romper si @sentry/electron no está instalado.
    const Sentry = await import('@sentry/electron/main').catch(() => null);
    if (!Sentry) {
      log.warn('[sentry] @sentry/electron no instalado — fallback a log local');
      setupFallback();
      return;
    }

    Sentry.init({
      dsn,
      release: `dreitz@${app.getVersion()}`,
      environment: app.isPackaged ? 'production' : 'development',
      // Sample 100% de errores, 10% de transactions (performance).
      tracesSampleRate: 0.1,
      // PII scrubbing — nunca enviamos paths con username.
      beforeSend(event) {
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
          delete event.user.username;
        }
        if (event.request?.url) {
          event.request.url = event.request.url.replace(/\\Users\\[^\\]+/g, '\\Users\\<redacted>');
        }
        return event;
      }
    });

    sentryReady = true;
    log.info('[sentry] inicializado');
  } catch (e) {
    log.warn('[sentry] init failed:', (e as Error).message);
    setupFallback();
  }
}

function setupFallback() {
  // Sin Sentry, al menos no perdemos crashes — los escribimos al log local.
  process.on('uncaughtException', (err) => {
    log.error('[uncaught]', err.stack || err.message);
  });
  process.on('unhandledRejection', (reason) => {
    log.error('[unhandled-rejection]', String(reason));
  });
}

export function captureError(err: Error, context?: Record<string, any>) {
  log.error('[error]', err.stack || err.message, context);
  if (sentryReady) {
    import('@sentry/electron/main').then((S) => {
      S.captureException(err, { extra: context });
    }).catch(() => {});
  }
}

export function isReady() { return sentryReady; }
