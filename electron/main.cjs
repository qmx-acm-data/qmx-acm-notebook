// Generated from src/main/app/main.cts; run pnpm modules:build.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { app, BrowserWindow, ipcMain, shell, safeStorage, net } = require('electron');
const fs = require("node:fs");
const path = require("node:path");
const { GitHub, repoParts, normalizeServerUrl, repositoryKey, cachedTrick, parseAlgorithmNodeContent, algorithmContentTargetId, parseLearningGateContent, parseLearningCurriculumContent, learningCurriculumGateIds } = require('./github.cjs');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createUpdater } = require('./updater.cjs');
const { prepareFileUpgrade, recoverFileUpgrade, cancelPreparedFileUpgrade, getFileUpgradeCapability } = require('./file-upgrade.cjs');
const { cleanupUpdateStorage } = require('./update-storage.cjs');
const { createAuth, createClistCredentials, configureUserData } = require('./auth.cjs');
const { createContestService } = require('./contests.cjs');
const { dailyDraw } = require('./daily-problems.cjs');
const { createClistService } = require('./clist-service.cjs');
const { createLibraryLoader } = require('./library-index.cjs');
const { createSync } = require('./library-sync.cjs');
const { createPlatformService } = require('./platform-service.cjs');
const { createPlannerService } = require('./planner-service.cjs');
const { createPublicPageReader } = require('./platform-page.cjs');
const { registerUpdateHandlers, registerSettingsHandlers, createLocalUpdate, registerRecordHandlers } = require('./ipc-handlers.cjs');
const { createSession } = require('./session.cjs');
const APP_VERSION = require('../package.json').version;
configureUserData(app);
const networkFetch = (url, options) => net.fetch(url, { ...options, bypassCustomProtocolHandlers: true });
let auth;
const { createCodeFormatter } = require('./code-formatter.cjs');
const formatCode = createCodeFormatter();
function authFailure(error, ticket) {
    if (auth.failure(error, ticket)) {
        token = auth.token;
        account = auth.account;
        if (error.status === 401)
            permissions = null;
    }
}
app.disableHardwareAcceleration();
// On Linux desktops without a recognized keyring (niri, sway, ...), Chromium picks the plaintext
// backend and safeStorage reports unavailable, which blocks login persistence. Prefer libsecret so a
// running secret service (gnome-keyring/KWallet) can be used; GNOME and KDE keep native detection.
if (process.platform === 'linux' && !app.commandLine.hasSwitch('password-store') && !/gnome|kde/i.test(process.env.XDG_CURRENT_DESKTOP || '')) {
    app.commandLine.appendSwitch('password-store', 'gnome-libsecret');
}
let win, dir;
let contestService, platforms, planner;
let clistService;
let libraryLoader;
let librarySyncing = false;
let clistCredentialFingerprint = '';
let clistCredentials;
let token = '', account = null, permissions = null;
let loginGeneration = 0, writeBusy = false, syncBusy = false, updateBusy = false, installing = false;
let updater;
function processEnvForInstaller() {
    const environment = { ...process.env };
    delete environment.ELECTRON_RUN_AS_NODE;
    return environment;
}
function ensureIdle() {
    if (updateBusy || installing)
        throw new Error('客户端正在更新，请等待更新完成');
}
const { TEAM_CLIENT_ID, defaults, normalizeRepositories, settings, local } = require('./settings.cjs').createSettingsStore({ read, repoParts, normalizeServerUrl, repositoryKey });
function read(name, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    }
    catch {
        return fallback;
    }
}
function save(name, data) {
    const file = path.join(dir, name);
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(file + '.tmp', file);
}
function githubClient(currentToken = token, repo = settings().repo, serverUrl = settings().serverUrl) {
    const ticket = auth.capture();
    serverUrl = normalizeServerUrl(serverUrl);
    if (serverUrl)
        currentToken = '';
    const gh = new GitHub({ repo, token: currentToken, fetcher: networkFetch, serverUrl });
    // All authenticated operations, including writes, invalidate only on a structured HTTP 401.
    return new Proxy(gh, { get(target, name) {
            const value = target[name];
            if (typeof value !== 'function')
                return value;
            return async (...args) => {
                try {
                    return await value.apply(target, args);
                }
                catch (error) {
                    if (currentToken && currentToken === ticket.token)
                        authFailure(error, ticket);
                    throw error;
                }
            };
        } });
}
function client() { return githubClient(); }
function sourceScope(s = settings()) { return { repo: s.repo, serverUrl: normalizeServerUrl(s.serverUrl || ''), sourceKey: repositoryKey(s.repo, s.serverUrl || '') }; }
function annotate(record, scope = sourceScope()) { return { ...record, ...scope }; }
function repoCache(cache, repo = settings().repo, serverUrl = settings().serverUrl) {
    const key = repositoryKey(repo, serverUrl);
    if (cache.repos?.[key])
        return cache.repos[key];
    if (cache.sourceKey === key)
        return cache;
    // Releases before custom sources only cached GitHub; never reuse ambiguous data on Gitea.
    if (!normalizeServerUrl(serverUrl) && !cache.sourceKey && !cache.serverUrl) {
        if (cache.repos?.[repo] && !cache.repos[repo].sourceKey && !cache.repos[repo].serverUrl)
            return cache.repos[repo];
        if (cache.repo === repo)
            return cache;
    }
    return {};
}
function saveRepoCache(old, updated, scope = sourceScope()) {
    const value = { ...updated, ...scope };
    delete value.repos;
    const repos = { ...(old.repos || {}), [scope.sourceKey]: value };
    save('cache.json', { ...value, repos });
}
function ensureSource(key, generation = loginGeneration) {
    if (key !== sourceScope().sourceKey || generation !== loginGeneration)
        throw new Error('账号或仓库配置已改变，请重新同步');
}
function cachedTricks(value, scope = sourceScope()) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    return value.flatMap((raw) => {
        const trick = cachedTrick(raw, scope);
        if (!trick || seen.has(trick.id))
            return [];
        seen.add(trick.id);
        return [trick];
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path));
}
function cachedLearningCurriculum(value, topics, scope = sourceScope()) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const record = value;
    if (record.repo !== scope.repo || record.sourceKey !== scope.sourceKey || record.serverUrl !== scope.serverUrl)
        return null;
    try {
        const additions = Array.isArray(topics) ? require('./algorithm-topics.cjs').validateTopics(topics) : [];
        return annotate(parseLearningCurriculumContent({ ...record, schema: 1 }, record.sha, additions), scope);
    }
    catch {
        return null;
    }
}
function cachedLearningContents(value, scope = sourceScope(), curriculum = null) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return [];
        const record = raw;
        if (record.repo !== undefined && record.repo !== scope.repo || record.sourceKey !== undefined && record.sourceKey !== scope.sourceKey || record.serverUrl !== undefined && record.serverUrl !== scope.serverUrl)
            return [];
        if (!learningCurriculumGateIds(curriculum).has(String(record.gateId)))
            return [];
        try {
            return [annotate(parseLearningGateContent({ ...record, schema: 1 }, String(record.gateId), record.sha), scope)];
        }
        catch {
            return [];
        }
    });
}
function cachedAlgorithmNodeContents(value, topics, scope = sourceScope()) {
    if (!Array.isArray(value))
        return [];
    try {
        const additions = Array.isArray(topics) ? require('./algorithm-topics.cjs').validateTopics(topics) : [];
        const seen = new Set();
        return value.flatMap((raw) => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                return [];
            const record = raw;
            if (record.repo !== scope.repo || record.sourceKey !== scope.sourceKey || record.serverUrl !== scope.serverUrl)
                return [];
            try {
                const content = parseAlgorithmNodeContent({ ...record, schema: 1 }, record.sha);
                const storageNodeId = content.storageNodeId ?? content.nodeId;
                const nodeId = algorithmContentTargetId(storageNodeId, additions);
                if (!nodeId || algorithmContentTargetId(content.nodeId, additions) !== nodeId || seen.has(nodeId))
                    return [];
                seen.add(nodeId);
                return [annotate({ ...content, nodeId, ...(storageNodeId === nodeId ? {} : { storageNodeId }) }, scope)];
            }
            catch {
                return [];
            }
        });
    }
    catch {
        return [];
    }
}
function libraryPlatforms(input) {
    const filter = input && typeof input === 'object' ? input : {};
    const supported = /^(CF|AT|LG|NC|LC|LOJ)$/;
    const platform = typeof filter.platform === 'string' ? filter.platform.toUpperCase() : '';
    if (supported.test(platform))
        return [platform];
    const source = typeof filter.source === 'string' ? filter.source.toUpperCase() : '';
    if (supported.test(source))
        return [source];
    return undefined;
}
function librarySnapshot(input) {
    if (!libraryLoader)
        return undefined;
    try {
        const snapshot = libraryLoader.load(libraryPlatforms(input));
        return snapshot.records.length ? { records: snapshot.records, builtAt: snapshot.builtAt } : undefined;
    }
    catch {
        return undefined;
    }
}
function refreshClistService() {
    let credentials = null;
    try {
        credentials = clistCredentials?.load() ?? null;
    }
    catch {
        credentials = null;
    }
    const fingerprint = credentials ? `${credentials.username}\u0000${credentials.apiKey}` : '';
    if (fingerprint !== clistCredentialFingerprint) {
        clistCredentialFingerprint = fingerprint;
        clistService = credentials ? createClistService({ credentials: { account: credentials.username, key: credentials.apiKey }, fetcher: networkFetch, timeoutMs: 30_000 }) : undefined;
    }
    return clistService;
}
function state(error) {
    const s = settings(), scope = sourceScope(s), cache = read('cache.json', {});
    const c = repoCache(cache, s.repo, s.serverUrl);
    const matching = c.repo === s.repo;
    const curriculum = matching ? cachedLearningCurriculum(c.learningCurriculum, c.algorithmTopics, scope) : null;
    return {
        records: matching ? (c.records || []).filter(r => r.kind === 'document').map(r => annotate(r, scope)) : [],
        algorithmNotes: matching ? (c.algorithmNotes || []).map(r => annotate(r, scope)) : [],
        tricks: matching ? cachedTricks(c.tricks, scope) : [],
        algorithmTopics: matching && Array.isArray(c.algorithmTopics) ? c.algorithmTopics.map(topic => annotate(topic, scope)) : [],
        algorithmNodeContents: matching ? cachedAlgorithmNodeContents(c.algorithmNodeContents, c.algorithmTopics, scope) : [],
        learningGateContents: matching ? cachedLearningContents(c.learningGateContents, scope, curriculum) : [],
        learningCurriculum: curriculum,
        issues: matching ? (c.issues || (c.records || []).filter(r => r.kind === 'issue')).map(r => annotate(r, scope)) : [],
        lastSync: matching ? c.lastSync : null,
        tagCatalog: matching && c.tagCatalog ? c.tagCatalog : require('../ui/tag-presets.js'),
        tagCatalogError: matching ? c.tagCatalogError || null : null,
        settings: s, account, authStatus: auth?.status, appVersion: APP_VERSION, update: updater?.getState(), updateCapability: getFileUpgradeCapability(), permissions: permissions?.sourceKey === scope.sourceKey ? permissions : null,
        local: local(), contests: contestService?.snapshot(), platforms: platforms?.state(), planner: planner?.state(), error: error || null
    };
}
const { assertExternal, external, chromePath, openAuthUrl } = require('./external-links.cjs').createExternalLinks({ shell, fs, spawn, env: process.env, platform: process.platform, setTimeout, clearTimeout });
const { login, refreshIdentity } = createSession({ networkFetch, getAuth: () => auth,
    getToken: () => token, setToken: value => { token = value; }, getAccount: () => account,
    setAccount: value => { account = value; }, setPermissions: value => { permissions = value; },
    getLoginGeneration: () => loginGeneration, nextLoginGeneration: () => ++loginGeneration,
    isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy, sourceScope, ensureSource, githubClient,
    annotate, settings, state, sendAuthProgress: progress => win.webContents.send('auth-progress', progress),
    openAuthUrl, URL, Buffer, AbortSignal, Date, setTimeout });
async function writeOperation(fn) {
    if (writeBusy || syncBusy)
        throw new Error('上一项操作正在进行，请勿重复操作');
    writeBusy = true;
    try {
        return await fn();
    }
    finally {
        writeBusy = false;
    }
}
function handle(name, fn) {
    ipcMain.handle(name, async (event, ...args) => {
        if (event.sender !== win.webContents)
            throw new Error('非法调用');
        if (!['bootstrap', 'checkStartupUpdates', 'checkForUpdates', 'downloadUpdate', 'installUpdate', 'updateLocal', 'exportLocal'].includes(name))
            ensureIdle();
        return fn(...args);
    });
}
function requireWritableSource() {
    if (sourceScope().serverUrl)
        throw new Error('自定义 Gitea 目前仅支持匿名读取公开仓库；请切换 GitHub 仓库后写入');
}
function setup() {
    clistCredentials = createClistCredentials({ safeStorage,
        readAuth: () => JSON.parse(fs.readFileSync(path.join(dir, 'clist-auth.json'), 'utf8')),
        saveAuth: value => save('clist-auth.json', value) });
    handle('saveClistCredentials', data => { const result = clistCredentials.save(data); clistCredentialFingerprint = ''; clistService = undefined; return result; });
    handle('clearClistCredentials', () => { const result = clistCredentials.clear(); clistCredentialFingerprint = ''; clistService = undefined; return result; });
    handle('getClistStatus', () => clistCredentials.status());
    libraryLoader = createLibraryLoader(path.join(dir, 'library'), fs, path);
    planner = createPlannerService({ read, save });
    platforms = createPlatformService({ read, save, fetcher: networkFetch, readPage: createPublicPageReader({ BrowserWindow }) });
    // Public schedules use stateless Node fetch, separate from Chromium session cookies.
    contestService = createContestService({ fetcher: (url, options) => fetch(url, options), readCache: () => read('contests.json', null), writeCache: value => save('contests.json', value) });
    handle('getContests', force => contestService.get(force));
    handle('updateLibrary', async (full) => {
        if (librarySyncing)
            throw new Error('题库正在更新，请稍候');
        librarySyncing = true;
        try {
            // Index sync is a public-data fetch; Node's transport avoids the Chromium
            // redirect challenge that blocks the Luogu listing in the app session.
            const report = await createSync({ directory: path.join(dir, 'library'), fs, path, fetcher: fetch, full: full === true }).run();
            return report;
        }
        finally {
            librarySyncing = false;
        }
    });
    handle('dailyDraw', async (filters) => {
        const scope = sourceScope(), generation = loginGeneration;
        const cache = repoCache(read('cache.json', {}), scope.repo, scope.serverUrl);
        const publicRecords = cache.repo === scope.repo && Array.isArray(cache.records) ? cache.records.filter(record => record.kind === 'document') : [];
        const personal = local();
        const ownRecords = Array.isArray(personal.records) ? personal.records.filter(record => record.kind === 'local' && (record.ownerId == null || account?.id != null && String(record.ownerId) === String(account.id))) : [];
        const result = await dailyDraw(filters, [...ownRecords, ...publicRecords], networkFetch, Math.random, refreshClistService(), librarySnapshot(filters));
        ensureSource(scope.sourceKey, generation);
        return result;
    });
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
        const old = read('cache.json', {});
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
        if (repo === settings().repo && data.decision === 'approve') {
            const old = read('cache.json', {});
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
    handle('saveTrick', data => writeOperation(async () => {
        requireWritableSource();
        const scope = sourceScope(), generation = loginGeneration;
        const result = await client().saveTrick(data);
        ensureSource(scope.sourceKey, generation);
        const saved = cachedTrick(result, scope);
        if (!saved)
            throw new Error('Trick写入结果无效，请先同步核实');
        const old = read('cache.json', {}), c = repoCache(old, scope.repo, scope.serverUrl);
        const tricks = cachedTricks(c.tricks, scope).filter(trick => trick.path !== saved.path);
        tricks.push(saved);
        saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, tricks }, scope);
        return saved;
    }));
    handle('deleteTrick', data => writeOperation(async () => {
        requireWritableSource();
        const scope = sourceScope(), generation = loginGeneration;
        const result = await client().deleteTrick(data);
        ensureSource(scope.sourceKey, generation);
        const old = read('cache.json', {}), c = repoCache(old, scope.repo, scope.serverUrl);
        saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, tricks: cachedTricks(c.tricks, scope).filter(trick => trick.path !== result.path) }, scope);
        return result;
    }));
    handle('saveAlgorithmTopic', data => writeOperation(async () => {
        requireWritableSource();
        const scope = sourceScope(), gen = loginGeneration, repo = scope.repo;
        const result = await client().saveAlgorithmTopic(data);
        ensureSource(scope.sourceKey, gen);
        // Persist only the complete additions list returned after the repository commit succeeded.
        const old = read('cache.json', {});
        const c = repoCache(old, repo);
        const updated = { ...(c.repo === repo ? c : {}), repo, algorithmTopics: result.topics };
        saveRepoCache(old, updated);
        return result.topic;
    }));
    handle('saveAlgorithmNodeContent', data => writeOperation(async () => {
        requireWritableSource();
        const scope = sourceScope(), gen = loginGeneration;
        const result = await client().saveAlgorithmNodeContent(data);
        ensureSource(scope.sourceKey, gen);
        const old = read('cache.json', {}), c = repoCache(old, scope.repo, scope.serverUrl);
        const contents = cachedAlgorithmNodeContents(c.algorithmNodeContents, c.algorithmTopics, scope).filter(content => content.nodeId !== result.nodeId);
        const saved = annotate(result, scope);
        contents.push(saved);
        saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, algorithmNodeContents: contents }, scope);
        return saved;
    }));
    handle('saveLearningCurriculum', data => writeOperation(async () => {
        requireWritableSource();
        const scope = sourceScope(), gen = loginGeneration;
        const result = await client().saveLearningCurriculum(data);
        ensureSource(scope.sourceKey, gen);
        const old = read('cache.json', {}), c = repoCache(old, scope.repo, scope.serverUrl);
        const saved = annotate(result, scope);
        saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, learningCurriculum: saved, learningGateContents: cachedLearningContents(c.learningGateContents, scope, saved) }, scope);
        return saved;
    }));
    handle('saveLearningGate', data => writeOperation(async () => {
        requireWritableSource();
        const scope = sourceScope(), gen = loginGeneration;
        const result = await client().saveLearningGate(data);
        ensureSource(scope.sourceKey, gen);
        const old = read('cache.json', {}), c = repoCache(old, scope.repo, scope.serverUrl);
        const contents = cachedLearningContents(c.learningGateContents, scope, cachedLearningCurriculum(c.learningCurriculum, c.algorithmTopics, scope)).filter(content => content.gateId !== result.gateId);
        const saved = annotate(result, scope);
        contents.push(saved);
        saveRepoCache(old, { ...(c.repo === scope.repo ? c : {}), repo: scope.repo, learningGateContents: contents }, scope);
        return saved;
    }));
    handle('refreshAccount', async () => {
        if (!token)
            throw new Error('请先登录 GitHub');
        return writeOperation(() => refreshIdentity());
    });
    handle('sync', async () => {
        if (writeBusy || syncBusy)
            throw new Error('请等待当前操作完成');
        syncBusy = true;
        try {
            const scope = sourceScope(), gen = loginGeneration, repo = scope.repo, old = read('cache.json', {});
            const c = repoCache(old, repo);
            const result = await client().sync(c.repo === repo ? c : {});
            ensureSource(scope.sourceKey, gen);
            let tagCatalog = c.repo === repo ? c.tagCatalog : null, tagCatalogError = null;
            try {
                tagCatalog = await client().getTagCatalog();
            }
            catch (error) {
                tagCatalogError = error.status === 401 ? '标签目录授权已失效，请重新登录' : '标签目录暂未更新，继续使用已缓存的标签';
            }
            ensureSource(scope.sourceKey, gen);
            const curriculum = cachedLearningCurriculum(result.learningCurriculum, result.algorithmTopics, scope);
            const updated = { ...result, repo, tagCatalog, tagCatalogError, tricks: cachedTricks(result.tricks, scope), algorithmNotes: Array.isArray(result.algorithmNotes) ? result.algorithmNotes : [], algorithmTopics: Array.isArray(result.algorithmTopics) ? result.algorithmTopics : [], algorithmNodeContents: cachedAlgorithmNodeContents(result.algorithmNodeContents, result.algorithmTopics, scope), learningCurriculum: curriculum, learningGateContents: cachedLearningContents(result.learningGateContents, scope, curriculum) };
            saveRepoCache(old, updated);
            if (token) {
                try {
                    await refreshIdentity();
                }
                catch (error) {
                    permissions = null;
                    return state(`资料已同步，账号权限刷新失败：${error.message}`);
                }
            }
            return state();
        }
        finally {
            syncBusy = false;
        }
    });
    registerSettingsHandlers({ handle, isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy,
        settings, normalizeRepositories, TEAM_CLIENT_ID, repoParts, normalizeServerUrl,
        clearPermissions: () => { permissions = null; }, invalidateLogin: () => { loginGeneration++; }, save, state });
    const updateLocal = createLocalUpdate({ isWriteBusy: () => writeBusy, isSyncBusy: () => syncBusy,
        getAccount: () => account, local, read, save, repoCache, sourceScope });
    handle('login', login);
    handle('logout', () => {
        if (writeBusy || syncBusy)
            throw new Error('请等待当前操作完成后再退出');
        auth.logout();
        loginGeneration++;
        token = '';
        account = null;
        permissions = null;
        return state();
    });
    registerRecordHandlers({ handle, writeOperation, requireWritableSource,
        getAccount: () => account, getToken: () => token, local, settings, read, save, client, annotate,
        sourceScope, getLoginGeneration: () => loginGeneration, ensureSource, repositoryKey, repoCache, saveRepoCache });
    require('./ipc-boundary.cjs').registerBoundary(handle, {
        plannerAction: (action, payload) => planner.action(action, payload),
        bootstrap: () => state(),
        updateLocal,
        openExternal: external,
        openAuthUrl,
        formatCode: (source, lang) => formatCode(source, lang).catch((error) => ({ code: source, error: error.message })),
        cancelLogin: () => { loginGeneration++; },
        exportLocal: async () => {
            const { dialog } = require('electron');
            const result = await dialog.showSaveDialog(win, { defaultPath: '我的题解备份.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
            if (!result.canceled) {
                fs.writeFileSync(result.filePath, JSON.stringify(local(), null, 2));
                return true;
            }
            return false;
        }
    });
}
app.whenReady().then(() => {
    dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    if (app.isPackaged) {
        const installDir = path.dirname(process.execPath);
        recoverFileUpgrade(dir, installDir);
        cleanupUpdateStorage(dir, installDir);
        // A helper still observing relaunch keeps its rollback files. The next
        // update check retries cleanup after it exits, without touching new downloads.
    }
    const personal = local();
    let migrated = false;
    personal.records = personal.records.map(record => {
        if (record.kind !== 'local')
            return record;
        const ownerId = record.ownerId == null ? null : String(record.ownerId);
        if (record.clientId && record.ownerId === ownerId)
            return record;
        migrated = true;
        return { ...record, clientId: record.clientId || randomUUID(), ownerId };
    });
    if (migrated)
        save('local.json', personal);
    auth = createAuth({ safeStorage,
        // Do not use read(): credential read/parse failures must not be swallowed as signed-out.
        readAuth: () => JSON.parse(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8')),
        saveAuth: data => save('auth.json', data) });
    auth.restore();
    token = auth.token;
    account = auth.account;
    win = new BrowserWindow({ width: 1440, height: 940, minWidth: 1050, minHeight: 700, title: '拾题 · QMX Notebook', backgroundColor: '#f6f7fb', autoHideMenuBar: true,
        webPreferences: { preload: process.argv.includes('--preview') ? undefined : path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    updater = createUpdater({
        currentVersion: APP_VERSION, runtimeVersion: process.versions.electron, downloadDir: path.join(dir, 'updates'),
        fetcher: networkFetch,
        installedArchive: app.isPackaged ? path.join(path.dirname(process.execPath), 'resources', 'app.asar') : undefined,
        onProgress: (progress) => { if (!win.isDestroyed())
            win.webContents.send('update-progress', progress); }
    });
    win.on('close', event => {
        if (updateBusy && !installing)
            event.preventDefault();
    });
    setup();
    win.loadFile(path.join(__dirname, '../ui/index.html'));
});
app.on('window-all-closed', () => { loginGeneration++; app.quit(); });
