/**
 * E2E del flujo Click-en-juego → GameDetail.
 *
 * Test específico para el bug "demora al click un título nunca entra" que
 * arreglamos pasando `routeId` como prop (useParams() devolvía {} por
 * HashRouter desync en Electron 33).
 *
 * Verifica que después de clickear una card de juego, la GameDetail efectivamente
 * monta y muestra el título + precio dentro de 5s. Antes del fix, quedaba en
 * "Cargando..." infinito.
 */
import { _electron as electron, test, expect } from '@playwright/test';
import path from 'node:path';

const APP_PATH = path.join(__dirname, '..', 'dist', 'win-unpacked', 'Dreitz.exe');

test('Click en card de Store abre GameDetail (no Cargando infinito)', async () => {
  const app = await electron.launch({ executablePath: APP_PATH, timeout: 30_000 });
  const w = await app.firstWindow();
  await w.waitForLoadState('domcontentloaded');

  // Login
  await expect(w.locator('text=Iniciar sesión')).toBeVisible({ timeout: 10_000 });
  await w.locator('input[placeholder="usuario"]').fill('admin');
  await w.locator('input[type="password"]').fill('admin');
  await w.locator('button:has-text("Entrar")').click();

  // Esperar al Store: hay al menos 1 card de juego (selector genérico — cualquier elemento clickeable
  // dentro del catálogo con precio "S/." debe existir).
  await expect(w.locator('text=Tienda').first()).toBeVisible({ timeout: 8_000 });
  // Cerrar modal "novedades" si aparece
  const modalDismiss = w.locator('button:has-text("¡Genial, vamos!")');
  if (await modalDismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
    await modalDismiss.click();
  }

  // Buscar la primera card y clickearla
  const firstCard = w.locator('a[href*="#/game/"]').first();
  await expect(firstCard).toBeVisible({ timeout: 8_000 });
  await firstCard.click();

  // GameDetail debe montar dentro de 5s — verificamos que el "Cargando..." desaparece
  // y aparece algún elemento característico del detail (botón de carrito, header).
  await expect(w.locator('button:has-text("Añadir al carrito")').or(w.locator('button:has-text("En la biblioteca")'))).toBeVisible({ timeout: 5_000 });

  // El texto "Cargando..." NO debe seguir ahí
  await expect(w.locator('text=Cargando...').first()).not.toBeVisible({ timeout: 1_000 });

  await app.close();
});
