import { contextBridge, ipcRenderer } from 'electron';

const api = {
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  settingsOpen: () => ipcRenderer.invoke('settings:open'),
  settingsClose: () => ipcRenderer.send('settings:close'),

  adminLogin: (payload: { username: string; password: string }) => ipcRenderer.invoke('admin:login', payload),

  statsSummary: () => ipcRenderer.invoke('stats:summary'),
  statsRevenueByDay: (days?: number) => ipcRenderer.invoke('stats:revenueByDay', days),
  statsTopGames: (limit?: number) => ipcRenderer.invoke('stats:topGames', limit),
  statsUserBreakdown: () => ipcRenderer.invoke('stats:userBreakdown'),
  statsLicenseStatusBreakdown: () => ipcRenderer.invoke('stats:licenseStatusBreakdown'),
  statsWishlistHeatmap: () => ipcRenderer.invoke('stats:wishlistHeatmap'),
  statsFunnel: () => ipcRenderer.invoke('stats:funnel'),

  usersList: () => ipcRenderer.invoke('users:list'),
  usersUpdate: (payload: any) => ipcRenderer.invoke('users:update', payload),
  usersResetPassword: (payload: any) => ipcRenderer.invoke('users:resetPassword', payload),
  usersDelete: (payload: any) => ipcRenderer.invoke('users:delete', payload),
  usersBulkUpdate: (payload: any) => ipcRenderer.invoke('users:bulkUpdate', payload),
  usersBulkDelete: (payload: any) => ipcRenderer.invoke('users:bulkDelete', payload),

  gamesList: () => ipcRenderer.invoke('games:list'),
  gamesGet: (id: number) => ipcRenderer.invoke('games:get', id),
  gamesAddBySteam: (payload: any) => ipcRenderer.invoke('games:addBySteam', payload),
  gamesUpdate: (payload: any) => ipcRenderer.invoke('games:update', payload),
  gamesDelete: (payload: any) => ipcRenderer.invoke('games:delete', payload),

  licensesList: (gameId?: number) => ipcRenderer.invoke('licenses:list', gameId),
  licensesGenerate: (payload: any) => ipcRenderer.invoke('licenses:generate', payload),
  licensesRevoke: (payload: any) => ipcRenderer.invoke('licenses:revoke', payload),
  licensesBulkRevoke: (payload: any) => ipcRenderer.invoke('licenses:bulkRevoke', payload),

  ordersList: () => ipcRenderer.invoke('orders:list'),
  ordersItems: (orderId: number) => ipcRenderer.invoke('orders:items', orderId),

  auditList: (limit?: number) => ipcRenderer.invoke('audit:list', limit),

  bundlesList: () => ipcRenderer.invoke('bundles:list'),
  bundlesCreate: (payload: any) => ipcRenderer.invoke('bundles:create', payload),
  bundlesDelete: (payload: any) => ipcRenderer.invoke('bundles:delete', payload),

  promotionsList: () => ipcRenderer.invoke('promotions:list'),
  promotionsCreate: (payload: any) => ipcRenderer.invoke('promotions:create', payload),
  promotionsUpdate: (payload: any) => ipcRenderer.invoke('promotions:update', payload),
  promotionsDelete: (payload: any) => ipcRenderer.invoke('promotions:delete', payload),

  flashSalesList: () => ipcRenderer.invoke('flashSales:list'),
  flashSalesCreate: (payload: any) => ipcRenderer.invoke('flashSales:create', payload),
  flashSalesDelete: (payload: any) => ipcRenderer.invoke('flashSales:delete', payload),

  giftCardsList: () => ipcRenderer.invoke('giftCards:list'),
  giftCardsGenerate: (payload: any) => ipcRenderer.invoke('giftCards:generate', payload),

  currencyList: () => ipcRenderer.invoke('currency:list'),
  currencyUpdate: (payload: any) => ipcRenderer.invoke('currency:update', payload),

  collectionsList: () => ipcRenderer.invoke('collections:list'),
  collectionsCreate: (payload: any) => ipcRenderer.invoke('collections:create', payload),
  collectionsDelete: (payload: any) => ipcRenderer.invoke('collections:delete', payload),

  refundsList: () => ipcRenderer.invoke('refunds:list'),
  refundsDecide: (payload: any) => ipcRenderer.invoke('refunds:decide', payload),

  steamFetch: (urlOrId: string) => ipcRenderer.invoke('steam:fetch', urlOrId),

  supabaseStatus: () => ipcRenderer.invoke('supabase:status') as Promise<{
    enabled: boolean;
    url: string;
    hasAnonKey: boolean;
    hasServiceRole: boolean;
  }>,
  supabaseSetCreds: (payload: { url?: string; anon_key?: string; service_role?: string }) =>
    ipcRenderer.invoke('supabase:setCreds', payload),
  supabasePushAll: (payload?: { adminId?: number }) => ipcRenderer.invoke('supabase:pushAll', payload),
  supabaseDisable: () => ipcRenderer.invoke('supabase:disable'),

  paymentsAdminGet: () => ipcRenderer.invoke('paymentsAdmin:get'),
  paymentsAdminSet: (payload: Record<string, string | null>) => ipcRenderer.invoke('paymentsAdmin:set', payload),
  yapeReceiptsList: (opts?: { status?: string; limit?: number }) => ipcRenderer.invoke('yapeReceipts:list', opts),
  yapeReceiptsDecide: (payload: { id: number; approve: boolean; adminId?: number; note?: string }) =>
    ipcRenderer.invoke('yapeReceipts:decide', payload),

  // 2FA admin
  adminLoginVerifyTotp: (payload: { userId: number; token: string }) =>
    ipcRenderer.invoke('admin:loginVerifyTotp', payload),
  adminTwofaGenerate: (userId: number) => ipcRenderer.invoke('admin:twofaGenerate', userId) as Promise<{ secret: string; uri: string }>,
  adminTwofaVerifyAndEnable: (payload: { userId: number; token: string }) =>
    ipcRenderer.invoke('admin:twofaVerifyAndEnable', payload) as Promise<{ enabled: boolean }>,
  adminTwofaStatus: (userId: number) => ipcRenderer.invoke('admin:twofaStatus', userId) as Promise<{ enabled: boolean }>,
  adminTwofaDisable: (payload: { userId: number; password: string }) =>
    ipcRenderer.invoke('admin:twofaDisable', payload),

  // password reset
  adminResetUserPassword: (payload: { adminId: number; userId: number; newPassword: string }) =>
    ipcRenderer.invoke('admin:resetUserPassword', payload),

  // audit filter
  auditFilter: (opts: { action?: string; adminId?: number; targetType?: string; since?: string; until?: string; limit?: number }) =>
    ipcRenderer.invoke('audit:filter', opts),

  // templates
  templatesList: () => ipcRenderer.invoke('templates:list'),
  templatesUpsert: (payload: { id?: number; slug: string; title: string; body: string }) =>
    ipcRenderer.invoke('templates:upsert', payload),
  templatesDelete: (id: number) => ipcRenderer.invoke('templates:delete', id),
  templatesRender: (payload: { templateId: number; vars: Record<string, string> }) =>
    ipcRenderer.invoke('templates:render', payload) as Promise<{ body: string }>,

  // Free Game weekly (admin)
  freeGameGet: () => ipcRenderer.invoke('freeGame:get'),
  freeGameSet: (payload: { adminId?: number; gameId: number; daysActive: number }) =>
    ipcRenderer.invoke('freeGame:set', payload),
  freeGameClear: (payload: { adminId?: number }) => ipcRenderer.invoke('freeGame:clear', payload),

  // Storage admin para subir .zips al bucket dreitz-games en InsForge
  storagePickZip: () => ipcRenderer.invoke('storage:pickZip'),
  storageUploadGameZip: (payload: { gameId: number; filePath: string }) =>
    ipcRenderer.invoke('storage:uploadGameZip', payload),
  storageDeleteGameZip: (gameId: number) => ipcRenderer.invoke('storage:deleteGameZip', gameId)
};

contextBridge.exposeInMainWorld('api', api);
export type KeysApi = typeof api;
