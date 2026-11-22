import type { ClistSharedCacheResult, ClistSharedCacheStatus } from '../../shared/models/clist-shared-cache';
import type { ClistFetcher } from './service.cjs';
import { createHash } from 'node:crypto';
const { createClistRatingCacheReader } = require('./clist-service.cjs') as typeof import('./service.cjs');

type FileSystem = Pick<typeof import('node:fs'), 'openSync' | 'fstatSync' | 'readSync' | 'closeSync' | 'writeFileSync' | 'renameSync' | 'unlinkSync' | 'mkdirSync' | 'statSync'>;
type Paths = Pick<typeof import('node:path'), 'resolve' | 'join' | 'dirname'>;
export interface ClistSharedCacheOptions {
  directory: string;
  fs: FileSystem;
  path: Paths;
  fetcher?: ClistFetcher;
  now?: () => number;
  initialCacheFile?: string;
}
type Fields = Record<string, unknown>;
type Rating = { rating: number; resource: string; queriedAt: string };
type Ratings = Record<string, Rating>;
type Snapshot = { text: string | null; version: string | null; sha256?: string };
type Store = { root: Fields; ratings: Ratings; ignored: number };
type InitialState = { schema: 1; sha256: string; appliedAt: string };
type InitialDocument = { sha256: string; store: Store };
type Staged = { file: string; temporary: string; backup: string | null; expected: Snapshot; content: string; committed: boolean };
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 150_000;
const FUTURE_ALLOWANCE = 5 * 60 * 1000;
const KIND = 'qmx-clist-rating-cache';
const FORMAT_ERROR = '这不是有效的 CLIST 评分缓存；请选择共享 CLIST JSON 或原始 clist-rating-cache.json，公开难度模板不受支持';
class CacheError extends Error {}
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
function missing(error: unknown): boolean { return object(error)?.code === 'ENOENT'; }
function iso(value: unknown, clock: number): value is string {
  if (typeof value !== 'string') return false;
  const date = Date.parse(value);
  return Number.isFinite(date) && new Date(date).toISOString() === value && date <= clock + FUTURE_ALLOWANCE;
}
function parse(text: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { throw new CacheError(FORMAT_ERROR); }
}
function validated(value: unknown, clock: number, incoming: boolean): Store {
  const root = object(value);
  const rows = object(root?.ratings);
  if (!root || root.schema !== 1 || !rows || (incoming && root.kind !== undefined && root.kind !== KIND)
    || (incoming && root.kind === KIND && !iso(root.exportedAt, clock))) throw new CacheError(FORMAT_ERROR);
  const entries = Object.entries(rows);
  if (entries.length > MAX_ENTRIES) throw new CacheError('CLIST 缓存条数超过 150000，未导入');
  // Use the actual service's canonical identity, resource and legacy-zero rules.
  try { createClistRatingCacheReader(value); } catch { throw new CacheError(FORMAT_ERROR); }
  const ratings: Ratings = {};
  let ignored = 0;
  for (const [url, value] of entries) {
    const row = object(value);
    if (!row || typeof row.rating !== 'number' || typeof row.resource !== 'string' || !iso(row.queriedAt, clock)) {
      throw new CacheError('CLIST 缓存查询时间无效或超过当前时间 5 分钟，未导入');
    }
    if (row.rating === 0) { ignored += 1; continue; }
    ratings[url] = { rating: row.rating, resource: row.resource, queriedAt: row.queriedAt };
  }
  return { root, ratings, ignored };
}
function publicDocument(value: unknown): void {
  const root = object(value);
  if (!root || Object.keys(root).some(key => !['schema', 'kind', 'exportedAt', 'ratings'].includes(key))) {
    throw new CacheError(FORMAT_ERROR);
  }
}
function safely<T>(message: string, run: () => T): T {
  try { return run(); } catch (error: unknown) { throw error instanceof CacheError ? error : new CacheError(message); }
}

export function createClistSharedCache(options: ClistSharedCacheOptions) {
  const { fs, path } = options;
  const now = options.now ?? Date.now;
  const fetcher = options.fetcher ?? fetch;
  const cacheFile = path.join(options.directory, 'clist-rating-cache.json');
  const sourceFile = path.join(options.directory, 'clist-shared-source.json');
  const initialStateFile = path.join(options.directory, 'clist-initial-cache-state.json');
  let initialDocument: InitialDocument | undefined;
  let sequence = 0;

  function snapshot(file: string, hashContent = false): Snapshot {
    let descriptor: number;
    try { descriptor = fs.openSync(file, 'r'); }
    catch (error: unknown) { if (missing(error)) return { text: null, version: null }; throw error; }
    try {
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || stat.size > MAX_BYTES) throw new CacheError('CLIST 缓存文件超过 20 MB 或不是普通文件，未导入');
      const chunks: Buffer[] = [];
      let length = 0;
      for (;;) {
        const chunk = Buffer.alloc(Math.min(64 * 1024, MAX_BYTES + 1 - length));
        const count = fs.readSync(descriptor, chunk, 0, chunk.length, null);
        if (!count) break;
        length += count;
        if (length > MAX_BYTES) throw new CacheError('CLIST 缓存文件超过 20 MB，未导入');
        chunks.push(chunk.subarray(0, count));
      }
      const content = Buffer.concat(chunks);
      return { text: content.toString('utf8'), version: `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`,
        ...(hashContent ? { sha256: createHash('sha256').update(content).digest('hex') } : {}) };
    } finally { fs.closeSync(descriptor); }
  }
  function local(snapshotValue: Snapshot, clock: number): Store {
    return snapshotValue.text === null ? { root: {}, ratings: {}, ignored: 0 } : validated(parse(snapshotValue.text), clock, false);
  }
  function publicUrl(value: unknown): string {
    if (typeof value !== 'string' || !value || value !== value.trim()) throw new CacheError('共享来源必须是无凭据的公开 HTTPS 文件 URL');
    let url: URL;
    try { url = new URL(value); } catch { throw new CacheError('共享来源必须是无凭据的公开 HTTPS 文件 URL'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port || value.includes('#')) {
      throw new CacheError('共享来源必须是无凭据的公开 HTTPS 文件 URL');
    }
    // Public version/download parameters are supported; credential-bearing URLs are not.
    for (const [key] of url.searchParams) {
      if (/(?:key|token|secret|auth|credential|password|signature|sig$|app[_-]?id|username|account)/i.test(key)) {
        throw new CacheError('共享来源 URL 不得包含账号、密钥或签名参数');
      }
    }
    return url.href;
  }
  function metadata(): { sourceUrl: string | null; lastSyncedAt: string | null } {
    const saved = snapshot(sourceFile);
    if (saved.text === null) return { sourceUrl: null, lastSyncedAt: null };
    const row = object(parse(saved.text));
    if (!row || Object.keys(row).some(key => !['url', 'lastSyncedAt'].includes(key)) || !iso(row.lastSyncedAt, now())) {
      throw new CacheError('CLIST 共享来源配置无效，未覆盖原文件');
    }
    return { sourceUrl: publicUrl(row.url), lastSyncedAt: row.lastSyncedAt };
  }
  function initialState(saved: Snapshot = snapshot(initialStateFile)): InitialState | null {
    if (saved.text === null) return null;
    // A damaged marker is recoverable. It never authorizes skipping source/local validation.
    let row: Fields | null;
    try { row = object(parse(saved.text)); } catch { return null; }
    if (!row || row.schema !== 1 || typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)
      || !iso(row.appliedAt, now()) || Object.keys(row).some(key => !['schema', 'sha256', 'appliedAt'].includes(key))) return null;
    return { schema: 1, sha256: row.sha256, appliedAt: row.appliedAt };
  }
  function initialMetadata(): { initialTotal?: number; initialAppliedAt?: string } {
    if (options.initialCacheFile === undefined || initialDocument === undefined) return {};
    const saved = initialState();
    return { initialTotal: Object.keys(initialDocument.store.ratings).length,
      ...(saved?.sha256 === initialDocument.sha256 ? { initialAppliedAt: saved.appliedAt } : {}) };
  }
  function summarize(ratings: Ratings): ClistSharedCacheStatus {
    const platforms: Record<string, number> = {};
    let oldestQuery: string | null = null;
    let newestQuery: string | null = null;
    for (const row of Object.values(ratings)) {
      platforms[row.resource] = (platforms[row.resource] ?? 0) + 1;
      if (oldestQuery === null || Date.parse(row.queriedAt) < Date.parse(oldestQuery)) oldestQuery = row.queriedAt;
      if (newestQuery === null || Date.parse(row.queriedAt) > Date.parse(newestQuery)) newestQuery = row.queriedAt;
    }
    return { total: Object.keys(ratings).length, platforms, oldestQuery, newestQuery, ...metadata(), ...initialMetadata() };
  }
  function cleanup(file: string | null): void {
    if (file === null) return;
    try { fs.unlinkSync(file); } catch { /* Only our own exclusively-created temporary file. */ }
  }
  function prepare(file: string, content: string, expected: Snapshot): Staged {
    if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) throw new CacheError('合并后的 CLIST 缓存超过 20 MB，未保存');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const suffix = `.qmx-${process.pid}-${process.hrtime.bigint()}-${++sequence}.tmp`;
    const temporary = file + suffix;
    const backup = expected.text === null ? null : file + '.bak' + suffix;
    let ownsTemporary = false;
    let ownsBackup = false;
    try {
      fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      ownsTemporary = true;
      if (backup !== null && expected.text !== null) {
        fs.writeFileSync(backup, expected.text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        ownsBackup = true;
      }
      return { file, temporary, backup, expected, content, committed: false };
    } catch (error: unknown) {
      // writeFileSync may create a partial file before failing.
      if (ownsTemporary || object(error)?.code !== 'EEXIST') cleanup(temporary);
      if (ownsBackup || object(error)?.code !== 'EEXIST') cleanup(backup);
      throw error;
    }
  }
  function unchanged(stage: Staged): void {
    const current = snapshot(stage.file);
    if (current.text !== stage.expected.text || current.version !== stage.expected.version) {
      throw new CacheError('CLIST 本地文件已变化，请重试合并；未覆盖新缓存');
    }
  }
  function commit(stage: Staged): void {
    unchanged(stage);
    if (stage.backup !== null) fs.renameSync(stage.backup, stage.file + '.bak');
    unchanged(stage);
    fs.renameSync(stage.temporary, stage.file);
    stage.committed = true;
  }
  function rollback(stage: Staged): void {
    if (!stage.committed) return;
    // Never roll back over an intervening writer's newer document.
    if (snapshot(stage.file).text !== stage.content) throw new CacheError('CLIST 文件在保存期间变化，请重新检查共享来源与缓存');
    if (stage.expected.text === null) fs.unlinkSync(stage.file);
    else fs.renameSync(stage.file + '.bak', stage.file);
  }
  function sameFile(first: string, second: string): boolean {
    const a = path.resolve(first);
    const b = path.resolve(second);
    if ((process.platform === 'win32' ? a.toLowerCase() : a) === (process.platform === 'win32' ? b.toLowerCase() : b)) return true;
    try {
      const one = fs.statSync(first);
      const two = fs.statSync(second);
      return one.ino !== 0 && one.ino === two.ino && one.dev === two.dev;
    } catch (error: unknown) { if (missing(error)) return false; throw error; }
  }
  function status(): ClistSharedCacheStatus {
    return safely('CLIST 本地缓存读取失败，未覆盖原文件', () => summarize(local(snapshot(cacheFile), now()).ratings));
  }
  function exportFile(file: string): ClistSharedCacheStatus {
    return safely('CLIST 共享缓存导出失败，未覆盖本地缓存', () => {
      const personalNames = ['clist-rating-cache.json', 'clist-shared-source.json', 'clist-initial-cache-state.json', 'clist-auth.json', 'auth.json', 'ai-auth.json',
        'local.json', 'settings.json', 'cache.json', 'platforms.json', 'planner.json', 'contests.json', 'problem-enrichments.json',
        'difficulty-backfill-ledger.json', 'difficulty-backfill.json', 'userprofiles.json', 'user-profiles.json', 'profiles.json'];
      const target = path.resolve(file).replace(/\\/g, '/').toLowerCase();
      const directory = path.resolve(options.directory).replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') + '/';
      const name = target.slice(target.lastIndexOf('/') + 1);
      const reservedName = personalNames.some(value => name === value || name.startsWith(value + '.'));
      const profilePath = target.startsWith(directory) && /^(?:userprofiles|user-profiles|profiles|library|updates)\//.test(target.slice(directory.length));
      const protectedAlias = personalNames.some(value => sameFile(file, path.join(options.directory, value)) || sameFile(file, path.join(options.directory, value + '.bak')));
      if (reservedName || profilePath || protectedAlias) {
        throw new CacheError('请另选共享导出文件，不能覆盖本地 CLIST 缓存、凭据或个人配置');
      }
      const clock = now();
      const store = local(snapshot(cacheFile), clock);
      const result = summarize(store.ratings);
      const content = JSON.stringify({ schema: 1, kind: KIND, exportedAt: new Date(clock).toISOString(), ratings: store.ratings }, null, 2) + '\n';
      const staged = prepare(file, content, snapshot(file));
      try { commit(staged); } finally { cleanup(staged.temporary); cleanup(staged.backup); }
      return result;
    });
  }
  function merge(value: unknown, sourceUrl?: string): ClistSharedCacheResult {
    return mergeValidated(validated(value, now(), true), sourceUrl);
  }
  function mergeValidated(incoming: Store, sourceUrl?: string, initial?: { state: InitialState; before: Snapshot }): ClistSharedCacheResult {
    const clock = now();
    const before = snapshot(cacheFile);
    const store = local(before, clock);
    // Check source metadata before any cache changes, including ordinary imports.
    metadata();
    const ratings = { ...store.ratings };
    let imported = 0;
    let updated = 0;
    let kept = 0;
    for (const [url, row] of Object.entries(incoming.ratings)) {
      const existing = ratings[url];
      if (!existing) { ratings[url] = row; imported += 1; }
      else if (Date.parse(row.queriedAt) > Date.parse(existing.queriedAt)) { ratings[url] = row; updated += 1; }
      else { kept += 1; }
    }
    if (Object.keys(ratings).length > MAX_ENTRIES) throw new CacheError('合并后的 CLIST 缓存条数超过 150000，未保存');
    const stages: Staged[] = [];
    try {
      const persistedRatings = { ...object(store.root.ratings), ...ratings };
      if (Object.keys(persistedRatings).length > MAX_ENTRIES) throw new CacheError('合并后的 CLIST 缓存条数超过 150000，未保存');
      if (imported || updated) stages.push(prepare(cacheFile, JSON.stringify({ ...store.root, schema: 1, ratings: persistedRatings }, null, 2) + '\n', before));
      if (sourceUrl !== undefined) stages.push(prepare(sourceFile, JSON.stringify({ url: sourceUrl, lastSyncedAt: new Date(clock).toISOString() }, null, 2) + '\n', snapshot(sourceFile)));
      if (initial !== undefined) stages.push(prepare(initialStateFile, JSON.stringify(initial.state, null, 2) + '\n', initial.before));
      // Finish staging every file before changing any persisted document.
      for (const staged of stages) unchanged(staged);
      for (const staged of stages) commit(staged);
    } catch (error: unknown) {
      for (const staged of stages.slice().reverse()) rollback(staged);
      throw error;
    } finally {
      for (const staged of stages) { cleanup(staged.temporary); cleanup(staged.backup); }
    }
    return { canceled: false, imported, updated, kept, ignored: incoming.ignored, status: summarize(ratings) };
  }
  function importFile(file: string): ClistSharedCacheResult {
    return safely('CLIST 共享缓存导入失败，未覆盖原文件', () => {
      const saved = snapshot(file);
      if (saved.text === null) throw new CacheError('找不到要导入的 CLIST 缓存文件');
      return merge(parse(saved.text));
    });
  }
  function importDocument(value: unknown): ClistSharedCacheResult {
    return safely('CLIST 共享缓存导入失败，未覆盖原文件', () => {
      publicDocument(value);
      // Validate before serialization can erase invalid/undefined fields. Validation copies each score.
      const incoming = validated(value, now(), true);
      const text = JSON.stringify(value);
      if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw new CacheError('CLIST 共享缓存超过 20 MB，未导入');
      return mergeValidated(incoming);
    });
  }
  function ensureInitial(): ClistSharedCacheStatus {
    return safely('CLIST 内置初始缓存读取或合并失败，未覆盖原文件', () => {
      if (options.initialCacheFile === undefined) return status();
      const saved = snapshot(options.initialCacheFile, true);
      if (saved.text === null) { initialDocument = undefined; return status(); }
      // Hash the exact source bytes, rather than timestamps or decoded/re-encoded text.
      const sha256 = saved.sha256;
      if (sha256 === undefined) throw new CacheError('CLIST 内置初始缓存校验失败，未覆盖原文件');
      if (initialDocument?.sha256 !== sha256) {
        initialDocument = undefined;
        const value = parse(saved.text);
        publicDocument(value);
        const store = validated(value, now(), true);
        if (store.ignored || Object.keys(store.ratings).length === 0) {
          throw new CacheError('CLIST 内置初始缓存必须包含有效正分，未覆盖原文件');
        }
        initialDocument = { sha256, store };
      }
      const before = snapshot(initialStateFile);
      const applied = initialState(before);
      // A matching marker cannot mask a deleted, empty or damaged local document.
      const current = snapshot(cacheFile);
      const store = local(current, now());
      if (applied?.sha256 === sha256 && current.text !== null && Object.keys(store.ratings).length > 0) {
        return summarize(store.ratings);
      }
      return mergeValidated(initialDocument.store, undefined, {
        state: { schema: 1, sha256, appliedAt: new Date(now()).toISOString() }, before
      }).status;
    });
  }
  async function download(url: string, signal: AbortSignal): Promise<unknown> {
    const response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json' }, signal });
    if (!response.ok || response.redirected || (response.url && response.url !== url)) {
      if (response.body) void response.body.cancel().catch(() => undefined);
      throw new CacheError('CLIST 共享缓存下载失败，请检查公开 HTTPS 文件');
    }
    const length = response.headers.get('content-length');
    if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_BYTES) {
      if (response.body) void response.body.cancel().catch(() => undefined);
      throw new CacheError('CLIST 共享缓存超过 20 MB，未导入');
    }
    if (!response.body) throw new CacheError(FORMAT_ERROR);
    const reader = response.body.getReader();
    const cancel = (): void => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > MAX_BYTES) throw new CacheError('CLIST 共享缓存超过 20 MB，未导入');
        chunks.push(next.value);
      }
      if (signal.aborted) throw new CacheError('CLIST 共享缓存下载超时，请重试');
      return parse(Buffer.concat(chunks).toString('utf8'));
    } finally {
      signal.removeEventListener('abort', cancel);
      cancel();
      reader.releaseLock();
    }
  }
  async function syncFromUrl(input: string): Promise<ClistSharedCacheResult> {
    const url = publicUrl(input);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new CacheError('CLIST 共享缓存下载超时，请重试')); }, 30_000);
      });
      const value = await Promise.race([download(url, controller.signal), deadline]);
      return safely('CLIST 共享缓存合并失败，请重试', () => merge(value, url));
    } catch (error: unknown) {
      throw error instanceof CacheError ? error : new CacheError('CLIST 共享缓存下载失败，请检查公开 HTTPS 文件');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    }
  }
  return Object.freeze({ status, ensureInitial, exportFile, importFile, importDocument, syncFromUrl });
}
