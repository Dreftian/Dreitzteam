/**
 * HowLongToBeat — estimación de tiempo de juego.
 *
 * Estrategia "offline first" sin scraping a HLTB:
 *   1. Cache estática hard-coded para los juegos del catálogo curado.
 *      Valores tomados de consenso público (HLTB community averages).
 *   2. Fallback por género: si el game no está en la cache, estimamos
 *      con un range típico según género.
 *   3. Si quisieras enriquecer, añade entries a `HLTB_CACHE` por steam_app_id.
 *
 * Devuelve null si no podemos estimar (juego sin steam_app_id y sin género).
 */

export interface HltbData {
  /** Horas para terminar solo la historia principal */
  mainStory: number;
  /** Horas para historia + secundarias relevantes */
  mainPlusSides: number;
  /** Horas para 100% / completionist */
  completionist: number;
  /** Confianza del dato: "hltb" = consenso real, "estimate" = aproximado por género */
  source: 'hltb' | 'estimate';
}

/**
 * Cache de horas reales (community consensus de HLTB) para juegos del catálogo.
 * Key: steam_app_id. Valores en horas.
 */
const HLTB_CACHE: Record<number, Omit<HltbData, 'source'>> = {
  // ===== Resident Evil =====
  2050650: { mainStory: 17, mainPlusSides: 28, completionist: 50 },     // RE4 Remake
  1196590: { mainStory: 11, mainPlusSides: 17, completionist: 32 },     // RE Village
  883710:  { mainStory: 9,  mainPlusSides: 14, completionist: 28 },     // RE2 Remake
  1029690: { mainStory: 6,  mainPlusSides: 10, completionist: 19 },     // RE3 Remake
  418370:  { mainStory: 10, mainPlusSides: 15, completionist: 25 },     // RE7
  304240:  { mainStory: 21, mainPlusSides: 35, completionist: 70 },     // RE6
  21690:   { mainStory: 11, mainPlusSides: 17, completionist: 38 },     // RE5
  304230:  { mainStory: 11, mainPlusSides: 14, completionist: 23 },     // RE HD Remaster

  // ===== Devil May Cry =====
  601150:  { mainStory: 11, mainPlusSides: 16, completionist: 36 },     // DMC5
  631510:  { mainStory: 9,  mainPlusSides: 13, completionist: 27 },     // DmC
  631530:  { mainStory: 21, mainPlusSides: 30, completionist: 55 },     // DMC HD Collection

  // ===== Monster Hunter =====
  582010:  { mainStory: 47, mainPlusSides: 105, completionist: 314 },   // MH World
  1446780: { mainStory: 35, mainPlusSides: 67,  completionist: 250 },   // MH Rise
  2246340: { mainStory: 36, mainPlusSides: 70,  completionist: 200 },   // MH Wilds

  // ===== Silent Hill =====
  2124490: { mainStory: 17, mainPlusSides: 22, completionist: 34 },     // SH2 Remake

  // ===== Soulsborne =====
  1245620: { mainStory: 60,  mainPlusSides: 100, completionist: 135 },  // Elden Ring
  2622380: { mainStory: 12,  mainPlusSides: 20,  completionist: 45 },   // Elden Ring Nightreign
  814380:  { mainStory: 30,  mainPlusSides: 39,  completionist: 70 },   // Sekiro
  374320:  { mainStory: 32,  mainPlusSides: 45,  completionist: 95 },   // DS3
  335300:  { mainStory: 38,  mainPlusSides: 60,  completionist: 113 },  // DS2 SOTFS
  570940:  { mainStory: 27,  mainPlusSides: 41,  completionist: 105 },  // DS Remastered
  1971870: { mainStory: 19,  mainPlusSides: 26,  completionist: 60 },   // Armored Core VI

  // ===== Capcom =====
  1659040: { mainStory: 9,  mainPlusSides: 30,  completionist: 100 },   // SF6
  2054970: { mainStory: 25, mainPlusSides: 40,  completionist: 65 },    // Dragon's Dogma 2

  // ===== Bethesda =====
  489830:  { mainStory: 34, mainPlusSides: 110, completionist: 235 },   // Skyrim SE
  377160:  { mainStory: 28, mainPlusSides: 85,  completionist: 150 },   // Fallout 4
  22380:   { mainStory: 28, mainPlusSides: 65,  completionist: 130 },   // FNV
  1716740: { mainStory: 28, mainPlusSides: 80,  completionist: 200 },   // Starfield
  403640:  { mainStory: 13, mainPlusSides: 22,  completionist: 42 },    // Dishonored 2

  // ===== CDPR =====
  1091500: { mainStory: 24, mainPlusSides: 62, completionist: 105 },    // Cyberpunk 2077
  292030:  { mainStory: 50, mainPlusSides: 105, completionist: 175 },   // Witcher 3

  // ===== Rockstar =====
  271590:  { mainStory: 31, mainPlusSides: 48, completionist: 80 },     // GTA V
  1174180: { mainStory: 50, mainPlusSides: 80, completionist: 175 },    // RDR2
  12210:   { mainStory: 28, mainPlusSides: 47, completionist: 78 },     // GTA IV
  12120:   { mainStory: 30, mainPlusSides: 49, completionist: 80 },     // GTA SA
  12150:   { mainStory: 18, mainPlusSides: 28, completionist: 38 },     // GTA VC

  // ===== Ubisoft =====
  2208920: { mainStory: 19, mainPlusSides: 26, completionist: 41 },     // AC Mirage
  812140:  { mainStory: 45, mainPlusSides: 85, completionist: 145 },    // AC Odyssey
  582160:  { mainStory: 30, mainPlusSides: 50, completionist: 95 },     // AC Origins
  33230:   { mainStory: 20, mainPlusSides: 30, completionist: 47 },     // AC II
  2767030: { mainStory: 22, mainPlusSides: 35, completionist: 55 },     // Avatar FoP
  460930:  { mainStory: 19, mainPlusSides: 50, completionist: 120 },    // Division 2

  // ===== Sony 1P =====
  1593500: { mainStory: 21, mainPlusSides: 33, completionist: 51 },     // GoW (2018)
  2322010: { mainStory: 26, mainPlusSides: 40, completionist: 60 },     // GoW Ragnarök
  1817070: { mainStory: 17, mainPlusSides: 25, completionist: 35 },     // Spider-Man R
  1817190: { mainStory: 7,  mainPlusSides: 11, completionist: 16 },     // Miles Morales
  1888930: { mainStory: 15, mainPlusSides: 18, completionist: 26 },     // TLOU Part I
  2531310: { mainStory: 24, mainPlusSides: 29, completionist: 41 },     // TLOU Part II R
  2519060: { mainStory: 17, mainPlusSides: 26, completionist: 35 },     // Spider-Man 2
  980330:  { mainStory: 22, mainPlusSides: 32, completionist: 60 },     // HZD Complete
  2420110: { mainStory: 30, mainPlusSides: 60, completionist: 100 },    // HFW Complete
  1888160: { mainStory: 11, mainPlusSides: 20, completionist: 60 },     // Marvel's Avengers
  1190460: { mainStory: 40, mainPlusSides: 60, completionist: 95 },     // Death Stranding DC
  2215430: { mainStory: 25, mainPlusSides: 50, completionist: 80 },     // Ghost of Tsushima DC

  // ===== Xbox 1P =====
  1240440: { mainStory: 12, mainPlusSides: 25, completionist: 55 },     // Halo Infinite
  976730:  { mainStory: 30, mainPlusSides: 55, completionist: 110 },    // Halo MCC
  1551360: { mainStory: 18, mainPlusSides: 50, completionist: 165 },    // Forza Horizon 5
  1466860: { mainStory: 18, mainPlusSides: 40, completionist: 110 },    // AoE IV
  813780:  { mainStory: 20, mainPlusSides: 50, completionist: 150 },    // AoE II DE

  // ===== Larian =====
  1086940: { mainStory: 75, mainPlusSides: 115, completionist: 200 },   // BG3

  // ===== EA =====
  2462750: { mainStory: 18, mainPlusSides: 50, completionist: 200 },    // EA FC 25
  1238810: { mainStory: 7,  mainPlusSides: 13, completionist: 80 },     // BF1
  1238840: { mainStory: 6,  mainPlusSides: 13, completionist: 60 },     // BFV
  1517290: { mainStory: 14, mainPlusSides: 25, completionist: 70 },     // BF2042
  1903340: { mainStory: 14, mainPlusSides: 18, completionist: 23 },     // Dead Space R
  1328670: { mainStory: 87, mainPlusSides: 116, completionist: 160 },   // Mass Effect LE

  // ===== SEGA / Atlus / RGG =====
  2347080: { mainStory: 46, mainPlusSides: 75,  completionist: 130 },   // LaD Infinite Wealth
  1687950: { mainStory: 103, mainPlusSides: 130, completionist: 145 },  // Persona 5 Royal
  1259660: { mainStory: 47, mainPlusSides: 65,  completionist: 92 },    // Yakuza: Like a Dragon
  2161700: { mainStory: 50, mainPlusSides: 70,  completionist: 95 },    // Persona 3 Reload
  1382330: { mainStory: 42, mainPlusSides: 65,  completionist: 105 },   // Tales of Arise
  1389990: { mainStory: 41, mainPlusSides: 55,  completionist: 80 },    // P5 Strikers

  // ===== Square Enix / Game Science =====
  1462040: { mainStory: 33, mainPlusSides: 45,  completionist: 80 },    // FF7R Intergrade
  1173770: { mainStory: 28, mainPlusSides: 51,  completionist: 105 },   // FF15 WE
  2515020: { mainStory: 20, mainPlusSides: 27,  completionist: 47 },    // Forspoken
  2358720: { mainStory: 40, mainPlusSides: 60,  completionist: 95 },    // Black Myth: Wukong
  3764200: { mainStory: 36, mainPlusSides: 65,  completionist: 100 },   // FF16

  // ===== 2K =====
  397540:  { mainStory: 23, mainPlusSides: 36, completionist: 90 },     // BL3
  49520:   { mainStory: 30, mainPlusSides: 48, completionist: 130 },    // BL2
  8870:    { mainStory: 12, mainPlusSides: 17, completionist: 26 },     // BioShock Infinite
  409710:  { mainStory: 35, mainPlusSides: 50, completionist: 80 },     // BioShock Collection
  2820220: { mainStory: 8,  mainPlusSides: 35, completionist: 150 },    // NBA 2K25

  // ===== Strategy =====
  281990:  { mainStory: 22, mainPlusSides: 70,  completionist: 300 },   // Stellaris
  1158310: { mainStory: 28, mainPlusSides: 110, completionist: 350 },   // CK3
  394360:  { mainStory: 19, mainPlusSides: 70,  completionist: 220 },   // HoI4
  1142710: { mainStory: 40, mainPlusSides: 110, completionist: 280 },   // Total War: WH3
  289070:  { mainStory: 18, mainPlusSides: 80,  completionist: 200 },   // Civ VI

  // ===== Souls-like non-FromSoft =====
  1627720: { mainStory: 30, mainPlusSides: 47, completionist: 75 },     // Lies of P

  // ===== Otros AAA =====
  870780:  { mainStory: 12, mainPlusSides: 18, completionist: 31 },     // Control UE
  466240:  { mainStory: 27, mainPlusSides: 56, completionist: 130 },    // HITMAN WoA
  612880:  { mainStory: 13, mainPlusSides: 18, completionist: 33 },     // Wolfenstein II
  2440510: { mainStory: 7,  mainPlusSides: 11, completionist: 16 },     // Wolfenstein TOB
  1259420: { mainStory: 21, mainPlusSides: 50, completionist: 90 },     // Dying Light 2
  1313140: { mainStory: 30, mainPlusSides: 50, completionist: 88 },     // Hogwarts Legacy
  275850:  { mainStory: 32, mainPlusSides: 70, completionist: 130 },    // No Man's Sky
  1426210: { mainStory: 12, mainPlusSides: 14, completionist: 18 },     // It Takes Two
  2138330: { mainStory: 25, mainPlusSides: 35, completionist: 50 },     // Stellar Blade
  2357570: { mainStory: 18, mainPlusSides: 30, completionist: 70 },     // Helldivers 2
  1272080: { mainStory: 9,  mainPlusSides: 17, completionist: 40 },     // PAYDAY 3
  2900050: { mainStory: 40, mainPlusSides: 65, completionist: 100 }     // Death Stranding 2
};

/**
 * Estimación por género cuando no hay entry específico en cache.
 * Devuelve un range típico para juegos del género.
 */
const GENRE_ESTIMATES: Record<string, Omit<HltbData, 'source'>> = {
  'RPG':           { mainStory: 35, mainPlusSides: 60,  completionist: 110 },
  'JRPG':          { mainStory: 45, mainPlusSides: 80,  completionist: 130 },
  'Action':        { mainStory: 12, mainPlusSides: 20,  completionist: 40 },
  'Action RPG':    { mainStory: 25, mainPlusSides: 45,  completionist: 80 },
  'Souls-like':    { mainStory: 30, mainPlusSides: 45,  completionist: 90 },
  'FPS':           { mainStory: 10, mainPlusSides: 15,  completionist: 30 },
  'Survival Horror': { mainStory: 12, mainPlusSides: 18, completionist: 30 },
  'Hack and Slash': { mainStory: 11, mainPlusSides: 17, completionist: 35 },
  'Stealth':       { mainStory: 14, mainPlusSides: 24,  completionist: 45 },
  'Open World':    { mainStory: 35, mainPlusSides: 70,  completionist: 130 },
  'Fighting':      { mainStory: 8,  mainPlusSides: 25,  completionist: 80 },
  'Grand Strategy': { mainStory: 25, mainPlusSides: 100, completionist: 280 },
  'RTS':           { mainStory: 18, mainPlusSides: 45,  completionist: 130 },
  '4X':            { mainStory: 20, mainPlusSides: 80,  completionist: 250 },
  'Looter Shooter': { mainStory: 22, mainPlusSides: 40, completionist: 100 },
  'Racing':        { mainStory: 15, mainPlusSides: 45,  completionist: 150 },
  'Sports':        { mainStory: 12, mainPlusSides: 40,  completionist: 150 },
  'Adventure':     { mainStory: 15, mainPlusSides: 22,  completionist: 35 },
  'Platformer':    { mainStory: 10, mainPlusSides: 15,  completionist: 25 },
  'Sci-fi RPG':    { mainStory: 30, mainPlusSides: 55,  completionist: 100 }
};

/**
 * Obtiene horas estimadas para un juego.
 *
 * @param steamAppId - Steam app ID del juego (key principal de la cache).
 * @param genres - Array de géneros del juego (fallback si no está cacheado).
 * @returns HltbData con `source: 'hltb'` si vino de cache, `'estimate'` si fue por género.
 *          null si no se pudo estimar.
 */
export function getHltb(steamAppId: number | null | undefined, genres: string[] = []): HltbData | null {
  if (steamAppId && HLTB_CACHE[steamAppId]) {
    return { ...HLTB_CACHE[steamAppId], source: 'hltb' };
  }

  // Estimación por género: priorizamos el primer género conocido.
  for (const g of genres) {
    if (GENRE_ESTIMATES[g]) {
      return { ...GENRE_ESTIMATES[g], source: 'estimate' };
    }
  }

  return null;
}
