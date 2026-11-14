import type { SourceScope } from '../../shared/models/bootstrap.js';
import type { SettingsStore } from '../storage/settings.cjs';
import type { GitHub } from '../github/client.cjs';
import type { CacheView, CommentView, FailureView, Handle, LocalUpdateView, LocalView, MainAccount, RecordView } from './contracts.js';

type WriteOperation = <T>(operation: () => T | PromiseLike<T>) => Promise<T>;
type Read = (name: string, fallback: unknown) => unknown;
type Save = (name: string, value: unknown) => void;
type RepoCache = (cache: CacheView, repo?: string, serverUrl?: string) => CacheView;
type SaveRepoCache = (old: CacheView, updated: CacheView, scope?: SourceScope) => void;
type Annotate = <T extends object>(record: T, scope?: SourceScope) => T & SourceScope;

export interface UpdateHandlers {
  handle: Handle;
  app: Pick<typeof import('electron').app, 'isPackaged' | 'quit'>;
  updater: ReturnType<typeof import('../update/updater.cjs').createUpdater>;
  isWriteBusy(): boolean;
  isSyncBusy(): boolean;
  isUpdateBusy(): boolean;
  isInstalling(): boolean;
  isPlatformBusy(): boolean;
  setUpdateBusy(value: boolean): void;
  setInstalling(value: boolean): void;
  directory: string;
  version: string;
  process: NodeJS.Process;
  spawn: typeof import('node:child_process').spawn;
  path: Pick<typeof import('node:path'), 'dirname'>;
  setTimeout: typeof globalThis.setTimeout;
  processEnvForInstaller(): NodeJS.ProcessEnv;
  cleanupUpdateStorage: typeof import('../update/storage.cjs').cleanupUpdateStorage;
  prepareFileUpgrade: typeof import('../update/file-upgrade.cjs').prepareFileUpgrade;
  cancelPreparedFileUpgrade: typeof import('../update/file-upgrade.cjs').cancelPreparedFileUpgrade;
  getFileUpgradeCapability: typeof import('../update/file-upgrade.cjs').getFileUpgradeCapability;
}

/** The transaction owns preparation/spawn cleanup while sharing main's existing update lock. */
export function registerUpdateHandlers({ handle, app, updater, isWriteBusy, isSyncBusy, isUpdateBusy, isInstalling, isPlatformBusy, setUpdateBusy, setInstalling, directory: dir, version: APP_VERSION, process, spawn, path, setTimeout, processEnvForInstaller, cleanupUpdateStorage, prepareFileUpgrade, cancelPreparedFileUpgrade, getFileUpgradeCapability }: UpdateHandlers): void {
  handle('checkStartupUpdates', async () => {
    // Discovery only: normal reading, editing and sync remain available.
    if (isUpdateBusy() || isInstalling()) return null;
    try {
      if (app.isPackaged) cleanupUpdateStorage(dir, path.dirname(process.execPath), undefined, { downloads: false });
      return await updater.check();
    } catch { return null; }
  });
  handle('checkForUpdates', async () => {
    if (isWriteBusy() || isSyncBusy() || isUpdateBusy() || isInstalling() || isPlatformBusy()) throw new Error('请等待当前操作完成后检查更新');
    setUpdateBusy(true);
    try {
      if (app.isPackaged) cleanupUpdateStorage(dir, path.dirname(process.execPath), undefined, { downloads: false });
      return await updater.check();
    } finally { setUpdateBusy(false); }
  });
  handle('downloadUpdate', async () => {
    if (isWriteBusy() || isSyncBusy() || isUpdateBusy() || isInstalling() || isPlatformBusy()) throw new Error('请等待当前操作完成后下载更新');
    setUpdateBusy(true);
    try { await updater.download(); return updater.getState(); } finally { setUpdateBusy(false); }
  });
  handle('installUpdate', async () => {
    if (isWriteBusy() || isSyncBusy() || isUpdateBusy() || isInstalling() || isPlatformBusy()) throw new Error('请等待当前操作完成后安装更新');
    if (!app.isPackaged) throw new Error('源码运行模式不能覆盖升级，请使用安装版客户端');
    const capability = getFileUpgradeCapability();
    if (!capability.supported) throw new Error(capability.reason);
    setUpdateBusy(true);
    try {
      const ready = await updater.verifyReady();
      const upgrade = prepareFileUpgrade({ userDataDir: dir, installDir: path.dirname(process.execPath), version: APP_VERSION, targetVersion: ready.version,
        ready, runtimeVersion: process.versions.electron, executablePath: process.execPath });
      // The detached helper waits for exit, then verifies, backs up and swaps app.asar.
      await new Promise<void>((resolve, reject) => {
        let child: ReturnType<typeof spawn>, spawned = false, failed = false;
        const spawnFailed = (error: unknown) => {
          if (spawned || failed) return;
          failed = true;
          try { cancelPreparedFileUpgrade(dir, path.dirname(process.execPath)); }
          catch (cancelError) { reject(new Error(`${(error as FailureView).message}；取消升级准备失败：${(cancelError as FailureView).message}`)); return; }
          reject(error);
        };
        try { child = spawn(process.execPath, upgrade.args, { detached: true, stdio: 'ignore', windowsHide: true, shell: false, env: { ...processEnvForInstaller(), ...upgrade.env } }); }
        catch (error) { spawnFailed(error); return; }
        child.once('error', spawnFailed);
        child.once('spawn', () => { if (failed) return; spawned = true; child.unref(); resolve(); });
      });
      setInstalling(true);
      setTimeout(() => app.quit(), 400);
      return { installing: true };
    } catch (error) { throw new Error(`启动升级失败：${(error as FailureView).message}。可重新尝试安装。`); }
    finally { setUpdateBusy(false); }
  });
}

export interface SettingsHandlers {
  handle: Handle;
  isWriteBusy(): boolean;
  isSyncBusy(): boolean;
  settings: SettingsStore['settings'];
  normalizeRepositories: SettingsStore['normalizeRepositories'];
  TEAM_CLIENT_ID: string;
  repoParts: typeof import('../github/client.cjs').repoParts;
  normalizeServerUrl: typeof import('../github/client.cjs').normalizeServerUrl;
  clearPermissions(): void;
  invalidateLogin(): void;
  save: Save;
  state(): unknown;
}

export function registerSettingsHandlers({ handle, isWriteBusy, isSyncBusy, settings, normalizeRepositories, TEAM_CLIENT_ID, repoParts, normalizeServerUrl, clearPermissions, invalidateLogin, save, state }: SettingsHandlers): void {
  handle('saveSettings', data => {
    if (isWriteBusy() || isSyncBusy()) throw new Error('请等待当前操作完成后再修改设置');
    const old = settings(), next = { ...old };
    if (Array.isArray(data.repositories)) {
      if (data.repositories.length === 0) throw new Error('至少需要保留一个仓库配置');
      for (const item of data.repositories) {
        if (!item || typeof item !== 'object') throw new Error('仓库配置格式不正确');
        repoParts((item as { repo: string }).repo);
        if ((item as { serverUrl?: unknown }).serverUrl) {
          normalizeServerUrl((item as { serverUrl?: unknown }).serverUrl);
        }
      }
      next.repositories = data.repositories as typeof next.repositories;
    }
    if (data.activeRepoId !== undefined) {
      next.activeRepoId = String(data.activeRepoId).trim();
    }
    if (data.repo !== undefined && !data.repositories) {
      repoParts(data.repo as string);
      next.repo = data.repo as string;
      const match = next.repositories?.find(r => r.id === next.activeRepoId);
      if (match) match.repo = data.repo as string;
    }
    if (data.serverUrl !== undefined && !data.repositories) {
      const url = normalizeServerUrl(data.serverUrl);
      next.serverUrl = url;
      const match = next.repositories?.find(r => r.id === next.activeRepoId);
      if (match) match.serverUrl = url;
    }
    const normalized = normalizeRepositories(next, old.repo, old.serverUrl);
    next.repositories = normalized.repositories;
    next.activeRepoId = normalized.activeRepoId;
    next.repo = normalized.repo;
    next.serverUrl = normalized.serverUrl;

    if (data.clientId !== undefined) {
      if (!/^[A-Za-z0-9_.-]{0,100}$/.test(data.clientId as string)) throw new Error('Client ID 格式不正确');
      next.clientId = (data.clientId as string).trim() || TEAM_CLIENT_ID;
    }
    if (data.theme !== undefined) next.theme = String(data.theme);
    if (data.displayName !== undefined) next.displayName = String(data.displayName).slice(0, 40);
    if (data.autoSync !== undefined) next.autoSync = !!data.autoSync;
    if (data.codeFontSize !== undefined) {
      const size = Math.round(Number(data.codeFontSize));
      if (!Number.isFinite(size) || size < 10 || size > 18) throw new Error('代码字号需在 10 到 18 之间');
      next.codeFontSize = size;
    }
    if (data.codeLineNumbers !== undefined) next.codeLineNumbers = !!data.codeLineNumbers;
    if (data.contestOptOuts !== undefined) {
      if (!Array.isArray(data.contestOptOuts) || data.contestOptOuts.length > 500) throw new Error('比赛偏好格式不正确');
      if (data.contestOptOuts.some(item => typeof item !== 'string' || !/^[a-z0-9-]{1,40}:[^\s:]{1,120}$/i.test(item))) throw new Error('比赛偏好格式不正确');
      next.contestOptOuts = [...new Set((data.contestOptOuts as string[]).map(item => item.trim()))];
    }
    if (next.repo !== old.repo || next.serverUrl !== old.serverUrl) clearPermissions();
    if (next.clientId !== old.clientId || next.repo !== old.repo || next.serverUrl !== old.serverUrl) invalidateLogin();
    save('settings.json', next); return state();
  });
}

export interface LocalUpdateDependencies {
  isWriteBusy(): boolean;
  isSyncBusy(): boolean;
  getAccount(): MainAccount | null;
  local: SettingsStore['local'];
  read: Read;
  save: Save;
  repoCache: RepoCache;
  sourceScope(): SourceScope;
}

/** Return the operation for the validated boundary to register in its original position. */
export function createLocalUpdate({ isWriteBusy, isSyncBusy, getAccount, local, read, save, repoCache, sourceScope }: LocalUpdateDependencies): (data: LocalUpdateView) => ReturnType<SettingsStore['local']> {
  const updateLocal = (data: LocalUpdateView) => {
    if (isWriteBusy() || isSyncBusy()) throw new Error('线上操作进行中，请稍后保存本地内容');
    if (!data || typeof data !== 'object' || !Array.isArray(data.records)) throw new Error('本地数据格式错误');
    if (JSON.stringify(data).length > 20000000) throw new Error('本地内容过大');
    const old = local() as LocalView;
    const foreign = (r: RecordView) => r.kind === 'local' && r.ownerId != null && String(r.ownerId) !== String(getAccount()?.id ?? '');
    if (data.records.some(r => !r || typeof r.id !== 'string')) throw new Error('本地记录缺少有效 ID');
    const incoming = new Map(data.records.map(r => [r.id, r]));
    if (incoming.size !== data.records.length) throw new Error('本地记录 ID 重复，拒绝保存');
    for (const record of old.records.filter(foreign)) {
      if (JSON.stringify(incoming.get(record.id)) !== JSON.stringify(record)) throw new Error('不能修改或删除其他账号的本地题解，请切换账号');
    }
    for (const record of data.records) {
      const previous = old.records.find(r => r.id === record.id);
      if (previous?.kind === 'local' && record.kind !== 'local') throw new Error('不能改变本地记录类型或账号归属');
      if (record.kind !== 'local') continue;
      if (previous?.ownerId != null && String(previous.ownerId) !== String(record.ownerId)) throw new Error('不能更改本地题解的账号归属');
      if ((!previous || previous.ownerId == null) && record.ownerId != null && String(record.ownerId) !== String(getAccount()?.id ?? '')) throw new Error('不能以其他账号创建或绑定本地题解');
    }
    const cache = repoCache(read('cache.json', {}) as CacheView);
    const scope = sourceScope();
    const published = { ...(old.published || {}) };
    for (const doc of cache.records || []) {
      if (cache.repo && doc.clientId && doc.authorId) published[`${scope.sourceKey}:${doc.authorId}:${doc.clientId}`] = doc.path;
    }
    const records = data.records.filter(r => {
      if (r.kind !== 'local') return false;
      if (r.proposalUrl) return true;
      const owner = r.ownerId ?? getAccount()?.id;
      return !published[`${scope.sourceKey}:${owner}:${r.clientId}`] && !(!scope.serverUrl && published[`${scope.repo}:${owner}:${r.clientId}`]);
    });
    save('local.json', { ...old, ...data, records, published }); return local();
  };
  return updateLocal;
}

export interface RecordHandlers {
  handle: Handle;
  writeOperation: WriteOperation;
  requireWritableSource(): void;
  getAccount(): MainAccount | null;
  getToken(): string;
  local: SettingsStore['local'];
  settings: SettingsStore['settings'];
  read: Read;
  save: Save;
  client(): GitHub;
  annotate: Annotate;
  sourceScope(): SourceScope;
  repositoryKey: typeof import('../github/client.cjs').repositoryKey;
  repoCache: RepoCache;
  saveRepoCache: SaveRepoCache;
}

export function registerRecordHandlers({ handle, writeOperation, requireWritableSource, getAccount, getToken, local, settings, read, save, client, annotate, sourceScope, repositoryKey, repoCache, saveRepoCache }: RecordHandlers): void {
  function checkRecordRepo(record: RecordView) {
    const scope = sourceScope();
    if (record.repo && record.repo !== scope.repo) throw new Error('该题解属于其他仓库，请切换到原仓库后操作');
    if (record.path && !record.repo) throw new Error('旧记录缺少仓库信息，请同步后重试');
    const key = record.sourceKey || (record.repo ? repositoryKey(record.repo as string, record.serverUrl || '') : scope.sourceKey);
    if (key !== scope.sourceKey) throw new Error('该记录属于其他 Git 服务或仓库，请切换到原仓库后操作');
  }
  function rememberDocument(result: RecordView, removed = false) {
    const repo = settings().repo, old = read('cache.json', {}) as CacheView;
    const c = repoCache(old, repo);
    const cache: CacheView = c.repo === repo ? { ...c } : { repo, records: [], issues: [], blobs: {} };
    if (!cache.issues) cache.issues = (cache.records || []).filter(r => r.kind === 'issue').map(r => ({ ...r, repo }));
    cache.records = (cache.records || []).filter(r => r.kind === 'document' && r.id !== result.id);
    if (!removed) cache.records.unshift(result);
    saveRepoCache(old, cache);
    // Legacy releases kept online documents in local.records, which could resurrect remote deletions.
    const personal = local() as LocalView;
    personal.published = { ...(personal.published || {}) };
    if (result.clientId && result.authorId) personal.published[`${sourceScope().sourceKey}:${result.authorId}:${result.clientId}`] = result.path;
    personal.records = personal.records.filter(r => r.kind === 'local' && !(result.clientId && r.clientId === result.clientId && !r.proposalUrl && (r.ownerId == null || String(r.ownerId) === String(getAccount()?.id))));
    save('local.json', personal);
  }
  const saveDocument = (record: RecordView) => writeOperation(async () => {
    checkRecordRepo(record); requireWritableSource();
    if (!getAccount()?.id || !getToken()) throw new Error('请先登录 GitHub');
    if (!record.path) {
      const personal = local() as LocalView;
      const sources = personal.records.filter(r => r.kind === 'local' && r.clientId === record.clientId && r.id === record.id);
      if (sources.some(r => r.ownerId != null && String(r.ownerId) !== String(getAccount()!.id))) throw new Error('不能上传其他账号的本地题解，请切换账号');
      let bound = false;
      for (const source of sources) {
        if (source.ownerId == null) { source.ownerId = String(getAccount()!.id); bound = true; }
      }
      if (bound) save('local.json', personal);
    }
    const result = annotate(await client().saveDocument(record));
    rememberDocument(result); return result;
  });
  handle('saveDocument', saveDocument);
  handle('saveAlgorithmNote', record => writeOperation(async () => {
    checkRecordRepo(record); requireWritableSource();
    if (!getAccount()?.id || !getToken()) throw new Error('请先登录 GitHub');
    const result = annotate(await client().saveAlgorithmNote(record));
    const old = read('cache.json', {}) as CacheView, cache = repoCache(old);
    const notes = (cache.algorithmNotes || []).filter(item => item.path !== result.path);
    saveRepoCache(old, { ...cache, algorithmNotes: [...notes, result] });
    return result;
  }));
  handle('submit', saveDocument);
  handle('propose', saveDocument);
  handle('deleteDocument', record => writeOperation(async () => {
    checkRecordRepo(record); requireWritableSource();
    const result = annotate(await client().deleteDocument(record));
    rememberDocument(result, true); return result;
  }));
  handle('deleteIssue', record => writeOperation(async () => {
    checkRecordRepo(record); requireWritableSource();
    if (record.repo !== settings().repo) throw new Error('讨论所属仓库已改变，请同步后重试');
    const result = await client().deleteIssue(record);
    const repo = settings().repo, old = read('cache.json', {}) as CacheView, cache = repoCache(old);
    if (cache.repo === repo) {
      cache.issues = (cache.issues || (cache.records || []).filter(r => r.kind === 'issue')).filter(r => r.number !== result.number);
      cache.records = (cache.records || []).filter(r => r.kind !== 'issue' || r.number !== result.number);
      saveRepoCache(old, cache);
    }
    const personal = local() as LocalView;
    personal.favorites = personal.favorites.filter(id => String(id) !== result.id);
    delete personal.mastery[result.id];
    personal.records = personal.records.filter(r => r.kind === 'local');
    save('local.json', personal);
    return result;
  }));
  handle('comment', data => writeOperation(() => {
    checkRecordRepo(data); requireWritableSource();
    if (data.repo !== settings().repo) throw new Error('讨论所属仓库已改变，请同步后重试');
    return client().comment(data);
  }));
  handle('getComments', async number => (await client().comments(number) as CommentView[]).map(x => ({ id: x.id, body: x.body, author: x.user?.login || '', createdAt: x.created_at, url: x.html_url })));
}
