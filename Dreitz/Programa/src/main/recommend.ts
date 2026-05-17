/**
 * Recomendaciones con Claude (vision NO, solo text).
 *
 * Flujo:
 *   1. Tomamos la biblioteca del usuario + wishlist + view_history reciente.
 *   2. Tomamos todo el catálogo activo (con género, descripción corta).
 *   3. Le pedimos a Claude que recomiende 6 juegos del catálogo que el usuario
 *      AÚN NO tiene, basados en sus gustos. Salida estructurada (tool_use).
 *
 * El resultado se cachea por 24h en `app_config` (key `recommend.cache.<userId>`)
 * para no martillar la API. Costo por recomendación: ~$0.003 con Haiku 4.5.
 */

import { getDb } from './db';
import log from './logger';

interface RecResult {
  game_id: number;
  reason: string;
}

function getApiKey(): string | null {
  const r = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get('anthropic.api_key') as any;
  return r?.value || null;
}

function getCache(userId: number): { generated_at: string; recs: RecResult[] } | null {
  const r = getDb()
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .get(`recommend.cache.${userId}`) as any;
  if (!r?.value) return null;
  try { return JSON.parse(r.value); } catch { return null; }
}

function setCache(userId: number, payload: { generated_at: string; recs: RecResult[] }) {
  getDb().prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
  ).run(`recommend.cache.${userId}`, JSON.stringify(payload));
}

export async function getRecommendations(userId: number, opts?: { force?: boolean }): Promise<RecResult[]> {
  // Cache check (24h TTL)
  if (!opts?.force) {
    const cached = getCache(userId);
    if (cached && Date.now() - new Date(cached.generated_at).getTime() < 24 * 60 * 60 * 1000) {
      return cached.recs;
    }
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    // Sin API key, devolvemos un fallback determinista (top featured que NO tenga).
    return fallbackRecommendations(userId);
  }

  const db = getDb();

  // Perfil del usuario: biblioteca + wishlist + recientes (top 30 vistos)
  const library = db.prepare(`
    SELECT g.title, g.genres FROM library lib JOIN games g ON g.id = lib.game_id WHERE lib.user_id = ?
  `).all(userId) as any[];
  const wishlist = db.prepare(`
    SELECT g.title, g.genres FROM wishlist w JOIN games g ON g.id = w.game_id WHERE w.user_id = ? LIMIT 20
  `).all(userId) as any[];
  const ownedGameIds = new Set(
    (db.prepare('SELECT game_id FROM library WHERE user_id = ?').all(userId) as any[]).map((r) => r.game_id)
  );

  // Catálogo disponible (no owned, activo, no preorder)
  const catalog = db.prepare(`
    SELECT id, title, short_description, genres, price_final FROM games
    WHERE is_active = 1 AND is_dlc = 0 AND is_preorder = 0
    LIMIT 200
  `).all().filter((g: any) => !ownedGameIds.has(g.id)) as any[];

  if (catalog.length === 0) return [];

  // Construimos un prompt compacto. Cada juego del catálogo va como `[id] título — géneros — desc`.
  const catalogStr = catalog.slice(0, 80).map((g: any) => {
    const genres = g.genres ? JSON.parse(g.genres).slice(0, 3).join(',') : '';
    const desc = (g.short_description || '').slice(0, 100);
    return `[${g.id}] ${g.title} — ${genres} — ${desc}`;
  }).join('\n');

  const libStr = library.slice(0, 20).map((l: any) => {
    const genres = l.genres ? JSON.parse(l.genres).slice(0, 3).join(',') : '';
    return `${l.title} (${genres})`;
  }).join(', ') || '(vacía)';

  const wishStr = wishlist.map((w: any) => w.title).join(', ') || '(vacía)';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        tools: [{
          name: 'submit_recommendations',
          description: 'Devuelve 6 juegos recomendados para el usuario, basados en su perfil.',
          input_schema: {
            type: 'object',
            properties: {
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    game_id: { type: 'integer', description: 'ID del juego del catálogo (de los [N] que te di)' },
                    reason: { type: 'string', description: 'Razón en español (1-2 frases) de por qué le gustaría' }
                  },
                  required: ['game_id', 'reason']
                },
                minItems: 6,
                maxItems: 6
              }
            },
            required: ['recommendations']
          }
        }],
        tool_choice: { type: 'tool', name: 'submit_recommendations' },
        messages: [{
          role: 'user',
          content: `Eres curador de un launcher de videojuegos peruano. Tienes que recomendar 6 juegos para este usuario.

PERFIL DEL USUARIO:
Biblioteca: ${libStr}
Wishlist: ${wishStr}

CATÁLOGO DISPONIBLE (formato: [id] título — géneros — descripción):
${catalogStr}

Reglas:
1. Los 6 IDs deben venir del CATÁLOGO DISPONIBLE (no inventes).
2. Diversifica géneros — no recomiendes 6 RPGs si vio uno de RPG.
3. La razón debe ser específica al usuario ("porque te gusta X..." NO "es un buen juego").
4. Si la biblioteca está vacía, prioriza catalogo de variedad amplia (mainstream + indie).`
        }]
      })
    });

    const body = await response.json();
    if (!response.ok) {
      log.warn('[recommend] API error:', body);
      return fallbackRecommendations(userId);
    }

    const toolUse = body.content?.find((b: any) => b.type === 'tool_use');
    if (!toolUse) return fallbackRecommendations(userId);

    const recs: RecResult[] = (toolUse.input.recommendations || [])
      .filter((r: any) => typeof r.game_id === 'number' && !ownedGameIds.has(r.game_id))
      .slice(0, 6);

    setCache(userId, { generated_at: new Date().toISOString(), recs });
    log.info(`[recommend] generated ${recs.length} recs for user ${userId}`);
    return recs;
  } catch (e) {
    log.warn('[recommend] error:', (e as Error).message);
    return fallbackRecommendations(userId);
  }
}

function fallbackRecommendations(userId: number): RecResult[] {
  // Antes de caer al "top featured", probamos collaborative filtering.
  // Solo necesita data local — no requiere API key.
  const collab = getCollaborativeRecs(userId, 6);
  if (collab.length >= 3) return collab;

  const db = getDb();
  const ownedIds = (db.prepare('SELECT game_id FROM library WHERE user_id = ?').all(userId) as any[]).map((r) => r.game_id);
  const placeholders = ownedIds.length ? ownedIds.map(() => '?').join(',') : '0';
  const games = db.prepare(`
    SELECT id FROM games
    WHERE is_active = 1 AND is_dlc = 0 AND is_preorder = 0
    AND id NOT IN (${placeholders})
    ORDER BY is_featured DESC, discount_percent DESC, RANDOM()
    LIMIT 6
  `).all(...ownedIds) as any[];

  return games.map((g) => ({
    game_id: g.id,
    reason: 'Recomendación destacada del catálogo.'
  }));
}

/**
 * Collaborative filtering simple: "Usuarios que tienen los mismos juegos que vos
 * también tienen X". Score por overlap de biblioteca (Jaccard-like).
 *
 * Costo: O(N usuarios × M juegos). Para un launcher familiar con <50 usuarios
 * y <500 juegos en biblioteca total, corre en <10ms. Para escalas mayores,
 * cachear el score-matrix offline o usar matrix factorization.
 */
export function getCollaborativeRecs(userId: number, limit = 6): RecResult[] {
  const db = getDb();
  const myLib = new Set(
    (db.prepare('SELECT game_id FROM library WHERE user_id = ?').all(userId) as any[]).map((r) => r.game_id)
  );
  if (myLib.size === 0) return [];

  // Otros usuarios + sus bibliotecas
  const others = db.prepare('SELECT DISTINCT user_id FROM library WHERE user_id != ?').all(userId) as any[];
  if (others.length === 0) return [];

  // Score por juego: suma del peso de similaridad por cada user que lo tiene.
  const scores = new Map<number, number>();
  for (const { user_id } of others) {
    const theirLib = new Set(
      (db.prepare('SELECT game_id FROM library WHERE user_id = ?').all(user_id) as any[]).map((r: any) => r.game_id)
    );
    if (theirLib.size === 0) continue;

    // Jaccard similarity = |A ∩ B| / |A ∪ B|
    let intersection = 0;
    for (const g of myLib) if (theirLib.has(g)) intersection++;
    const union = myLib.size + theirLib.size - intersection;
    const sim = union > 0 ? intersection / union : 0;
    if (sim < 0.1) continue; // muy poco overlap, no aporta señal

    // Cada juego que ellos tienen y yo no, gana `sim` puntos.
    for (const g of theirLib) {
      if (myLib.has(g)) continue;
      scores.set(g, (scores.get(g) ?? 0) + sim);
    }
  }

  // Filtrar a juegos activos no-DLC y rankear por score
  const topGameIds = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 3) // tomamos 3x para filtrar después
    .map(([id]) => id);

  if (topGameIds.length === 0) return [];

  const placeholders = topGameIds.map(() => '?').join(',');
  const games = db.prepare(`
    SELECT id, title FROM games
    WHERE id IN (${placeholders})
    AND is_active = 1 AND is_dlc = 0 AND is_preorder = 0
  `).all(...topGameIds) as any[];

  // Mantener el ranking de scores
  const titleById = new Map(games.map((g: any) => [g.id, g.title]));
  return topGameIds
    .filter((id) => titleById.has(id))
    .slice(0, limit)
    .map((id) => ({
      game_id: id,
      reason: `Usuarios con biblioteca similar también tienen ${titleById.get(id)}.`
    }));
}
