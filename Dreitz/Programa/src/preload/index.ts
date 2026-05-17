import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // splash sync
  appReady: () => ipcRenderer.invoke('app:ready'),

  // window
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // auth
  authRegister: (payload: { username: string; email: string; password: string; refCode?: string }) =>
    ipcRenderer.invoke('auth:register', payload),
  authLogin: (payload: { username: string; password: string }) =>
    ipcRenderer.invoke('auth:login', payload),
  authLoginVerifyTotp: (payload: { userId: number; token: string }) =>
    ipcRenderer.invoke('auth:loginVerifyTotp', payload),
  authMe: (userId: number) => ipcRenderer.invoke('auth:me', userId),

  // games
  gamesList: (opts?: any) => ipcRenderer.invoke('games:list', opts),
  gamesGet: (id: number) => ipcRenderer.invoke('games:get', id),
  gamesAvailableStock: (gameId: number) => ipcRenderer.invoke('games:availableStock', gameId),
  gamesRelated: (payload: { gameId: number; limit?: number }) => ipcRenderer.invoke('games:related', payload),
  gamesTrackView: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('games:trackView', payload),
  gamesRecentlyViewed: (payload: { userId: number; limit?: number }) => ipcRenderer.invoke('games:recentlyViewed', payload),
  gamesPriceHistory: (gameId: number) => ipcRenderer.invoke('games:priceHistory', gameId),
  gamesDlcs: (parentGameId: number) => ipcRenderer.invoke('games:dlcs', parentGameId),
  gamesFlashSale: (gameId: number) => ipcRenderer.invoke('games:flashSale', gameId),
  gamesByPublisher: (publisher: string) => ipcRenderer.invoke('games:byPublisher', publisher),
  gamesByDeveloper: (developer: string) => ipcRenderer.invoke('games:byDeveloper', developer),
  gamesComparePrice: (payload: { gameId: number }) => ipcRenderer.invoke('games:comparePrice', payload),

  // wishlist
  wishlistList: (userId: number) => ipcRenderer.invoke('wishlist:list', userId),
  wishlistToggle: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('wishlist:toggle', payload),
  wishlistHas: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('wishlist:has', payload),

  // checkout
  checkoutPurchase: (payload: any) => ipcRenderer.invoke('checkout:purchase', payload),

  // library
  libraryList: (userId: number) => ipcRenderer.invoke('library:list', userId),
  libraryRedeem: (payload: { userId: number; licenseId: number }) =>
    ipcRenderer.invoke('library:redeem', payload),

  // orders
  ordersList: (userId: number) => ipcRenderer.invoke('orders:list', userId),

  // pro
  proSubscribe: (payload: any) => ipcRenderer.invoke('pro:subscribe', payload),
  proCancel: (userId: number) => ipcRenderer.invoke('pro:cancel', userId),

  // settings
  settingsGet: (userId: number) => ipcRenderer.invoke('settings:get', userId),
  settingsUpdate: (payload: { userId: number; key: string; value: any }) =>
    ipcRenderer.invoke('settings:update', payload),
  onSettingsChanged: (cb: (payload: { userId: number; key: string; settings: any }) => void) => {
    const listener = (_: any, p: any) => cb(p);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },

  // achievements
  achievementsList: (userId: number) => ipcRenderer.invoke('achievements:list', userId),
  achievementsProfileStats: (userId: number) => ipcRenderer.invoke('achievements:profileStats', userId),

  // activity
  activityList: (payload: { userId?: number; limit?: number; global?: boolean }) =>
    ipcRenderer.invoke('activity:list', payload),

  // bundles
  bundlesList: () => ipcRenderer.invoke('bundles:list'),

  // promotions / flash sales
  promotionsActive: () => ipcRenderer.invoke('promotions:active'),
  flashSalesDailyDeal: () => ipcRenderer.invoke('flashSales:dailyDeal'),
  flashSalesActive: () => ipcRenderer.invoke('flashSales:active'),

  // reviews
  reviewsList: (gameId: number) => ipcRenderer.invoke('reviews:list', gameId),
  reviewsSummary: (gameId: number) => ipcRenderer.invoke('reviews:summary', gameId),
  reviewsCreate: (payload: { userId: number; gameId: number; rating: number; title?: string; body?: string }) =>
    ipcRenderer.invoke('reviews:create', payload),
  reviewsMine: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('reviews:mine', payload),

  // points / wallet
  pointsBalance: (userId: number) => ipcRenderer.invoke('points:balance', userId),
  pointsLedger: (payload: { userId: number; limit?: number }) => ipcRenderer.invoke('points:ledger', payload),
  walletGet: (userId: number) => ipcRenderer.invoke('wallet:get', userId),

  // gift cards
  giftCardsCatalog: () => ipcRenderer.invoke('giftCards:catalog'),
  giftCardsPurchase: (payload: { userId: number; amount: number; cardLast4: string; cardBrand: string }) =>
    ipcRenderer.invoke('giftCards:purchase', payload),
  giftCardsRedeem: (payload: { userId: number; code: string }) => ipcRenderer.invoke('giftCards:redeem', payload),
  giftCardsMine: (userId: number) => ipcRenderer.invoke('giftCards:mine', userId),

  // currency
  currencyRates: () => ipcRenderer.invoke('currency:rates'),

  // collections
  collectionsList: () => ipcRenderer.invoke('collections:list'),
  collectionsGet: (slug: string) => ipcRenderer.invoke('collections:get', slug),

  // referrals
  referralsSummary: (userId: number) => ipcRenderer.invoke('referrals:summary', userId),

  // refunds
  refundsRequest: (payload: { userId: number; orderId: number; orderItemId: number; reason: string }) =>
    ipcRenderer.invoke('refunds:request', payload),
  refundsMine: (userId: number) => ipcRenderer.invoke('refunds:mine', userId),
  refundsCheckEligibility: (payload: { userId: number; orderItemId: number }) =>
    ipcRenderer.invoke('refunds:checkEligibility', payload),

  // theme
  themeSystem: () => ipcRenderer.invoke('theme:system'),
  systemMaterial: () => ipcRenderer.invoke('system:material') as Promise<'mica' | 'acrylic' | 'none'>,
  onThemeChange: (cb: (payload: { shouldUseDark: boolean }) => void) => {
    const listener = (_: any, p: any) => cb(p);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },

  // notifications
  notifyShow: (payload: { title: string; body: string }) => ipcRenderer.invoke('notify:show', payload),

  // updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),

  // funnel
  funnelEmit: (payload: { userId?: number; event: string; targetId?: number }) => ipcRenderer.invoke('funnel:emit', payload),

  // install / launch
  installList: (userId: number) => ipcRenderer.invoke('install:list', userId),
  installStatus: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('install:status', payload),
  installStart: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('install:start', payload),
  installMarkSteamInstalled: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('install:markSteamInstalled', payload),
  installSetStandalonePath: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('install:setStandalonePath', payload),
  installUninstall: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('install:uninstall', payload),
  installOpenFolder: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('install:openFolder', payload),
  launchRun: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('launch:run', payload),
  launchStop: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('launch:stop', payload),

  // pc
  pcSpecs: () => ipcRenderer.invoke('pc:specs'),
  pcCheckGame: (gameId: number) => ipcRenderer.invoke('pc:checkGame', gameId),

  // friends
  friendsFindByCode: (refCode: string) => ipcRenderer.invoke('friends:findByCode', refCode),
  friendsRequest: (payload: { fromId: number; toRefCode: string; message?: string }) => ipcRenderer.invoke('friends:request', payload),
  friendsIncoming: (userId: number) => ipcRenderer.invoke('friends:incoming', userId),
  friendsRespond: (payload: { userId: number; requestId: number; accept: boolean }) => ipcRenderer.invoke('friends:respond', payload),
  friendsList: (userId: number) => ipcRenderer.invoke('friends:list', userId),
  friendsRemove: (payload: { userId: number; friendId: number }) => ipcRenderer.invoke('friends:remove', payload),
  friendsLibrary: (payload: { userId: number; friendId: number }) => ipcRenderer.invoke('friends:library', payload),
  friendsProfile: (payload: { userId: number; friendId: number }) => ipcRenderer.invoke('friends:profile', payload),

  // missions
  missionsToday: (userId: number) => ipcRenderer.invoke('missions:today', userId),
  missionsClaim: (payload: { userId: number; missionId: number }) => ipcRenderer.invoke('missions:claim', payload),

  // stickers
  stickersMine: (userId: number) => ipcRenderer.invoke('stickers:mine', userId),
  stickersEvaluate: (userId: number) => ipcRenderer.invoke('stickers:evaluate', userId),

  // wrapped
  wrappedGet: (payload: { userId: number; year?: number }) => ipcRenderer.invoke('wrapped:get', payload),

  // price alerts
  priceAlertsList: (userId: number) => ipcRenderer.invoke('priceAlerts:list', userId),
  priceAlertsSet: (payload: { userId: number; gameId: number; targetPrice: number | null }) => ipcRenderer.invoke('priceAlerts:set', payload),
  priceAlertsRemove: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('priceAlerts:remove', payload),
  onPriceAlert: (cb: (p: { gameId: number; title: string; price: number }) => void) => {
    const l = (_: any, p: any) => cb(p);
    ipcRenderer.on('priceAlert:fired', l);
    return () => ipcRenderer.removeListener('priceAlert:fired', l);
  },

  // plugins
  pluginsList: () => ipcRenderer.invoke('plugins:list'),
  pluginsSetEnabled: (payload: { slug: string; enabled: boolean }) => ipcRenderer.invoke('plugins:setEnabled', payload),
  pluginsEnabledCss: () => ipcRenderer.invoke('plugins:enabledCss'),
  pluginsOpenFolder: () => ipcRenderer.invoke('plugins:openFolder'),

  // seed lifecycle
  onSeedDone: (cb: () => void) => {
    const l = () => cb();
    ipcRenderer.on('seed:done', l);
    return () => ipcRenderer.removeListener('seed:done', l);
  },

  // avatar
  avatarSet: (payload: { userId: number; value: string | null }) => ipcRenderer.invoke('avatar:set', payload),
  avatarPickFile: () => ipcRenderer.invoke('avatar:pickFile'),

  // steam auto-detect
  steamScan: () => ipcRenderer.invoke('steam:scan'),
  steamList: () => ipcRenderer.invoke('steam:list'),
  steamIsOwned: (steamAppId: number) => ipcRenderer.invoke('steam:isOwned', steamAppId),
  steamLaunch: (steamAppId: number) => ipcRenderer.invoke('steam:launch', steamAppId),

  // surprise me (random pick contra parálisis)
  surprisePick: (payload: { userId: number }) =>
    ipcRenderer.invoke('surprise:pick', payload) as Promise<{ game: any; reason: string } | null>,

  // how long to beat (estimación de horas)
  hltbGet: (payload: { gameId: number }) =>
    ipcRenderer.invoke('hltb:get', payload) as Promise<{ mainStory: number; mainPlusSides: number; completionist: number; source: 'hltb' | 'estimate' } | null>,

  // downloads via CDN (InsForge Storage)
  downloadsStart: (payload: { userId: number; gameId: number; licenseId: number }) =>
    ipcRenderer.invoke('downloads:start', payload),
  downloadsInstallPath: (payload: { userId: number; gameId: number }) =>
    ipcRenderer.invoke('downloads:installPath', payload),
  onDownloadProgress: (cb: (p: any) => void) => {
    const listener = (_e: any, p: any) => cb(p);
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.off('download:progress', listener);
  },

  // backup
  backupNow: (userId: number | null) => ipcRenderer.invoke('backup:now', userId),
  backupList: (userId: number) => ipcRenderer.invoke('backup:list', userId),
  backupRestore: (key: string) => ipcRenderer.invoke('backup:restore', key),

  // telemetry
  telemetryGet: () => ipcRenderer.invoke('telemetry:get'),
  telemetrySet: (enabled: boolean) => ipcRenderer.invoke('telemetry:set', enabled),

  // family mode
  familyGet: (userId: number) => ipcRenderer.invoke('family:get', userId),
  familyCreate: (userId: number) => ipcRenderer.invoke('family:create', userId),
  familyJoin: (payload: { userId: number; family_id: string }) => ipcRenderer.invoke('family:join', payload),
  familyLeave: (userId: number) => ipcRenderer.invoke('family:leave', userId),
  familyList: (userId: number) => ipcRenderer.invoke('family:list', userId),
  familyPing: (payload: { userId: number }) => ipcRenderer.invoke('family:ping', payload),
  familyWeeklyRanking: (userId: number) => ipcRenderer.invoke('family:weeklyRanking', userId),

  // wallet recharge via Yape
  walletRecharge: (payload: { userId: number; amount: number; receiptDataUrl: string }) =>
    ipcRenderer.invoke('wallet:recharge', payload),

  // referrals
  referralsClaimFirstPurchase: (userId: number) =>
    ipcRenderer.invoke('referrals:claimFirstPurchase', userId),

  // feature flags
  flagsList: () => ipcRenderer.invoke('flags:list'),
  flagsGet: (key: string) => ipcRenderer.invoke('flags:get', key),
  flagsSet: (payload: { key: string; on: boolean }) => ipcRenderer.invoke('flags:set', payload),

  // discord rich presence
  discordSetActivity: (activity: any) => ipcRenderer.invoke('discord:setActivity', activity),

  // cloud saves
  savesPickFolder: () => ipcRenderer.invoke('saves:pickFolder'),
  savesSetFolder: (payload: { gameId: number; folder: string | null }) => ipcRenderer.invoke('saves:setFolder', payload),
  savesGetFolder: (gameId: number) => ipcRenderer.invoke('saves:getFolder', gameId),
  savesBackup: (payload: { userId: number; gameId: number; label?: string }) => ipcRenderer.invoke('saves:backup', payload),
  savesList: (payload: { userId: number; gameId: number }) => ipcRenderer.invoke('saves:list', payload),
  savesRestore: (payload: { userId: number; snapshotId: number }) => ipcRenderer.invoke('saves:restore', payload),
  savesDelete: (payload: { userId: number; snapshotId: number }) => ipcRenderer.invoke('saves:delete', payload),
  savesSetRoot: (p: string | null) => ipcRenderer.invoke('saves:setRoot', p),

  // payments
  paymentsConfig: () => ipcRenderer.invoke('payments:config'),
  paymentsSetKey: (payload: { key: string; value: string | null }) => ipcRenderer.invoke('payments:setKey', payload),
  paymentsCharge: (payload: {
    provider: string;
    amount: number;
    currency: string;
    description: string;
    token?: string;
    customer_email?: string;
  }) => ipcRenderer.invoke('payments:charge', payload),

  // presence (online status)
  presenceHeartbeat: (payload: { userId: number; gameId?: number | null }) =>
    ipcRenderer.invoke('presence:heartbeat', payload),
  presenceFriendStatuses: (userId: number) =>
    ipcRenderer.invoke('presence:friendStatuses', userId),

  // cross-store price comparison
  crossStorePrices: (gameId: number) => ipcRenderer.invoke('crossStore:getPrices', gameId),
  crossStoreSetPrice: (payload: { gameId: number; store: string; priceUsd: number; discountPercent?: number; url?: string }) =>
    ipcRenderer.invoke('crossStore:setPrice', payload),

  // PRO tier
  proStatus: (userId: number) => ipcRenderer.invoke('pro:status', userId),
  proUpgradeFamily: (payload: { userId: number; familyId: string; tier: 'pro' | 'pro_family' }) =>
    ipcRenderer.invoke('pro:upgradeFamily', payload),
  proFamilyMembers: (familyId: string) => ipcRenderer.invoke('pro:familyMembers', familyId),

  // big picture / fullscreen
  windowFullscreen: (on: boolean) => ipcRenderer.send('window:fullscreen', on),

  // settings — ventana separada estilo Steam
  settingsOpen: () => ipcRenderer.invoke('settings:open'),
  settingsClose: () => ipcRenderer.send('settings:close'),
  windowQuit: () => ipcRenderer.send('window:quit'),

  // auto-launch
  autoLaunchGet: () => ipcRenderer.invoke('autolaunch:get'),
  autoLaunchSet: (on: boolean) => ipcRenderer.invoke('autolaunch:set', on),
  systemPrefsGet: () => ipcRenderer.invoke('systemPrefs:get') as Promise<{ closeToTray: boolean; startMinimizedToTray: boolean }>,
  systemPrefsSet: (payload: { key: 'closeToTray' | 'startMinimizedToTray'; value: boolean }) =>
    ipcRenderer.invoke('systemPrefs:set', payload) as Promise<{ closeToTray: boolean; startMinimizedToTray: boolean }>,

  // events
  onUserChanged: (cb: (payload: { userId: number }) => void) => {
    const listener = (_: any, p: any) => cb(p);
    ipcRenderer.on('user:changed', listener);
    return () => ipcRenderer.removeListener('user:changed', listener);
  },
  onCommand: (cb: (cmd: string) => void) => {
    const listener = (_: any, p: any) => cb(p);
    ipcRenderer.on('app:command', listener);
    return () => ipcRenderer.removeListener('app:command', listener);
  },

  // steam
  steamFetch: (urlOrId: string) => ipcRenderer.invoke('steam:fetch', urlOrId),

  // supabase
  supabaseStatus: () => ipcRenderer.invoke('supabase:status') as Promise<{ enabled: boolean; url: string; hasAnonKey: boolean }>,
  supabaseSetCreds: (payload: { url?: string; anon_key?: string }) => ipcRenderer.invoke('supabase:setCreds', payload),
  supabasePullNow: () => ipcRenderer.invoke('supabase:pullNow'),
  supabaseDisable: () => ipcRenderer.invoke('supabase:disable'),

  // yape (cliente lee config + verifica recibo)
  yapeGetConfig: () => ipcRenderer.invoke('yape:getConfig') as Promise<{
    qr_image_data: string;
    recipient_name: string;
    recipient_phone: string;
    enabled: boolean;
  }>,
  yapeVerifyReceipt: (payload: { userId: number; expectedAmount: number; imageDataUrl: string }) =>
    ipcRenderer.invoke('yape:verifyReceipt', payload) as Promise<{
      valid: boolean;
      confidence: 'high' | 'medium' | 'low';
      amount_seen: number | null;
      recipient_seen: string | null;
      date_seen: string | null;
      issues: string[];
      raw_explanation: string;
      receiptId: number;
    }>,

  // redeem-by-code (activar producto)
  redeemFromCode: (payload: { userId: number; code: string }) =>
    ipcRenderer.invoke('redeem:fromCode', payload) as Promise<{
      success: boolean;
      alreadyOwned: boolean;
      game: any;
      license_id?: number;
    }>,

  // password recovery
  recoverySet: (payload: { userId: number; question: string; answer: string }) =>
    ipcRenderer.invoke('recovery:set', payload),
  recoveryGetQuestion: (username: string) =>
    ipcRenderer.invoke('recovery:getQuestion', username) as Promise<string | null>,
  recoveryReset: (payload: { username: string; answer: string; newPassword: string }) =>
    ipcRenderer.invoke('recovery:reset', payload),

  // 2FA
  twofaGenerate: (userId: number) =>
    ipcRenderer.invoke('twofa:generate', userId) as Promise<{ secret: string; uri: string }>,
  twofaVerifyAndEnable: (payload: { userId: number; token: string }) =>
    ipcRenderer.invoke('twofa:verifyAndEnable', payload) as Promise<{ enabled: boolean }>,
  twofaVerify: (payload: { userId: number; token: string }) =>
    ipcRenderer.invoke('twofa:verify', payload) as Promise<{ ok: boolean }>,
  twofaStatus: (userId: number) =>
    ipcRenderer.invoke('twofa:status', userId) as Promise<{ enabled: boolean }>,
  twofaDisable: (userId: number) => ipcRenderer.invoke('twofa:disable', userId),

  // image cache
  cacheFetch: (url: string) => ipcRenderer.invoke('cache:fetch', url) as Promise<string>,
  cacheStats: () =>
    ipcRenderer.invoke('cache:stats') as Promise<{ count: number; totalBytes: number; maxBytes: number }>,
  cacheClear: () => ipcRenderer.invoke('cache:clear'),

  // auto-update
  updaterCheckNow: () => ipcRenderer.invoke('updater:checkNow'),
  updaterInstallAndRestart: () => ipcRenderer.invoke('updater:installAndRestart'),
  onUpdaterEvent: (cb: (event: string, payload?: any) => void) => {
    const events = ['updater:checking', 'updater:available', 'updater:upToDate', 'updater:progress', 'updater:downloaded', 'updater:error'];
    const wrappers = events.map((evt) => {
      const fn = (_: any, p: any) => cb(evt, p);
      ipcRenderer.on(evt, fn);
      return { evt, fn };
    });
    return () => wrappers.forEach(({ evt, fn }) => ipcRenderer.removeListener(evt, fn));
  },

  // price sync
  priceSyncStatus: () => ipcRenderer.invoke('priceSync:status'),
  priceSyncRunNow: () => ipcRenderer.invoke('priceSync:runNow'),

  // save auto-backup
  savesStartAutoBackup: (payload: { userId: number; gameId: number }) =>
    ipcRenderer.invoke('saves:startAutoBackup', payload),
  savesStopAutoBackup: (payload: { userId: number; gameId: number }) =>
    ipcRenderer.invoke('saves:stopAutoBackup', payload),
  savesListActiveWatches: () => ipcRenderer.invoke('saves:listActiveWatches'),

  // gift codes
  giftCreate: (payload: { fromUserId: number; gameId: number; message?: string }) =>
    ipcRenderer.invoke('gift:create', payload) as Promise<{ code: string; license_id: number }>,
  giftListMine: (userId: number) => ipcRenderer.invoke('gift:listMine', userId),

  // reviews edit/delete + voting
  reviewsUpdate: (payload: { userId: number; reviewId: number; rating: number; title?: string; body?: string }) =>
    ipcRenderer.invoke('reviews:update', payload),
  reviewsDelete: (payload: { userId: number; reviewId: number }) =>
    ipcRenderer.invoke('reviews:delete', payload),
  reviewsVote: (payload: { userId: number; reviewId: number; helpful: boolean }) =>
    ipcRenderer.invoke('reviews:vote', payload) as Promise<{ helpful: number; not_helpful: number }>,
  reviewsVoteCount: (reviewId: number) =>
    ipcRenderer.invoke('reviews:voteCount', reviewId) as Promise<{ helpful: number; not_helpful: number }>,

  // AI recommendations (Tier 2)
  recommendForUser: (payload: { userId: number; force?: boolean }) =>
    ipcRenderer.invoke('recommend:forUser', payload) as Promise<Array<{ game: any; reason: string }>>,

  // Library — Now Playing widget (Tier 3)
  libraryNowPlaying: (userId: number) => ipcRenderer.invoke('library:nowPlaying', userId),

  // Custom shelves (Tier 3)
  shelvesList: (userId: number) => ipcRenderer.invoke('shelves:list', userId),
  shelvesCreate: (payload: { userId: number; name: string }) => ipcRenderer.invoke('shelves:create', payload),
  shelvesRename: (payload: { userId: number; shelfId: number; name: string }) => ipcRenderer.invoke('shelves:rename', payload),
  shelvesDelete: (payload: { userId: number; shelfId: number }) => ipcRenderer.invoke('shelves:delete', payload),
  shelvesAddGame: (payload: { userId: number; shelfId: number; gameId: number }) => ipcRenderer.invoke('shelves:addGame', payload),
  shelvesRemoveGame: (payload: { shelfId: number; gameId: number }) => ipcRenderer.invoke('shelves:removeGame', payload),

  // Friend presence (Tier 4)
  presencePing: (payload: { userId: number; playingGameId?: number | null }) =>
    ipcRenderer.invoke('presence:ping', payload),
  presenceFriendsStatus: (userId: number) =>
    ipcRenderer.invoke('presence:friendsStatus', userId) as Promise<Array<{ id: number; username: string; online: boolean; playing_title: string | null }>>,

  // Free game weekly (Tier 6)
  freeGameCurrent: () => ipcRenderer.invoke('freeGame:current'),
  freeGameClaim: (payload: { userId: number }) => ipcRenderer.invoke('freeGame:claim', payload),

  // Profile customization (Tier 6)
  profileGet: (userId: number) => ipcRenderer.invoke('profile:get', userId),
  profileSet: (payload: { userId: number; banner?: string; avatar_frame?: string; bio?: string }) =>
    ipcRenderer.invoke('profile:set', payload),
  onSupabaseStatus: (cb: (p: { connected: boolean }) => void) => {
    const l = (_: any, p: any) => cb(p);
    ipcRenderer.on('supabase:status', l);
    return () => ipcRenderer.removeListener('supabase:status', l);
  },
  onSupabaseCatalogChanged: (cb: (p?: { table?: string }) => void) => {
    const l = (_: any, p: any) => cb(p);
    ipcRenderer.on('supabase:catalogChanged', l);
    return () => ipcRenderer.removeListener('supabase:catalogChanged', l);
  }
};

contextBridge.exposeInMainWorld('api', api);

export type DreitzApi = typeof api;
