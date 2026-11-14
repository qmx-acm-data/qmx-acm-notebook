import type { Contest, ContestSourceId } from '../../shared/models/contests.js';

// The generated module lives at electron/contests.cjs beside contest-sources.cjs.
const { SOURCES } = require('./contest-sources.cjs') as typeof import('./sources.cjs');
export const CACHE_TTL = 10 * 60 * 1000;
export const RETRY_DELAY = 60 * 1000;
const MAX_BYTES = 4 * 1024 * 1024;
const HOSTS: Record<ContestSourceId, readonly string[]> = {
  luogu: ['www.luogu.com.cn', 'luogu.com.cn'], codeforces: ['codeforces.com'],
  atcoder: ['atcoder.jp'], nowcoder: ['ac.nowcoder.com']
};

type Fields = Record<string, unknown>;
type RetryError = Error & { retryAfter?: number };

export interface ContestResponseReader {
  read(): Promise<{ done?: boolean; value?: Uint8Array }>;
  cancel(): Promise<unknown>;
}

/** Only the response operations used here are required, including for test fetchers. */
export interface ContestResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers?: { get(name: string): string | null };
  readonly body?: { getReader?: () => ContestResponseReader } | null;
  text(): Promise<string>;
}

export interface ContestFetchOptions {
  headers: Record<string, string>;
  signal: AbortSignal;
  redirect: 'error';
  credentials: 'omit';
}

export type ContestFetcher = (url: string, options: ContestFetchOptions) => Promise<ContestResponse>;

export interface ContestServiceSource {
  readonly id: ContestSourceId;
  readonly name: string;
  readonly url: string;
  readonly endpoint: string;
  readonly parse: (text: string) => unknown;
}

interface ContestEntry {
  contests: Contest[];
  updatedAt: string | null;
  error: string | null;
}

export interface ContestPlatform extends ContestEntry {
  id: ContestSourceId;
  name: string;
  url: string;
  stale: boolean;
}

export interface ContestSnapshot {
  platforms: ContestPlatform[];
}

export interface ContestCache {
  schema: 1;
  platforms: { id: ContestSourceId; contests: Contest[]; updatedAt: string | null }[];
}

export interface ContestServiceOptions {
  fetcher?: ContestFetcher;
  readCache?: () => unknown;
  writeCache?: (cache: ContestCache) => void;
  now?: () => number;
  sources?: readonly ContestServiceSource[];
}

export interface ContestService {
  snapshot(): ContestSnapshot;
  get(force?: unknown): Promise<ContestSnapshot>;
}

export function normalizeContests(value: unknown, platform: ContestSourceId, now: number): Contest[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return (value as unknown[]).slice(0, 10000).flatMap((item): Contest[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Fields;
    if (typeof row.title !== 'string' || !row.title.trim()) return [];
    // These erased casts retain Date.parse/URL's original coercion of external values.
    const start = Date.parse(row.startTime as string), end = Date.parse(row.endTime as string);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= now || start > now + 366 * 86400000 || end - start > 90 * 86400000) return [];
    let url: URL;
    try {
      url = new URL(row.url as string);
      if (url.protocol !== 'https:' || !HOSTS[platform]?.includes(url.hostname) || url.username || url.password || url.port) return [];
      const pattern = platform === 'nowcoder' ? /^\/acm\/contest\/\d+\/?$/ : platform === 'atcoder' ? /^\/contests\/[a-zA-Z0-9_-]+\/?$/ : /^\/contest\/\d+\/?$/;
      if (!pattern.test(url.pathname)) return [];
      url.search = ''; url.hash = '';
    } catch { return []; }
    if (seen.has(url.href)) return [];
    seen.add(url.href);
    return [{ id: String(row.id ?? url.pathname).slice(0, 100), title: row.title.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 240), url: url.href, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() }];
  }).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.id.localeCompare(b.id)).slice(0, 60);
}

async function readResponse(response: ContestResponse): Promise<string> {
  if (!response.ok) {
    const error: RetryError = new Error('Contest source unavailable');
    if ([429, 503].includes(response.status)) {
      const retry = response.headers?.get('retry-after');
      const seconds = /^\d+$/.test(retry || '') ? Number(retry) : (Date.parse(retry as string) - Date.now()) / 1000;
      if (Number.isFinite(seconds) && seconds > 0) error.retryAfter = Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
    }
    throw error;
  }
  if (Number(response.headers?.get('content-length')) > MAX_BYTES) throw new Error('Contest response too large');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Contest response too large');
    return text;
  }
  const reader = response.body.getReader(), chunks: Buffer[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value!.byteLength;
      if (length > MAX_BYTES) throw new Error('Contest response too large');
      chunks.push(Buffer.from(part.value!));
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  return Buffer.concat(chunks).toString('utf8');
}

export function createContestService({ fetcher, readCache = () => null, writeCache = () => {}, now = Date.now, sources = SOURCES }: ContestServiceOptions = {}): ContestService {
  if (typeof fetcher !== 'function') throw new Error('Contest fetcher required');
  const request = fetcher;
  let disk: unknown;
  try { disk = readCache(); } catch { /* Corrupt/missing cache is a normal first run. */ }
  const entries = new Map<ContestSourceId, ContestEntry>(), attempted = new Map<ContestSourceId, number>(), retryAt = new Map<ContestSourceId, number>();
  let pending: Promise<ContestSnapshot> | null | undefined;
  for (const source of sources) {
    const cache = disk as Fields | null | undefined;
    const old = (cache?.schema === 1 && Array.isArray(cache.platforms) ? (cache.platforms as unknown[]).find(item => (item as Fields | null | undefined)?.id === source.id) : null) as Fields | null | undefined;
    const updated = typeof old?.updatedAt === 'string' ? Date.parse(old.updatedAt) : NaN;
    const valid = Number.isFinite(updated) && updated > 0 && updated <= now();
    entries.set(source.id, { contests: valid ? normalizeContests(old!.contests, source.id, now()) : [], updatedAt: valid ? new Date(updated).toISOString() : null, error: null });
  }
  function snapshot(): ContestSnapshot {
    const time = now();
    return { platforms: sources.map(source => {
      const value = entries.get(source.id)!;
      return { id: source.id, name: source.name, url: source.url, contests: normalizeContests(value.contests, source.id, time), updatedAt: value.updatedAt, stale: !!value.error || !value.updatedAt || time - Date.parse(value.updatedAt) >= CACHE_TTL, error: value.error };
    }) };
  }
  function get(force: unknown = false): Promise<ContestSnapshot> {
    if (typeof force !== 'boolean') return Promise.reject(new Error('赛程刷新参数无效'));
    if (pending) return pending;
    const time = now();
    const due = sources.filter(source => {
      const value = entries.get(source.id)!, last = attempted.get(source.id);
      if (time < (retryAt.get(source.id) || 0) || (last !== undefined && time - last < RETRY_DELAY)) return false;
      return force || !!value.error || !value.updatedAt || time - Date.parse(value.updatedAt) >= CACHE_TTL;
    });
    if (!due.length) return Promise.resolve(snapshot());
    pending = Promise.all(due.map(async source => {
      attempted.set(source.id, now());
      const current = entries.get(source.id)!;
      try {
        const response = await request(source.endpoint, {
          headers: { Accept: 'application/json, text/html;q=0.9', 'Accept-Language': 'zh-CN, en;q=0.8' },
          signal: AbortSignal.timeout(12000), redirect: 'error', credentials: 'omit'
        });
        const text = await readResponse(response);
        const parsed: unknown = source.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Contest source format changed');
        const contests = normalizeContests(parsed, source.id, now());
        // A non-empty response made entirely of invalid records must not erase a useful cache.
        if (parsed.length && !contests.length && (parsed as unknown[]).some(item => !Number.isFinite(Date.parse((item as Fields | null | undefined)?.endTime as string)))) throw new Error('Invalid contest times');
        retryAt.delete(source.id);
        entries.set(source.id, { contests, updatedAt: new Date(now()).toISOString(), error: null });
      } catch (error) {
        const failure = error as { retryAfter?: number };
        if (failure.retryAfter) retryAt.set(source.id, now() + failure.retryAfter);
        entries.set(source.id, { ...current, error: '暂时无法更新，请稍后重试或前往平台查看' });
      }
    })).then(() => {
      try { writeCache({ schema: 1, platforms: [...entries].map(([id, entry]) => ({ id, contests: entry.contests, updatedAt: entry.updatedAt })) }); } catch { /* In-memory schedule remains available if disk is read-only/full. */ }
      return snapshot();
    }).finally(() => { pending = null; });
    return pending;
  }
  return { snapshot, get };
}
