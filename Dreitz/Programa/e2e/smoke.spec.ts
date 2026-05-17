/**
 * Smoke E2E para Dreitz — arranca la app empacada con Playwright + Electron y
 * verifica que el flujo crítico no esté roto:
 *
 *   1. Splash desaparece dentro de 10s
 *   2. La pantalla de login renderiza (input usuario + contraseña + Entrar)
 *   3. Login con admin/admin funciona y llega al sidebar
 *   4. Sidebar muestra: Tienda, Biblioteca, Activar clave
 *   5. La navegación a /library no crashea con error #310
 *
 * Si cualquier paso falla, exit code != 0 para que CI bloquee el release.
 *
 * Uso:
 *   npm run build:win          # genera dist/win-unpacked/
 *   npm run test:e2e           # corre este test contra el unpacked
 */

import { _electron as electron, test, expect } from '@playwright/test';
import path from 'node:path';

const APP_PATH = path.join(__dirname, '..', 'dist', 'win-unpacked', 'Dreitz.exe');

test('Dreitz arranca, login, navegación básica', async () => {
  const app = await electron.launch({
    executablePath: APP_PATH,
    timeout: 30_000
  });

  // Espera la ventana principal (no la splash)
  const w = await app.firstWindow();
  await w.waitForLoadState('domcontentloaded');

  // 1) Aparece el login dentro de 10s
  await expect(w.locator('text=Iniciar sesión')).toBeVisible({ timeout: 10_000 });
  await expect(w.locator('input[placeholder="usuario"]')).toBeVisible();

  // 2) Login admin/admin
  await w.locator('input[placeholder="usuario"]').fill('admin');
  await w.locator('input[type="password"]').fill('admin');
  await w.locator('button:has-text("Entrar")').click();

  // 3) Sidebar visible
  await expect(w.locator('text=Tienda').first()).toBeVisible({ timeout: 8_000 });
  await expect(w.locator('text=Biblioteca').first()).toBeVisible();
  await expect(w.locator('text=Activar clave').first()).toBeVisible();

  // 4) Navegar a /library — el bug que arreglamos (React #310) ocurría aquí
  await w.locator('text=Biblioteca').first().click();
  // No debe aparecer el error boundary
  await expect(w.locator('text=Algo salió mal')).not.toBeVisible({ timeout: 3_000 });

  await app.close();
});
