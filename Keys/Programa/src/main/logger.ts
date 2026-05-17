import log from 'electron-log/main';
import { app } from 'electron';
import path from 'node:path';

let initialized = false;

export function initLogger() {
  if (initialized) return log;
  log.transports.file.resolvePathFn = () =>
    path.join(app.getPath('userData'), 'logs', 'keys.log');
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.console.format = '[{level}] {text}';
  log.initialize();
  log.info('=== Dreitz Keys launched ===', 'v' + app.getVersion());
  initialized = true;
  return log;
}

export { log };
export default log;
