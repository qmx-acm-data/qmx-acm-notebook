'use strict';
import type { BrowserWindow as ElectronWindow } from 'electron';
import type { Auth } from '../auth/auth.cjs';
import type { AuthTicket } from '../../shared/models/auth.js';
import type { SourceScope } from '../../shared/models/bootstrap.js';
import type { AppArguments, BoundaryModule, CacheView, FailureView, LocalView, MainAccount } from './contracts.js';
const { app, BrowserWindow, ipcMain, shell, safeStorage, net } = (require('electron') as typeof import('electron'));
import fs = require('node:fs');
import path = require('node:path');
const { GitHub, repoParts, normalizeServerUrl, repositoryKey } = (require('./github.cjs') as typeof import('../github/client.cjs'));
const { randomUUID } = (require('node:crypto') as typeof import('node:crypto'));
const { spawn } = (require('node:child_process') as typeof import('node:child_process'));
const { createUpdater } = (require('./updater.cjs') as typeof import('../update/updater.cjs'));
const { prepareFileUpgrade, recoverFileUpgrade, cancelPreparedFileUpgrade, getFileUpgradeCapability } = (require('./file-upgrade.cjs') as typeof import('../update/file-upgrade.cjs'));
const { cleanupUpdateStorage } = (require('./update-storage.cjs') as typeof import('../update/storage.cjs'));
const { createAuth, configureUserData } = (require('./auth.cjs') as typeof import('../auth/auth.cjs'));
const { createContestService } = (require('./contests.cjs') as typeof import('../contests/service.cjs'));
const { createPlatformService } = (require('./platform-service.cjs') as typeof import('../platforms/service.cjs'));
const { createPlannerService } = (require('./planner-service.cjs') as typeof import('../planner/service.cjs'));
const { createPublicPageReader } = (require('./platform-page.cjs') as typeof import('../platforms/page.cjs'));
const { registerUpdateHandlers, registerSettingsHandlers, createLocalUpdate, registerRecordHandlers } = require('./ipc-handlers.cjs') as typeof import('./ipc-handlers.cjs');
const { createSession } = require('./session.cjs') as typeof import('./session.cjs');
const APP_VERSION = (require('../package.json') as { version: string }).version;
configureUserData(app);
const networkFetch = (url: string | URL, options?: RequestInit) => net.fetch(url as string, { ...options, bypassCustomProtocolHandlers: true });
let auth: Auth;
const { createCodeFormatter } = (require('./code-formatter.cjs') as typeof import('../format/code.cjs'));
const formatCode = createCodeFormatter();
function authFailure(error: unknown, ticket: AuthTicket) {
  if (auth.failure(error, ticket)) {
    token = auth.token; account = auth.account;
    if ((error as FailureView).status === 401) permissions = null;
  }
}
app.disableHardwareAcceleration();
// On Linux desktops without a recognized keyring (niri, sway, ...), Chromium picks the plaintext
// backend and safeStorage reports unavailable, which blocks login persistence. Prefer libsecret so a
// running secret service (gnome-keyring/KWallet) can be used; GNOME and KDE keep native detection.
if (process.platform === 'linux' && !app.commandLine.hasSwitch('password-store') && !/gnome|kde/i.test(process.env.XDG_CURRENT_DESKTOP || '')) {
  app.commandLine.appendSwitch('password-store', 'gnome-libsecret');
}
let win: ElectronWindow, dir: string;
let contestService: ReturnType<typeof createContestService>, platforms: ReturnType<typeof createPlatformService>, planner: ReturnType<typeof createPlannerService>;
let token = '', account: MainAccount | null = null, permissions: (SourceScope & { push: boolean; admin: boolean }) | null = null;
let loginGeneration = 0, writeBusy = false, syncBusy = false, updateBusy = false, installing = false;
let updater: ReturnType<typeof createUpdater>;
function processEnvForInstaller() {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  return environment;
}
function ensureIdle() {
  if (updateBusy || installing) throw new Error('客户端正在更新，请等待更新完成');
}
const { TEAM_CLIENT_ID, defaults, normalizeRepositories, settings, local } = (require('./settings.cjs') as typeof import('../storage/settings.cjs')).createSettingsStore({ read, repoParts, normalizeServerUrl, repositoryKey });
function read(name: string, fallback: unknown): unknown {
  try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as unknown; } catch { return fallback; }
}
function save(name: string, data: unknown) {
  const file = path.join(dir, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}
function githubClient(currentToken = token, repo = settings().repo, serverUrl = settings().serverUrl) {
  const ticket = auth.capture();
  serverUrl = normalizeServerUrl(serverUrl);
  if (serverUrl) currentToken = '';
  const gh = new GitHub({ repo, token: currentToken, fetcher: networkFetch, serverUrl });
  // All authenticated operations, including writes, invalidate only on a structured HTTP 401.
  return new Proxy(gh, { get(target, name) {
    const value: unknown = target[name as keyof typeof target];
    if (typeof value !== 'function') return value;
    return async (...args: unknown[]) => {
      try { return await (value as (...args: unknown[]) => unknown).apply(target, args); }
      catch (error) { if (currentToken && currentToken === ticket.token) authFailure(error, ticket); throw error; }
    };
  } });
}
function client() { return githubClient(); }
function sourceScope(s = settings()) { return { repo: s.repo, serverUrl: normalizeServerUrl(s.serverUrl || ''), sourceKey: repositoryKey(s.repo, s.serverUrl || '') }; }
function annotate<T extends object>(record: T, scope = sourceScope()) { return { ...record, ...scope }; }
function repoCache(cache: CacheView, repo = settings().repo, serverUrl = settings().serverUrl) {
  const key = repositoryKey(repo, serverUrl);
  if (cache.repos?.[key]) return cache.repos[key];
  if (cache.sourceKey === key) return cache;
  // Releases before custom sources only cached GitHub; never reuse ambiguous data on Gitea.
  if (!normalizeServerUrl(serverUrl) && !cache.sourceKey && !cache.serverUrl) {
    if (cache.repos?.[repo] && !cache.repos[repo].sourceKey && !cache.repos[repo].serverUrl) return cache.repos[repo];
    if (cache.repo === repo) return cache;
  }
  return {};
}
function saveRepoCache(old: CacheView, updated: CacheView, scope = sourceScope()) {
  const value: CacheView = { ...updated, ...scope }; delete value.repos;
  const repos = { ...(old.repos || {}), [scope.sourceKey]: value };
  save('cache.json', { ...value, repos });
}
function ensureSource(key: string, generation = loginGeneration) {
  if (key !== sourceScope().sourceKey || generation !== loginGeneration) throw new Error('账号或仓库配置已改变，请重新同步');
}
function state(error?: string) {
  const s = settings(), scope = sourceScope(s), cache = read('cache.json', {}) as CacheView;
  const c = repoCache(cache, s.repo, s.serverUrl);
  const matching = c.repo === s.repo;
  return {
    records: matching ? (c.records || []).filter(r => r.kind === 'document').map(r => annotate(r, scope)) : [],
    algorithmNotes: matching ? (c.algorithmNotes || []).map(r => annotate(r, scope)) : [],
    algorithmTopics: matching && Array.isArray(c.algorithmTopics) ? c.algorithmTopics.map(topic => annotate(topic, scope)) : [],
    issues: matching ? (c.issues || (c.records || []).filter(r => r.kind === 'issue')).map(r => annotate(r, scope)) : [],
    lastSync: matching ? c.lastSync : null,
    tagCatalog: matching && c.tagCatalog ? c.tagCatalog : require('../ui/tag-presets.js') as unknown,
    tagCatalogError: matching ? c.tagCatalogError || null : null,
    settings: s, account, authStatus: auth?.status, appVersion: APP_VERSION, update: updater?.getState(), updateCapability: getFileUpgradeCapability(), permissions: permissions?.sourceKey === scope.sourceKey ? permissions : null,
    local: local(), contests: contestService?.snapshot(), platforms: platforms?.state(), planner: planner?.state(), error: error || null
  };
}
const { assertExternal, external, chromePath, openAuthUrl } = (require('./external-links.cjs') as typeof import('../links/external.cjs')).createExternalLinks({ shell, fs, spawn, env: process.env, platform: process.platform, setTimeout, clearTimeout });
const { login, refreshIdentity } = createSession({ networkFetch, getAuth: () => auth,
  getToken: () => token, setToken: value => { token = value; }, getAccount: () => account,
  setAccount: value => { account = value; }, setPermissions: value => { permissions = value; },
  getLoginGeneration: () => loginGeneration, nextLoginGeneration: () => ++loginGeneration,
  isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy, sourceScope, ensureSource, githubClient,
  annotate, settings, state, sendAuthProgress: progress => win.webContents.send('auth-progress', progress),
  openAuthUrl, URL, Buffer, AbortSignal, Date, setTimeout });
async function writeOperation<T>(fn: () => T | PromiseLike<T>): Promise<T> {
  if (writeBusy || syncBusy) throw new Error('上一项操作正在进行，请勿重复操作');
  writeBusy = true;
  try { return await fn(); } finally { writeBusy = false; }
}
function handle<K extends keyof AppArguments>(name: K, fn: (...args: AppArguments[K]) => unknown) {
  ipcMain.handle(name, async (event, ...args: unknown[]) => {
    if (event.sender !== win.webContents) throw new Error('非法调用');
    if (!['bootstrap', 'checkStartupUpdates', 'checkForUpdates', 'downloadUpdate', 'installUpdate', 'updateLocal', 'exportLocal'].includes(name)) ensureIdle();
    return fn(...args as AppArguments[K]);
  });
}
function requireWritableSource() {
  if (sourceScope().serverUrl) throw new Error('自定义 Gitea 目前仅支持匿名读取公开仓库；请切换 GitHub 仓库后写入');
}
function setup() {
  planner = createPlannerService({ read, save });
  platforms = createPlatformService({ read, save, fetcher: networkFetch, readPage: createPublicPageReader({ BrowserWindow }) });
  // Public schedules use stateless Node fetch, separate from Chromium session cookies.
  contestService = createContestService({ fetcher: (url, options) => fetch(url, options), readCache: () => read('contests.json', null), writeCache: value => save('contests.json', value) });
  handle('getContests', force => contestService.get(force));
  handle('bindPlatform', (platform, url) => platforms.bind(platform, url));
  handle('refreshPlatform', platform => platforms.refresh(platform));
  handle('unbindPlatform', platform => platforms.unbind(platform));
  registerUpdateHandlers({ handle, app, updater, isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy,
    isUpdateBusy: () => updateBusy, isInstalling: () => installing, isPlatformBusy: () => platforms.isBusy(),
    setUpdateBusy: value => { updateBusy = value; }, setInstalling: value => { installing = value; },
    directory: dir, version: APP_VERSION, process, spawn, path, setTimeout, processEnvForInstaller,
    cleanupUpdateStorage, prepareFileUpgrade, cancelPreparedFileUpgrade, getFileUpgradeCapability });
  handle('getTagCatalog', () => writeOperation(async () => {
    const scope = sourceScope(), gen = loginGeneration, repo = scope.repo;
    const catalog = await client().getTagCatalog();
    ensureSource(scope.sourceKey, gen);
    const old = read('cache.json', {}) as CacheView;
    const c = repoCache(old, repo);
    const updated = { ...(c.repo === repo ? c : {}), repo, tagCatalog: catalog, tagCatalogError: null };
    saveRepoCache(old, updated);
    return catalog;
  }));
  handle('requestTag', data => writeOperation(() => { requireWritableSource(); return client().requestTag(data); }));
  handle('getTagReview', () => client().getTagReview());
  handle('reviewTag', data => writeOperation(async () => {
    requireWritableSource();
    const repo = settings().repo;
    const result = await client().reviewTag(data);
    if (repo === settings().repo && (data as { decision?: unknown }).decision === 'approve') {
      const old = read('cache.json', {}) as CacheView;
      const c = repoCache(old, repo);
      try {
        const tagCatalog = await client().getTagCatalog();
        const updated = { ...(c.repo === repo ? c : {}), repo, tagCatalog, tagCatalogError: null };
        saveRepoCache(old, updated);
      }
      catch { /* Approval is already committed; preserve the successful result and refresh on next sync. */ }
    }
    return result;
  }));
  handle('saveAlgorithmTopic', data => writeOperation(async () => {
    requireWritableSource();
    const scope = sourceScope(), gen = loginGeneration, repo = scope.repo;
    const result = await client().saveAlgorithmTopic(data);
    ensureSource(scope.sourceKey, gen);
    // Persist only the complete additions list returned after the repository commit succeeded.
    const old = read('cache.json', {}) as CacheView;
    const c = repoCache(old, repo);
    const updated = { ...(c.repo === repo ? c : {}), repo, algorithmTopics: result.topics };
    saveRepoCache(old, updated);
    return result.topic;
  }));
  handle('refreshAccount', async () => {
    if (!token) throw new Error('请先登录 GitHub');
    return writeOperation(() => refreshIdentity());
  });
  handle('sync', async () => {
    if (writeBusy || syncBusy) throw new Error('请等待当前操作完成');
    syncBusy = true;
    try {
      const scope = sourceScope(), gen = loginGeneration, repo = scope.repo, old = read('cache.json', {}) as CacheView;
      const c = repoCache(old, repo);
      const result = await client().sync(c.repo === repo ? c : {});
      ensureSource(scope.sourceKey, gen);
      let tagCatalog = c.repo === repo ? c.tagCatalog : null, tagCatalogError = null;
      try { tagCatalog = await client().getTagCatalog(); }
      catch (error) { tagCatalogError = (error as FailureView).status === 401 ? '标签目录授权已失效，请重新登录' : '标签目录暂未更新，继续使用已缓存的标签'; }
      ensureSource(scope.sourceKey, gen);
      const updated = { ...result, repo, tagCatalog, tagCatalogError, algorithmNotes: Array.isArray(result.algorithmNotes) ? result.algorithmNotes : [], algorithmTopics: Array.isArray(result.algorithmTopics) ? result.algorithmTopics : [] };
      saveRepoCache(old, updated);
      if (token) { try { await refreshIdentity(); } catch (error) { permissions = null; return state(`资料已同步，账号权限刷新失败：${(error as FailureView).message}`); } }
      return state();
    } finally { syncBusy = false; }
  });
  registerSettingsHandlers({ handle, isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy,
    settings, normalizeRepositories, TEAM_CLIENT_ID, repoParts, normalizeServerUrl,
    clearPermissions: () => { permissions = null; }, invalidateLogin: () => { loginGeneration++; }, save, state });
  const updateLocal = createLocalUpdate({ isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy,
    getAccount: () => account, local, read, save, repoCache, sourceScope });
  handle('login', login);
  handle('logout', () => {
    if (writeBusy || syncBusy) throw new Error('请等待当前操作完成后再退出');
    auth.logout(); loginGeneration++; token = ''; account = null; permissions = null; return state();
  });
  registerRecordHandlers({ handle, writeOperation, requireWritableSource,
    getAccount: () => account, getToken: () => token, local, settings, read, save, client, annotate,
    sourceScope, repositoryKey, repoCache, saveRepoCache });
  (require('./ipc-boundary.cjs') as BoundaryModule).registerBoundary(handle, {
    plannerAction: (action, payload) => planner.action(action, payload),
    bootstrap: () => state(),
    updateLocal,
    openExternal: external,
    openAuthUrl,
    formatCode: (source, lang) => formatCode(source, lang).catch((error: unknown) => ({ code: source, error: (error as FailureView).message })),
    cancelLogin: () => { loginGeneration++; },
    exportLocal: async () => {
      const { dialog } = (require('electron') as typeof import('electron'));
      const result = await dialog.showSaveDialog(win, { defaultPath: '我的题解备份.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (!result.canceled) { fs.writeFileSync(result.filePath, JSON.stringify(local(), null, 2)); return true; }
      return false;
    }
  });
}
app.whenReady().then(() => {
  dir = app.getPath('userData'); fs.mkdirSync(dir, { recursive: true });
  if (app.isPackaged) {
    const installDir = path.dirname(process.execPath);
    recoverFileUpgrade(dir, installDir);
    cleanupUpdateStorage(dir, installDir);
    // A helper still observing relaunch keeps its rollback files. The next
    // update check retries cleanup after it exits, without touching new downloads.
  }
  const personal = local() as LocalView; let migrated = false;
  personal.records = personal.records.map(record => {
    if (record.kind !== 'local') return record;
    const ownerId = record.ownerId == null ? null : String(record.ownerId);
    if (record.clientId && record.ownerId === ownerId) return record;
    migrated = true; return { ...record, clientId: record.clientId || randomUUID(), ownerId };
  });
  if (migrated) save('local.json', personal);
  auth = createAuth({ safeStorage,
    // Do not use read(): credential read/parse failures must not be swallowed as signed-out.
    readAuth: () => JSON.parse(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8')) as unknown,
    saveAuth: data => save('auth.json', data)
  });
  auth.restore(); token = auth.token; account = auth.account;
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 1050, minHeight: 700, title: '拾题 · QMX Notebook', backgroundColor: '#f6f7fb', autoHideMenuBar: true,
    webPreferences: { preload: process.argv.includes('--preview') ? undefined : path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  updater = createUpdater({
    currentVersion: APP_VERSION, runtimeVersion: process.versions.electron, downloadDir: path.join(dir, 'updates'),
    fetcher: networkFetch,
    installedArchive: app.isPackaged ? path.join(path.dirname(process.execPath), 'resources', 'app.asar') : undefined,
    onProgress: (progress: import('../../shared/contracts/notebook.js').UpdateProgress) => { if (!win.isDestroyed()) win.webContents.send('update-progress', progress); }
  });
  win.on('close', event => {
    if (updateBusy && !installing) event.preventDefault();
  });
  setup(); win.loadFile(path.join(__dirname, '../ui/index.html'));
});
app.on('window-all-closed', () => { loginGeneration++; app.quit(); });
