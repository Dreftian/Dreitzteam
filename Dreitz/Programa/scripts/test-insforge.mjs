#!/usr/bin/env node
/**
 * Test de integración del adapter InsForge.
 *
 * Hace un round-trip contra el backend remoto:
 *   1. Insert game mock (id muy alto para no colisionar con catálogo real)
 *   2. GET el mismo registro y verifica que coincide
 *   3. DELETE el mock
 *
 * Si algo falla, sale con exit code != 0 y un mensaje legible. Se puede correr
 * en CI o manual: `node scripts/test-insforge.mjs`
 *
 * No requiere build — usa fetch directo a la REST API.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const projectFile = path.join(path.dirname(__filename), '..', '.insforge', 'project.json');

let creds;
try {
  creds = JSON.parse(readFileSync(projectFile, 'utf8'));
} catch (e) {
  console.error('❌ No se pudo leer .insforge/project.json — corre `npx @insforge/cli link` primero.');
  process.exit(2);
}

const url = creds.oss_host;
const key = creds.api_key;
const MOCK_ID = 999999999;  // fuera del rango de Steam app IDs
const headers = {
  'Authorization': `Bearer ${key}`,
  'apikey': key,
  'Content-Type': 'application/json'
};

function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

async function step(label, fn) {
  process.stdout.write(`  ${label} ... `);
  try {
    const out = await fn();
    console.log('✓');
    return out;
  } catch (e) {
    console.log('✗');
    fail(`${label} → ${e.message}`);
  }
}

console.log(`🔌 Probando adapter InsForge contra ${url}\n`);

// 1) Limpieza inicial (por si quedó residuo de runs anteriores)
await step('Limpieza previa', async () => {
  await fetch(`${url}/api/database/records/games?id=eq.${MOCK_ID}`, { method: 'DELETE', headers });
});

// 2) Insert mock
const mock = {
  id: MOCK_ID,
  title: '[TEST] Juego mock — borrar si quedó',
  developer: 'integration-test',
  publisher: 'integration-test',
  price_initial: 100,
  price_final: 20,
  discount_percent: 80,
  currency: 'PEN',
  stock: 1,
  is_active: true,
  is_featured: false,
  drm_platform: 'dreitz'
};
await step('Insert mock game', async () => {
  const r = await fetch(`${url}/api/database/records/games`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([mock])
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${await r.text()}`);
});

// 3) Read it back
const leido = await step('Fetch mock back', async () => {
  const r = await fetch(`${url}/api/database/records/games?id=eq.${MOCK_ID}`, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j) || j.length !== 1) throw new Error(`Esperaba 1 fila, recibí ${j.length}`);
  return j[0];
});

// 4) Verify match
await step('Verify field match', async () => {
  if (leido.title !== mock.title) throw new Error(`title mismatch: ${leido.title}`);
  if (Number(leido.price_final) !== mock.price_final) throw new Error(`price mismatch: ${leido.price_final}`);
  if (leido.discount_percent !== mock.discount_percent) throw new Error(`discount mismatch: ${leido.discount_percent}`);
});

// 5) Update
await step('Update mock (PATCH)', async () => {
  const r = await fetch(`${url}/api/database/records/games?id=eq.${MOCK_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ price_final: 15.5 })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
});

// 6) Verify update propagated
await step('Verify update', async () => {
  const r = await fetch(`${url}/api/database/records/games?id=eq.${MOCK_ID}`, { headers });
  const j = await r.json();
  if (Number(j[0].price_final) !== 15.5) throw new Error(`update no aplicó: ${j[0].price_final}`);
});

// 7) Delete
await step('Delete mock', async () => {
  const r = await fetch(`${url}/api/database/records/games?id=eq.${MOCK_ID}`, { method: 'DELETE', headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
});

// 8) Verify gone
await step('Verify deleted', async () => {
  const r = await fetch(`${url}/api/database/records/games?id=eq.${MOCK_ID}`, { headers });
  const j = await r.json();
  if (Array.isArray(j) && j.length > 0) throw new Error('todavía existe');
});

console.log('\n✅ Todos los checks pasaron — InsForge responde correctamente.');
process.exit(0);
