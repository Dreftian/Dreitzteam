import https from 'node:https';

interface SteamAppDetails {
  steam_appid: number;
  name: string;
  short_description?: string;
  detailed_description?: string;
  developers?: string[];
  publishers?: string[];
  release_date?: { date?: string; coming_soon?: boolean };
  header_image?: string;
  capsule_image?: string;
  background?: string;
  background_raw?: string;
  screenshots?: Array<{ path_thumbnail?: string; path_full?: string }>;
  movies?: Array<{
    id?: number;
    name?: string;
    thumbnail?: string;
    webm?: { 480?: string; max?: string };
    mp4?: { 480?: string; max?: string };
  }>;
  genres?: Array<{ description: string }>;
  categories?: Array<{ description: string }>;
  pc_requirements?: { minimum?: string; recommended?: string };
  price_overview?: {
    initial: number;
    final: number;
    discount_percent: number;
    currency: string;
    final_formatted?: string;
  };
  metacritic?: { score?: number };
  recommendations?: { total?: number };
  supported_languages?: string;
  type?: string;
  fullgame?: { appid?: string; name?: string };
}

export interface ParsedSteamGame {
  steam_app_id: number;
  title: string;
  short_description: string;
  detailed_description: string;
  developer: string;
  publisher: string;
  release_date: string;
  release_at: string | null;
  is_preorder: boolean;
  is_dlc: boolean;
  parent_steam_app_id: number | null;
  parent_game_name: string | null;
  header_image: string;
  capsule_image: string;
  background_image: string;
  screenshots: string[];
  trailer_url: string | null;
  trailer_thumbnail: string | null;
  genres: string[];
  categories: string[];
  pc_requirements_min: string;
  pc_requirements_rec: string;
  price_initial: number;
  price_final: number;
  discount_percent: number;
  currency: string;
  metacritic_score: number | null;
  steam_review_count: number | null;
  languages: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function fetchJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept-Language': 'es-PE,es;q=0.9' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout (${timeoutMs}ms) fetching ${url}`));
    });
  });
}

export function extractAppIdFromUrl(input: string): number | null {
  const trimmed = input.trim();
  const m = trimmed.match(/store\.steampowered\.com\/app\/(\d+)/i);
  if (m) return parseInt(m[1], 10);
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return null;
}

function parseLanguages(html: string | undefined): string {
  if (!html) return '';
  const stripped = html.replace(/<[^>]*>/g, ',').replace(/&[a-z]+;/gi, '');
  const set = new Set(stripped.split(',').map((s) => s.trim()).filter(Boolean));
  return Array.from(set).slice(0, 12).join(', ');
}

function pickTrailer(movies?: SteamAppDetails['movies']): { url: string | null; thumb: string | null } {
  if (!movies || !movies.length) return { url: null, thumb: null };
  for (const m of movies) {
    const u = m.mp4?.max ?? m.mp4?.[480] ?? m.webm?.max ?? m.webm?.[480];
    if (u) return { url: u.startsWith('http') ? u : `https:${u.startsWith('//') ? u : '//' + u}`, thumb: m.thumbnail ?? null };
  }
  return { url: null, thumb: null };
}

export async function fetchSteamGame(appIdOrUrl: string, cc = 'pe', lang = 'spanish'): Promise<ParsedSteamGame | null> {
  const appId = extractAppIdFromUrl(appIdOrUrl);
  if (!appId) return null;

  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${cc}&l=${lang}`;
  const json = await fetchJson(url);
  const entry = json?.[appId];
  if (!entry?.success || !entry?.data) return null;

  const d = entry.data as SteamAppDetails;
  const trailer = pickTrailer(d.movies);
  const isDlc = d.type === 'dlc';
  const isPreorder = !!d.release_date?.coming_soon;

  // Compute release_at: if release_date.date looks parseable
  let releaseAt: string | null = null;
  const rd = d.release_date?.date;
  if (rd) {
    const t = Date.parse(rd);
    if (!isNaN(t)) releaseAt = new Date(t).toISOString();
  }

  return {
    steam_app_id: d.steam_appid,
    title: d.name,
    short_description: d.short_description ?? '',
    detailed_description: d.detailed_description ?? '',
    developer: (d.developers ?? []).join(', '),
    publisher: (d.publishers ?? []).join(', '),
    release_date: rd ?? '',
    release_at: releaseAt,
    is_preorder: isPreorder,
    is_dlc: isDlc,
    parent_steam_app_id: isDlc && d.fullgame?.appid ? parseInt(d.fullgame.appid, 10) : null,
    parent_game_name: isDlc ? d.fullgame?.name ?? null : null,
    header_image: d.header_image ?? '',
    capsule_image: d.capsule_image ?? '',
    background_image: d.background_raw ?? d.background ?? '',
    screenshots: (d.screenshots ?? []).map((s) => s.path_full ?? s.path_thumbnail ?? '').filter(Boolean),
    trailer_url: trailer.url,
    trailer_thumbnail: trailer.thumb,
    genres: (d.genres ?? []).map((g) => g.description),
    categories: (d.categories ?? []).map((c) => c.description),
    pc_requirements_min: d.pc_requirements?.minimum ?? '',
    pc_requirements_rec: d.pc_requirements?.recommended ?? '',
    price_initial: d.price_overview ? d.price_overview.initial / 100 : 0,
    price_final: d.price_overview ? d.price_overview.final / 100 : 0,
    discount_percent: d.price_overview?.discount_percent ?? 0,
    currency: d.price_overview?.currency ?? 'PEN',
    metacritic_score: d.metacritic?.score ?? null,
    steam_review_count: d.recommendations?.total ?? null,
    languages: parseLanguages(d.supported_languages)
  };
}

// Fetch USD price for a Steam game (used for compare-vs-Steam)
export async function fetchSteamPriceUsd(appId: number): Promise<{ priceUsd: number | null; discount: number | null }> {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english&filters=price_overview`;
    const json = await fetchJson(url);
    const entry = json?.[appId];
    if (!entry?.success || !entry?.data?.price_overview) return { priceUsd: null, discount: null };
    return {
      priceUsd: entry.data.price_overview.final / 100,
      discount: entry.data.price_overview.discount_percent ?? 0
    };
  } catch {
    return { priceUsd: null, discount: null };
  }
}
