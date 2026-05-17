import { defineConfig } from '@playwright/test';

/**
 * Configuración de Playwright para E2E contra la app empacada.
 * Requiere: `npm run build:win` previamente (crea dist/win-unpacked/).
 *
 * Si quieres añadir más tests, créalos en `e2e/*.spec.ts`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' }
});
