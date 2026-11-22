'use strict';
import type { BrowserWindow as ElectronWindow } from 'electron';
import type { Auth } from '../auth/auth.cjs';
import type { AuthTicket } from '../../shared/models/auth.js';
import type { SourceScope } from '../../shared/models/bootstrap.js';
import type { AppArguments, BoundaryModule, CacheView, FailureView, LocalView, MainAccount } from './contracts.js';
const { app, BrowserWindow, ipcMain, shell, safeStorage, net, dialog } = (require('electron') as typeof import('electron'));
import fs = require('node:fs');
import path = require('node:path');
const { GitHub, repoParts, normalizeServerUrl, repositoryKey, parseLearningGateContent, parseLearningCurriculumContent, learningCurriculumGateIds } = (require('./github.cjs') as typeof import('../github/client.cjs'));
const { randomUUID } = (require('node:crypto') as typeof import('node:crypto'));
const { spawn } = (require('node:child_process') as typeof import('node:child_process'));
const { createUpdater } = (require('./updater.cjs') as typeof import('../update/updater.cjs'));
const { prepareFileUpgrade, recoverFileUpgrade, cancelPreparedFileUpgrade, getFileUpgradeCapability } = (require('./file-upgrade.cjs') as typeof import('../update/file-upgrade.cjs'));
const { cleanupUpdateStorage } = (require('./update-storage.cjs') as typeof import('../update/storage.cjs'));
const { createAuth, createClistCredentials, configureUserData } = (require('./auth.cjs') as typeof import('../auth/auth.cjs'));
const { createContestService } = (require('./contests.cjs') as typeof import('../contests/service.cjs'));
const { dailyDraw, applyClistDifficultyReference } = (require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs'));
const { createClistService, createClistRatingCacheReader } = (require('./clist-service.cjs') as typeof import('../clist/service.cjs'));
const { createDifficultyBackfill, readDifficultyBackfillState, createBackfillOutcomeReader } = (require('./difficulty-backfill.cjs') as typeof import('../library/difficulty-backfill.cjs'));
const { createLibraryLoader, buildDailyTagCatalog } = (require('./library-index.cjs') as typeof import('../library/index.cjs'));
const { createSync } = (require('./library-sync.cjs') as typeof import('../library/sync.cjs'));
const { createProblemEnrichment, canonicalProblemUrl } = require('./problem-enrichment.cjs') as typeof import('../library/enrichment.cjs');
const { createClistBulk } = require('./clist-bulk.cjs') as typeof import('../clist/bulk.cjs');
const { createClistSharedCache } = require('./clist-shared-cache.cjs') as typeof import('../clist/shared-cache.cjs');
const { createProblemAI } = require('./problem-enrichment-ai.cjs') as typeof import('../library/enrichment-ai.cjs');
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
let clistService: ReturnType<typeof createClistService> | undefined;
let libraryLoader: ReturnType<typeof createLibraryLoader> | undefined;
let librarySyncing = false;
let librarySyncController: { pause(): void } | null = null;
let librarySyncPauseRequested = false;
let librarySyncState: import('../../shared/models/library-sync.js').LibrarySyncState = {
  running: false, pauseRequested: false, mode: null, startedAt: null, finishedAt: null, platforms: {}, totalCount: 0
};
let difficultyBackfill: ReturnType<typeof createDifficultyBackfill> | null = null;
let difficultyBackfillPauseRequested = false;
let difficultyBackfillState: import('../../shared/models/difficulty-backfill.js').DifficultyBackfillState = {
  status: 'idle', running: false, pauseRequested: false, batchSize: 100, processed: 0, found: 0, skipped: 0, failed: 0,
  startedAt: null, finishedAt: null, platforms: {}
};
let problemEnrichment: ReturnType<typeof createProblemEnrichment>;
let problemAI: ReturnType<typeof createProblemAI>;
let clistSharedCache: ReturnType<typeof createClistSharedCache>;
let clistBulk: ReturnType<typeof createClistBulk>;
let clistBulkRunning = false;
const recentDrawProblems = new Map<string, import('../../shared/models/daily-problem.js').DailyDrawProblem>();
let clistCredentialFingerprint = '';
let clistCredentials: ReturnType<typeof createClistCredentials>;
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
function cachedLearningCurriculum(value: unknown, topics: unknown, scope = sourceScope()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.repo !== scope.repo || record.sourceKey !== scope.sourceKey || record.serverUrl !== scope.serverUrl) return null;
  try {
    const additions = Array.isArray(topics) ? (require('./algorithm-topics.cjs') as typeof import('../algorithms/topics.cjs')).validateTopics(topics) : [];
    return annotate(parseLearningCurriculumContent({ ...record, schema: 1 }, record.sha, additions), scope);
  } catch { return null; }
}
function cachedLearningContents(value: unknown, scope = sourceScope(), curriculum: import('../../shared/models/learning-curriculum.js').LearningCurriculumDocument | null = null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const record = raw as Record<string, unknown>;
    if (record.repo !== undefined && record.repo !== scope.repo || record.sourceKey !== undefined && record.sourceKey !== scope.sourceKey || record.serverUrl !== undefined && record.serverUrl !== scope.serverUrl) return [];
    if (!learningCurriculumGateIds(curriculum).has(String(record.gateId))) return [];
    try { return [annotate(parseLearningGateContent({ ...record, schema: 1 }, String(record.gateId), record.sha), scope)]; } catch { return []; }
  });
}
function libraryPlatforms(input: unknown): string[] | undefined {
  const filter = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const supported = /^(CF|AT|LG|NC|LC|LOJ)$/;
  const platform = typeof filter.platform === 'string' ? filter.platform.toUpperCase() : '';
  if (supported.test(platform)) return [platform];
  const source = typeof filter.source === 'string' ? filter.source.toUpperCase() : '';
  if (supported.test(source)) return [source];
  return undefined;
}
function librarySnapshot(input: unknown) {
  if (!libraryLoader) return undefined;
  try {
    const snapshot = libraryLoader.load(libraryPlatforms(input));
    return snapshot.records.length ? { records: snapshot.records, builtAt: snapshot.builtAt } : undefined;
  } catch { return undefined; }
}
function enrichmentProblem(url: string) {
  const target = canonicalProblemUrl(url);
  const indexed = libraryLoader?.load().records.find(problem => { try { return canonicalProblemUrl(problem.url) === target; } catch { return false; } });
  const problem = indexed ?? recentDrawProblems.get(`${sourceScope().sourceKey}|${loginGeneration}|${target}`) ?? null;
  return problem;
}
function readRatingCache(): unknown {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'clist-rating-cache.json'), 'utf8')) as unknown; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
let ratingReaderCache: { stamp: string; reader: ReturnType<typeof createClistRatingCacheReader> } | undefined;
function currentRatingReader() {
  let stamp: string | undefined;
  try {
    const stat = fs.statSync(path.join(dir, 'clist-rating-cache.json'));
    if (typeof stat.mtimeMs === 'number' && typeof stat.ctimeMs === 'number') stamp = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (stamp !== undefined && ratingReaderCache?.stamp === stamp) return ratingReaderCache.reader;
  ratingReaderCache = undefined;
  const reader = createClistRatingCacheReader(readRatingCache());
  if (stamp !== undefined) ratingReaderCache = { stamp, reader };
  return reader;
}
function cachedClistProblem(problem: import('../../shared/models/daily-problem.js').DailyDrawProblem, reader: (url: string) => import('../clist/service.cjs').ClistRatingResult | null, outcomeReader?: (url: string) => 'not-found' | 'no-rating' | null) {
  const cached = reader(problem.url);
  if (cached?.noData) return applyClistDifficultyReference({ ...problem, clistRating: 0, clistRatingCached: true, clistRatingQueriedAt: cached.queriedAt, clistRatingStale: false });
  const result = cached?.rating != null ? applyClistDifficultyReference({ ...problem, clistRating: cached.rating, clistRatingCached: true, clistRatingQueriedAt: cached.queriedAt, clistRatingStale: false }) : applyClistDifficultyReference(problem);
  const outcome = outcomeReader?.(problem.url);
  return result.clistRating == null && outcome === 'not-found' ? { ...result, clistRatingStatus: 'not-found' as const } : result;
}
function knownProblemDifficulty(problem: import('../../shared/models/daily-problem.js').DailyDrawProblem): string | null {
  if (problem.source === 'AT') return problem.communityDifficulty != null ? String(problem.communityDifficulty) : null;
  return problem.officialDifficulty ?? null;
}
type BackfillPlatform = import('../../shared/models/difficulty-backfill.js').DifficultyBackfillPlatformState;
let backfillGapCache: { key: string; platforms: Record<string, BackfillPlatform> } | null = null;
function difficultyGaps(): Record<string, BackfillPlatform> {
  const snapshot = libraryLoader?.load();
  if (!snapshot) return {};
  const stamp = (name: string) => { try { const stat = fs.statSync(path.join(dir, name)); return `${stat.mtimeMs}:${stat.size}`; } catch { return 'absent'; } };
  const key = `${snapshot.builtAt}|${stamp('clist-rating-cache.json')}|${stamp('problem-enrichments.json')}`;
  if (backfillGapCache?.key === key) return backfillGapCache.platforms;
  const ratingReader = currentRatingReader();
  problemEnrichment.refresh();
  const platforms: Record<string, BackfillPlatform> = {};
  for (const original of snapshot.records) {
    const problem = original;
    const entry = platforms[problem.source] ??= { total: 0, clistCached: 0, clistPending: 0, missing: 0, sourceMissing: 0, resolved: 0, attempted: 0, found: 0 };
    entry.total = (entry.total ?? 0) + 1;
    const cached = ratingReader(problem.url);
    const hasClist = (cached?.rating != null && cached.rating > 0) || (problem.clistRating != null && problem.clistRating > 0);
    if (hasClist) entry.clistCached = (entry.clistCached ?? 0) + 1;
    else entry.clistPending = (entry.clistPending ?? 0) + 1;
    if (knownProblemDifficulty(problem) !== null) continue;
    entry.sourceMissing = (entry.sourceMissing ?? 0) + 1;
    const supplemented = problemEnrichment.apply(problem);
    const resolved = hasClist || (supplemented.supplementInfo?.difficulty === true && ((supplemented.estimatedCfRating != null && supplemented.estimatedCfRating > 0) || Boolean(supplemented.estimatedLuoguDifficulty)));
    if (resolved) entry.resolved = (entry.resolved ?? 0) + 1;
    else entry.missing += 1;
  }
  backfillGapCache = { key, platforms };
  return platforms;
}
function withDifficultyGaps(state: import('../../shared/models/difficulty-backfill.js').DifficultyBackfillState) {
  const gaps = difficultyGaps(), platforms: Record<string, BackfillPlatform> = { ...gaps };
  for (const [key, value] of Object.entries(state.platforms)) platforms[key] = { ...value,
    missing: gaps[key]?.missing ?? 0, sourceMissing: gaps[key]?.sourceMissing ?? 0, resolved: gaps[key]?.resolved ?? 0,
    total: gaps[key]?.total ?? 0, clistCached: gaps[key]?.clistCached ?? 0, clistPending: gaps[key]?.clistPending ?? 0 };
  return { ...state, platforms };
}
function refreshClistService() {  let credentials: { username: string; apiKey: string } | null = null;
  try { credentials = clistCredentials?.load() ?? null; } catch { credentials = null; }
  const fingerprint = credentials ? `${credentials.username}\u0000${credentials.apiKey}` : '';
  if (fingerprint !== clistCredentialFingerprint) {
    clistCredentialFingerprint = fingerprint;
    clistService = credentials ? createClistService({ credentials: { account: credentials.username, key: credentials.apiKey }, fetcher: networkFetch, timeoutMs: 30_000, readRatingCache, writeRatingCache: value => save('clist-rating-cache.json', value) }) : undefined;
  }
  return clistService;
}
function state(error?: string) {
  const s = settings(), scope = sourceScope(s), cache = read('cache.json', {}) as CacheView;
  const c = repoCache(cache, s.repo, s.serverUrl);
  const matching = c.repo === s.repo;
  const curriculum = matching ? cachedLearningCurriculum(c.learningCurriculum, c.algorithmTopics, scope) : null;
  return {
    records: matching ? (c.records || []).filter(r => r.kind === 'document').map(r => annotate(r, scope)) : [],
    algorithmNotes: matching ? (c.algorithmNotes || []).map(r => annotate(r, scope)) : [],
    algorithmTopics: matching && Array.isArray(c.algorithmTopics) ? c.algorithmTopics.map(topic => annotate(topic, scope)) : [],
    learningGateContents: matching ? cachedLearningContents(c.learningGateContents, scope, curriculum) : [],
    learningCurriculum: curriculum,
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
  clistCredentials = createClistCredentials({ safeStorage,
    readAuth: () => JSON.parse(fs.readFileSync(path.join(dir, 'clist-auth.json'), 'utf8')) as unknown,
    saveAuth: value => save('clist-auth.json', value) });
  handle('saveClistCredentials', data => { const result = clistCredentials.save(data); clistCredentialFingerprint = ''; clistService = undefined; return result; });
  handle('clearClistCredentials', () => { const result = clistCredentials.clear(); clistCredentialFingerprint = ''; clistService = undefined; return result; });
  handle('getClistStatus', () => clistCredentials.status());
  libraryLoader = createLibraryLoader(path.join(dir, 'library'), fs, path);
  clistSharedCache = createClistSharedCache({ directory: dir, fs, path, fetcher: networkFetch,
    initialCacheFile: process.env.QMX_ISOLATED_SANDBOX === '1' ? undefined : path.join(__dirname, 'data', 'clist-initial-cache.json') });
  if (process.env.QMX_ISOLATED_SANDBOX !== '1' && fs.existsSync(path.join(__dirname, 'data', 'clist-initial-cache.json'))) clistSharedCache.ensureInitial();
  clistBulk = createClistBulk({
    read: () => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'clist-bulk-progress.json'), 'utf8')) as unknown; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; } },
    save: value => save('clist-bulk-progress.json', value),
    fetchPage: (resource, offset) => { const service = refreshClistService(); if (!service) throw new Error('请先配置 CLIST 用户名与 API Key'); return service.fetchRatedPage(resource, offset); },
    mergeRatings: document => clistSharedCache.importDocument(document)
  });
  handle('getClistBulkStatus', () => clistBulk.state());
  handle('pauseClistBulkSync', () => clistBulk.pause());
  handle('startClistBulkSync', async () => {
    ensureIdle();
    if (writeBusy || syncBusy || difficultyBackfill || clistBulkRunning) throw new Error('请等待当前查询或缓存合并完成');
    if (!refreshClistService()) throw new Error('请先配置 CLIST 用户名与 API Key；内置缓存无需 Key 即可使用');
    clistBulkRunning = true;
    try { return await clistBulk.run(); }
    finally { clistBulkRunning = false; backfillGapCache = null; }
  });
  const ensureCacheIdle = () => { if (difficultyBackfill || clistBulkRunning) throw new Error('CLIST 查询正在进行，请先暂停后合并缓存'); };
  const cacheMerged = () => { clistService = undefined; clistCredentialFingerprint = ''; backfillGapCache = null; };
  handle('getClistSharedCacheStatus', () => {
    const status = clistSharedCache.status();
    const platforms = Object.values(difficultyGaps());
    return { ...status, libraryTotal: platforms.reduce((sum, entry) => sum + (entry.total ?? 0), 0),
      libraryMatched: platforms.reduce((sum, entry) => sum + (entry.clistCached ?? 0), 0) };
  });
  handle('exportClistSharedCache', () => writeOperation(async () => {
    const selected = await dialog.showSaveDialog(win, { title: '导出 CLIST 评分缓存', defaultPath: 'qmx-clist-rating-cache.json', filters: [{ name: 'CLIST 评分缓存 JSON', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePath) return { canceled: true, status: clistSharedCache.status() };
    return { canceled: false, status: clistSharedCache.exportFile(selected.filePath) };
  }));
  handle('importClistSharedCache', () => writeOperation(async () => {
    ensureCacheIdle();
    const selected = await dialog.showOpenDialog(win, { title: '导入并合并 CLIST 评分缓存', properties: ['openFile'], filters: [{ name: 'CLIST 评分缓存 JSON', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true, imported: 0, updated: 0, kept: 0, ignored: 0, status: clistSharedCache.status() };
    ensureCacheIdle();
    const result = clistSharedCache.importFile(selected.filePaths[0]); cacheMerged(); return result;
  }));
  handle('syncClistSharedCache', input => writeOperation(async () => {
    ensureCacheIdle();
    if (typeof input !== 'string') throw new Error('共享缓存地址无效');
    const result = await clistSharedCache.syncFromUrl(input); cacheMerged(); return result;
  }));
  problemEnrichment = createProblemEnrichment({
    read: () => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'problem-enrichments.json'), 'utf8')) as unknown; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; } },
    save: value => save('problem-enrichments.json', value), findProblem: enrichmentProblem
  });
  problemAI = createProblemAI({ safeStorage,
    readConfig: () => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'ai-auth.json'), 'utf8')) as unknown; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; } },
    saveConfig: value => save('ai-auth.json', value), fetcher: networkFetch as typeof fetch
  });
  handle('getProblemEnrichment', url => {
      const view = problemEnrichment.view(String(url)), problem = enrichmentProblem(view.url);
    return { ...view, ...(problem ? { problem: problemEnrichment.apply(cachedClistProblem(problem, currentRatingReader(), createBackfillOutcomeReader(read('difficulty-backfill-ledger.json', undefined)))) } : {}) };
  });
  handle('saveProblemEnrichment', input => writeOperation(() => problemEnrichment.saveSupplement(input)));
  handle('removeProblemEnrichment', input => writeOperation(() => problemEnrichment.removeSupplement(input)));
  handle('refreshProblemClistRating', input => writeOperation(async () => {
    if (typeof input !== 'string') throw new Error('题目链接无效');
    const original = enrichmentProblem(input);
    if (!original) throw new Error('该题尚未进入当前题库，请先抽取题目');
      const problem = original;
    const scope = sourceScope(), generation = loginGeneration;
    problemEnrichment.refresh();
    const service = refreshClistService();
    if (!service) {
      const previous = cachedClistProblem(problem, currentRatingReader());
      return { problem: problemEnrichment.apply(previous), message: '请先在设置中配置 CLIST，已保存的评分仍可使用' };
    }
    const result = await service.lookupRating(problem.url, true);
    ensureSource(scope.sourceKey, generation);
    const updated = result.rating == null ? result.noData ? applyClistDifficultyReference({ ...problem, clistRating: 0 }) : result.error === 'CLIST 未收录该题' ? { ...problem, clistRatingStatus: 'not-found' as const } : problem : applyClistDifficultyReference({ ...problem, clistRating: result.rating,
      clistRatingStatus: 'available', clistRatingCached: result.cached, clistRatingStale: result.stale, clistRatingQueriedAt: result.queriedAt });
    const failure = result.error;
    return { problem: problemEnrichment.apply(updated), message: failure ? result.rating != null ? '刷新失败，保留缓存评分' : failure : '' };
  }));
  handle('getProblemAIStatus', () => problemAI.status());
  handle('saveProblemAIConfig', input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AI 配置格式无效');
    const value = input as { endpoint?: unknown; model?: unknown; apiKey?: unknown };
    if (typeof value.endpoint !== 'string' || typeof value.model !== 'string' || (value.apiKey !== undefined && typeof value.apiKey !== 'string')) throw new Error('AI 配置格式无效');
    const validated = { endpoint: value.endpoint, model: value.model, apiKey: value.apiKey };
    return writeOperation(() => problemAI.save(validated));
  });
  handle('clearProblemAIConfig', () => writeOperation(() => problemAI.clear()));
  handle('suggestProblemEnrichment', input => writeOperation(async () => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AI 建议请求无效');
    const value = input as { url?: unknown; statementText?: unknown };
    if (typeof value.url !== 'string' || typeof value.statementText !== 'string') throw new Error('AI 建议请求无效');
    const view = problemEnrichment.view(value.url);
    const fields = await problemAI.suggest(view, value.statementText);
    const { model, ...suggestion } = fields;
    return problemEnrichment.storeSuggestion(view.url, suggestion, model);
  }));
  planner = createPlannerService({ read, save });
  platforms = createPlatformService({ read, save, fetcher: networkFetch, readPage: createPublicPageReader({ BrowserWindow }) });
  // Public schedules use stateless Node fetch, separate from Chromium session cookies.
  contestService = createContestService({ fetcher: (url, options) => fetch(url, options), readCache: () => read('contests.json', null), writeCache: value => save('contests.json', value) });
  handle('getContests', force => contestService.get(force));
  handle('updateLibrary', async full => {
    if (librarySyncing) throw new Error('题库正在更新，请稍候');
    librarySyncing = true;
    librarySyncState = { ...librarySyncState, running: true, pauseRequested: false, mode: full === true ? 'full' : 'incremental', startedAt: new Date().toISOString(), finishedAt: null };
    try {
      // Index sync is a public-data fetch; Node's transport avoids the Chromium
      // redirect challenge that blocks the Luogu listing in the app session.
      const sync = createSync({
        directory: path.join(dir, 'library'), fs, path, fetcher: fetch, full: full === true,
        onState: state => { librarySyncState = state; },
        readState: () => read(path.join('library', 'sync-state.json'), null),
        writeState: value => save(path.join('library', 'sync-state.json'), value),
        shouldPause: () => librarySyncPauseRequested
      });
      librarySyncController = sync;
      const report = await sync.run();
      librarySyncState = { ...librarySyncState, running: false, finishedAt: new Date().toISOString() };
      return report;
    } finally { librarySyncController = null; librarySyncing = false; librarySyncPauseRequested = false; }
  });
  handle('getLibrarySyncStatus', () => {
    if (librarySyncing) return librarySyncState;
    const persisted = read(path.join('library', 'sync-state.json'), null);
    const shape = persisted !== null && typeof persisted === 'object' && !Array.isArray(persisted) ? persisted as Record<string, unknown> : null;
    if (shape && typeof shape.platforms === 'object' && shape.platforms !== null) {
      return { ...librarySyncState, ...shape, running: false, pauseRequested: false } as import('../../shared/models/library-sync.js').LibrarySyncState;
    }
    return { ...librarySyncState, running: false, pauseRequested: false };
  });
  handle('pauseLibrarySync', () => {
    if (!librarySyncing) return librarySyncState;
    librarySyncPauseRequested = true;
    librarySyncState = { ...librarySyncState, pauseRequested: true };
    librarySyncController?.pause();
    return librarySyncState;
  });
  handle('getDifficultyBackfillStatus', () => {
    if (difficultyBackfill) return withDifficultyGaps(difficultyBackfillState);
    difficultyBackfillState = readDifficultyBackfillState(read('difficulty-backfill.json', undefined), 100);
    if (difficultyBackfillState.running) difficultyBackfillState = { ...difficultyBackfillState, running: false, pauseRequested: true, status: 'paused', message: '上次任务已停止，可开始下一批继续' };
    return withDifficultyGaps(difficultyBackfillState);
  });
  handle('pauseDifficultyBackfill', () => {
    if (!difficultyBackfill) return difficultyBackfillState;
    difficultyBackfillPauseRequested = true;
    difficultyBackfillState = { ...difficultyBackfillState, pauseRequested: true, status: 'pausing' };
    return withDifficultyGaps(difficultyBackfillState);
  });
  handle('startDifficultyBackfill', async () => {
    if (writeBusy || syncBusy || clistBulkRunning) throw new Error('请等待当前分页查询、缓存合并或同步完成');
    if (difficultyBackfill) throw new Error('难度补全正在进行，请稍候');
    const clist = refreshClistService();
    if (!clist) throw new Error('请先在账户设置中配置 CLIST 用户名与 API Key');
    const snapshot = libraryLoader?.load() ?? { records: [] };
      const ratingReader = currentRatingReader();
    const records = snapshot.records.map(problem => ({ id: problem.id, url: problem.url, source: problem.source, officialDifficulty: knownProblemDifficulty(problem),
      clistRating: ratingReader(problem.url)?.rating ?? (problem.clistRating != null && problem.clistRating > 0 ? problem.clistRating : null) }));
    difficultyBackfillPauseRequested = false;
    const controller = createDifficultyBackfill({
      records,
      lookup: url => clist.lookupRating(url),
      readLedger: () => read('difficulty-backfill-ledger.json', undefined),
      writeLedger: value => save('difficulty-backfill-ledger.json', value),
      readState: () => read('difficulty-backfill.json', undefined),
      writeState: value => { difficultyBackfillState = value as import('../../shared/models/difficulty-backfill.js').DifficultyBackfillState; save('difficulty-backfill.json', value); },
      shouldPause: () => difficultyBackfillPauseRequested,
      batchSize: 100
    });
    difficultyBackfill = controller;
    try { return withDifficultyGaps(await controller.run()); }
    finally { difficultyBackfill = null; difficultyBackfillPauseRequested = false; }
  });
  handle('getDailyTagCatalog', () => {
    problemEnrichment.refresh();
    const snapshot = libraryLoader?.load() ?? { records: [], builtAt: null };
    return buildDailyTagCatalog({ ...snapshot, records: snapshot.records.map(problem => problemEnrichment.apply(problem)) });
  });
  handle('dailyDraw', async filters => {
    const scope = sourceScope(), generation = loginGeneration;
    const cache = repoCache(read('cache.json', {}) as CacheView, scope.repo, scope.serverUrl);
    const publicRecords = cache.repo === scope.repo && Array.isArray(cache.records) ? cache.records.filter(record => record.kind === 'document') : [];
    const personal = local() as LocalView;
    const ownRecords = Array.isArray(personal.records) ? personal.records.filter(record => record.kind === 'local' && (record.ownerId == null || account?.id != null && String(record.ownerId) === String(account.id))) : [];
    problemEnrichment.refresh();
      const ratingCache = currentRatingReader();
    const outcomes = createBackfillOutcomeReader(read('difficulty-backfill-ledger.json', undefined));
    const rawProblems = new Map<string, import('../../shared/models/daily-problem.js').DailyDrawProblem>();
    const result = await dailyDraw(filters, [...ownRecords, ...publicRecords], networkFetch as typeof fetch, Math.random, refreshClistService(), librarySnapshot(filters), problem => {
      try { rawProblems.set(canonicalProblemUrl(problem.url), problem); } catch { /* Historical unsupported URL. */ }
      return problemEnrichment.apply(cachedClistProblem(problem, ratingCache, outcomes));
    });
    ensureSource(scope.sourceKey, generation);
    try {
      const url = canonicalProblemUrl(result.problem.url), original = rawProblems.get(url);
      if (original) recentDrawProblems.set(`${scope.sourceKey}|${generation}|${url}`, original);
    } catch { /* Unsupported historical URL cannot be supplemented. */ }
    if (recentDrawProblems.size > 100) recentDrawProblems.delete(recentDrawProblems.keys().next().value!);
    return result;
  });
  handle('bindPlatform', (platform, url) => platforms.bind(platform, url));
  handle('refreshPlatform', platform => platforms.refresh(platform));
  handle('unbindPlatform', platform => platforms.unbind(platform));
  registerUpdateHandlers({ handle, app, updater, isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy,
    isUpdateBusy: () => updateBusy, isInstalling: () => installing, isPlatformBusy: () => platforms.isBusy() || clistBulkRunning || difficultyBackfill !== null,
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
  handle('saveLearningCurriculum', data => writeOperation(async () => {
    requireWritableSource();
    const scope = sourceScope(), gen = loginGeneration;
    const result = await client().saveLearningCurriculum(data);
    ensureSource(scope.sourceKey, gen);
    const old = read('cache.json', {}) as CacheView, c = repoCache(old, scope.repo, scope.serverUrl);
    const saved = annotate(result, scope);
    saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, learningCurriculum: saved, learningGateContents: cachedLearningContents(c.learningGateContents, scope, saved) }, scope);
    return saved;
  }));
  handle('saveLearningGate', data => writeOperation(async () => {
    requireWritableSource();
    const scope = sourceScope(), gen = loginGeneration;
    const result = await client().saveLearningGate(data);
    ensureSource(scope.sourceKey, gen);
    const old = read('cache.json', {}) as CacheView, c = repoCache(old, scope.repo, scope.serverUrl);
    const contents = cachedLearningContents(c.learningGateContents, scope, cachedLearningCurriculum(c.learningCurriculum, c.algorithmTopics, scope)).filter(content => content.gateId !== result.gateId);
    const saved = annotate(result, scope); contents.push(saved);
    saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, learningGateContents: contents }, scope);
    return saved;
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
      const curriculum = cachedLearningCurriculum(result.learningCurriculum, result.algorithmTopics, scope);
      const updated = { ...result, repo, tagCatalog, tagCatalogError, algorithmNotes: Array.isArray(result.algorithmNotes) ? result.algorithmNotes : [], algorithmTopics: Array.isArray(result.algorithmTopics) ? result.algorithmTopics : [], learningCurriculum: curriculum, learningGateContents: cachedLearningContents(result.learningGateContents, scope, curriculum) };
      saveRepoCache(old, updated);
      let sharedCacheError: string | undefined;
      try {
        const sharedSource = clistSharedCache.status().sourceUrl;
        if (sharedSource && !difficultyBackfill && !clistBulkRunning) {
          await clistSharedCache.syncFromUrl(sharedSource);
          clistService = undefined; clistCredentialFingerprint = ''; backfillGapCache = null;
        }
      } catch { sharedCacheError = '资料已同步，共享 CLIST 缓存暂未更新，继续使用本机缓存'; }
      if (token) { try { await refreshIdentity(); } catch (error) { permissions = null; return state(`资料已同步，账号权限刷新失败：${(error as FailureView).message}`); } }
      return state(sharedCacheError);
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
