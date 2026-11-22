import type { ClistBulkState, ClistBulkResourceState } from '../../shared/models/clist-bulk.js';
import type { ClistSharedCacheResult } from '../../shared/models/clist-shared-cache.js';
import type { ClistRatedPage } from './service.cjs';
const { normalizeClistRatingIdentity, createClistRatingCacheReader } = require('./clist-service.cjs') as typeof import('./service.cjs');

export interface ClistBulkOptions {
  read(): unknown;
  save(value: unknown): void;
  fetchPage(resource: string, offset: number): Promise<ClistRatedPage>;
  mergeRatings(document: unknown): ClistSharedCacheResult;
  now?: () => number;
  onState?: (state: ClistBulkState) => void;
}
export const CLIST_BULK_RESOURCES: readonly string[] = Object.freeze([
  'codeforces.com', 'atcoder.jp', 'leetcode.com', 'luogu.com.cn', 'ac.nowcoder.com', 'loj.ac'
]);
type Fields = Record<string, unknown>;
type Status = ClistBulkState['status'];
const STATUSES: readonly Status[] = ['idle', 'running', 'paused', 'done', 'failed'];
const INVALID = 'CLIST 批量刷新进度损坏或版本不支持，未覆盖原文件';
const SAVE_FAILED = 'CLIST 批量刷新进度保存失败，已保留上次游标';
const FAILED = 'CLIST 批量刷新失败，已保留上次游标，请重试';
class BulkError extends Error {}
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function iso(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
}
function fresh(): ClistBulkState {
  const resources: Record<string, ClistBulkResourceState> = {};
  for (const resource of CLIST_BULK_RESOURCES) resources[resource] = { offset: 0, total: null, pages: 0, status: 'idle', imported: 0, ignored: 0 };
  return { schema: 1, running: false, pauseRequested: false, status: 'idle', resources, startedAt: null, finishedAt: null };
}
function clone(state: ClistBulkState): ClistBulkState {
  return { ...state, resources: Object.fromEntries(Object.entries(state.resources).map(([key, row]) => [key, { ...row }])) };
}
function validate(value: unknown): ClistBulkState {
  if (value === undefined) return fresh();
  const root = object(value);
  const rows = object(root?.resources);
  if (!root || root.schema !== 1 || !rows || Object.keys(root).some(key => !['schema', 'running', 'pauseRequested', 'status', 'resources', 'startedAt', 'finishedAt', 'message'].includes(key))
    || typeof root.running !== 'boolean' || typeof root.pauseRequested !== 'boolean' || !STATUSES.includes(root.status as Status)
    || !iso(root.startedAt) || !iso(root.finishedAt) || (root.message !== undefined && typeof root.message !== 'string')
    || Object.keys(rows).length !== CLIST_BULK_RESOURCES.length || Object.keys(rows).some(key => !CLIST_BULK_RESOURCES.includes(key))) throw new BulkError(INVALID);
  const result = fresh();
  for (const key of CLIST_BULK_RESOURCES) {
    const row = object(rows[key]);
    if (!row || Object.keys(row).some(key => !['offset', 'total', 'pages', 'status', 'imported', 'lastId', 'ignored'].includes(key))
      || !count(row.offset) || !(row.total === null || count(row.total)) || !count(row.pages) || !count(row.imported)
      || !STATUSES.includes(row.status as Status) || (row.ignored !== undefined && !count(row.ignored))
      || (row.lastId !== undefined && (!count(row.lastId) || row.lastId === 0))
      || (row.offset > 0 && row.lastId === undefined) || (row.offset === 0 && row.lastId !== undefined)
      || (row.total !== null && row.offset > row.total) || (row.status === 'done' && row.offset !== row.total)
      || (row.offset > 0 && row.pages === 0)) throw new BulkError(INVALID);
    if (typeof row.ignored === 'number' && row.ignored > row.offset) throw new BulkError(INVALID);
    if (row.imported > row.offset || (row.offset > 0 && row.pages > row.offset)) throw new BulkError(INVALID);
    result.resources[key] = { offset: row.offset, total: row.total, pages: row.pages, status: row.status as Status, imported: row.imported,
      ...(row.lastId === undefined ? {} : { lastId: row.lastId as number }), ignored: row.ignored === undefined ? 0 : row.ignored as number };
  }
  result.status = root.status as Status;
  result.running = root.running;
  result.pauseRequested = root.pauseRequested;
  result.startedAt = root.startedAt;
  result.finishedAt = root.finishedAt;
  if (result.status === 'done' && Object.values(result.resources).some(row => row.status !== 'done')) throw new BulkError(INVALID);
  // Persisted text is never echoed back: it may come from an older or untrusted writer.
  if (result.running || result.status === 'running') {
    result.running = false;
    result.pauseRequested = false;
    result.status = 'paused';
    for (const row of Object.values(result.resources)) if (row.status === 'running') row.status = 'paused';
  }
  return result;
}
function checkedPage(value: unknown, offset: number, lastId: number): ClistRatedPage {
  const page = object(value);
  if (!page || !count(page.total) || !Array.isArray(page.rows) || page.rows.length > 1000 || offset > page.total
    || (page.rows.length === 0 ? offset < page.total : offset + page.rows.length > page.total)) throw new BulkError('CLIST 批量评分分页结果无效');
  let previous = lastId;
  for (const value of page.rows) {
    const row = object(value);
    if (!row || !count(row.id) || row.id <= previous || typeof row.rating !== 'number' || !Number.isFinite(row.rating) || row.rating <= 0
      || (row.url !== null && typeof row.url !== 'string') || (row.archiveUrl !== null && typeof row.archiveUrl !== 'string') || typeof row.resource !== 'string') {
      throw new BulkError('CLIST 批量评分题目或跨页顺序无效');
    }
    previous = row.id;
  }
  return { rows: page.rows as ClistRatedPage['rows'], total: page.total };
}

export function createClistBulk(options: ClistBulkOptions) {
  const now = options.now ?? Date.now;
  let current: ClistBulkState;
  let blocked = false;
  try { current = validate(options.read()); }
  catch { current = { ...fresh(), status: 'failed', message: INVALID }; blocked = true; }
  let pending: Promise<ClistBulkState> | null = null;
  function state(): ClistBulkState { return clone(current); }
  function notify(): void { try { options.onState?.(state()); } catch { /* UI observers cannot change the persisted cursor. */ } }
  function persist(next: ClistBulkState): void {
    try { options.save(clone(next)); }
    catch { throw new BulkError(SAVE_FAILED); }
    current = next;
    notify();
  }
  async function execute(force: boolean): Promise<ClistBulkState> {
    if (blocked) return state();
    let active: string | null = null;
    try {
      const next = force || current.status === 'done' ? fresh() : clone(current);
      next.running = true;
      next.pauseRequested = false;
      next.status = 'running';
      next.startedAt ??= new Date(now()).toISOString();
      next.finishedAt = null;
      delete next.message;
      persist(next);
      for (const resource of CLIST_BULK_RESOURCES) {
        if (current.resources[resource].status === 'done') continue;
        active = resource;
        for (;;) {
          if (current.pauseRequested) return finishPause();
          const before = current.resources[resource];
          const requesting = clone(current);
          requesting.resources[resource].status = 'running';
          persist(requesting);
          const page = checkedPage(await options.fetchPage(resource, before.offset), before.offset, before.lastId ?? 0);
          const queriedAt = new Date(now()).toISOString();
          const ratings: Record<string, { rating: number; resource: string; queriedAt: string }> = {};
          const conflicts = new Set<string>();
          let ignored = 0;
          for (const row of page.rows) {
            const primary = row.url === null ? null : normalizeClistRatingIdentity(row.url);
            const archive = row.archiveUrl === null ? null : normalizeClistRatingIdentity(row.archiveUrl);
            const target = primary ?? archive;
            if (row.resource !== resource || !target || target.resource !== resource
              || (primary && archive && primary.url !== archive.url) || conflicts.has(target.url)) { ignored += 1; continue; }
            const previous = ratings[target.url];
            if (previous && previous.rating !== row.rating) { delete ratings[target.url]; conflicts.add(target.url); ignored += 2; continue; }
            ratings[target.url] = { rating: row.rating, resource, queriedAt };
          }
          const document = { schema: 1, ratings };
          createClistRatingCacheReader(document);
          const merged = options.mergeRatings(document);
          if (!merged || merged.canceled || !count(merged.imported) || !count(merged.updated)) throw new BulkError('CLIST 批量评分合并失败，已保留上次游标');
          const saved = clone(current);
          const cursor = saved.resources[resource];
          cursor.offset = before.offset + page.rows.length;
          cursor.total = page.total;
          cursor.pages += 1;
          cursor.imported += merged.imported + merged.updated;
          cursor.ignored = (cursor.ignored ?? 0) + ignored;
          if (page.rows.length) cursor.lastId = page.rows[page.rows.length - 1].id;
          cursor.status = cursor.offset >= page.total ? 'done' : 'running';
          persist(saved);
          if (current.pauseRequested) return finishPause();
          if (cursor.status === 'done') break;
        }
      }
      const done = clone(current);
      done.running = false;
      done.pauseRequested = false;
      done.status = 'done';
      done.finishedAt = new Date(now()).toISOString();
      persist(done);
    } catch (error: unknown) {
      const failed = clone(current);
      failed.running = false;
      failed.pauseRequested = false;
      failed.status = 'failed';
      failed.message = error instanceof BulkError ? error.message : FAILED;
      // Only the service's fixed safe messages and HTTP status may cross this boundary.
      if (!(error instanceof BulkError) && error instanceof Error
        && /^CLIST 批量评分(?:请求失败|请求超时|响应过大|响应格式无效|题目或顺序无效|题目评分无效|平台不匹配|查询配置无效)（HTTP [1-5]\d\d）$/.test(error.message)) failed.message = error.message;
      if (active !== null && failed.resources[active].status !== 'done') failed.resources[active].status = 'failed';
      try { persist(failed); } catch { current = { ...failed, message: SAVE_FAILED }; notify(); }
    }
    return state();
  }
  function finishPause(): ClistBulkState {
    const paused = clone(current);
    paused.running = false;
    paused.pauseRequested = false;
    paused.status = 'paused';
    for (const row of Object.values(paused.resources)) if (row.status === 'running') row.status = 'paused';
    persist(paused);
    return state();
  }
  function run(force = false): Promise<ClistBulkState> {
    if (pending) return pending;
    pending = execute(force);
    void pending.then(() => { pending = null; }, () => { pending = null; });
    return pending;
  }
  function pause(): ClistBulkState {
    if (!current.running) return state();
    // The page already queued in the service is allowed to finish and merge safely.
    current = { ...current, pauseRequested: true };
    notify();
    return state();
  }
  return Object.freeze({ run, pause, state });
}
