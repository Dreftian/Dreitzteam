import Fuse from 'fuse.js';
import type { Game } from './types';

/**
 * Fuzzy search sobre el catálogo de juegos.
 *
 * Antes la búsqueda era exact-match contra `title` (con LIKE %term%) — fallaba
 * para typos comunes ("cybrpunk" no encontraba "Cyberpunk 2077"). Fuse.js
 * aplica Bitap fuzzy matching: tolera typos, transposiciones de letras y
 * ordenes diferentes de palabras.
 *
 * Threshold 0.4 = balance entre permisivo (encuentra cosas relacionadas) y
 * estricto (no devuelve basura). Bajalo a 0.2 para más estricto.
 */

type GameLike = Pick<Game, 'id' | 'title' | 'short_description'> & {
  genres?: string[];
  publisher?: string;
};

let cachedIndex: { games: GameLike[]; fuse: Fuse<GameLike> } | null = null;

export function buildIndex(games: GameLike[]) {
  cachedIndex = {
    games,
    fuse: new Fuse(games, {
      keys: [
        { name: 'title', weight: 0.6 },         // título: peso máximo
        { name: 'short_description', weight: 0.15 }, // descripción: secundario
        { name: 'publisher', weight: 0.15 },    // publisher: third
        { name: 'genres', weight: 0.1 }         // géneros: peso bajo (matching loose)
      ],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 2,
      ignoreLocation: true,    // dónde está el match no importa
      includeScore: true,
      shouldSort: true
    })
  };
}

export function fuzzySearch(query: string, limit = 50): GameLike[] {
  if (!cachedIndex) return [];
  if (!query || query.trim().length < 2) return cachedIndex.games.slice(0, limit);
  const results = cachedIndex.fuse.search(query, { limit });
  return results.map((r) => r.item);
}

export function clearIndex() {
  cachedIndex = null;
}
