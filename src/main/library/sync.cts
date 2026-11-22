/** Incremental index sync: probe counts, crawl pages with checkpoints, resume, merge by id. */
import type { DailyDrawProblem } from '../../shared/models/daily-problem.js';
import type {
  LibrarySyncMode,
  LibrarySyncPlatformState,
  LibrarySyncPlatformStatus,
  LibrarySyncState
} from '../../shared/models/library-sync.js';
import type { LibraryRow, Normalizer, RawProblem } from './normalize.cts';

export type {
  LibrarySyncMode,
  LibrarySyncPlatformState,
  LibrarySyncPlatformStatus,
  LibrarySyncState
} from '../../shared/models/library-sync.js';

const { createNormalizer } = require('./library-normalize.cjs') as typeof import('./normalize.cts');

const { parseCodeforces } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
const { parseLuoguProblemList } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
const { estimateLuoguDifficulty } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
const { requestLibreOJ, parseLibreOJProblems } = require('./libreoj-daily.cjs') as typeof import('../contests/libreoj-daily.cjs');

/** Pages whose rows are merged into the shard and checkpointed together. */
const DEFAULT_PAGE_BATCH = 20;
/** Delay between two page requests so long crawls do not trip upstream rate limits. */
const PAGE_DELAY_MS = 250;
const MAX_CRAWL_PAGES = 10000;

export type PlatformId = 'CF' | 'AT' | 'LG' | 'NC' | 'LC' | 'LOJ';
export interface PlatformResult {
  status: 'skipped' | 'updated' | 'rebuilt' | 'failed' | 'paused';
  before: number;
  after: number;
  added: number;
  message?: string;
}
export interface SyncProgress {
  platform: PlatformId;
  phase: 'probe' | 'fetch' | 'merge' | 'done';
  fetched?: number;
  total?: number;
}
export interface LibrarySyncOptions {
  directory: string;
  fs: typeof import('node:fs');
  path: typeof import('node:path');
  fetcher: typeof fetch;
  full?: boolean;
  platforms?: readonly PlatformId[];
  onProgress?: (event: SyncProgress) => void;
  /** Receives every persisted state snapshot; the parent mirrors it into the UI. */
  onState?: (state: LibrarySyncState) => void;
  /** Parent-injected state IO (library/sync-state.json); defaults to directory/sync-state.json. */
  readState?: () => unknown;
  writeState?: (value: unknown) => void;
  /** Cooperative pause request supplied by the parent UI. */
  shouldPause?: () => boolean;
  /** Number of pages per checkpoint batch; overridable for tests. */
  pageBatch?: number;
  /** Page-request throttler; overridable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}
export interface LibrarySyncReport {
  full: boolean;
  total: number;
  durationMs: number;
  platforms: Record<string, PlatformResult>;
}
export interface LibrarySyncController {
  run(): Promise<LibrarySyncReport>;
  pause(): void;
}

type Fields = Record<string, unknown>;
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}

const PLATFORM_STATUSES: readonly LibrarySyncPlatformStatus[] = ['idle', 'probing', 'fetching', 'merging', 'paused', 'done', 'failed', 'skipped'];
function isPlatformStatus(value: unknown): value is LibrarySyncPlatformStatus {
  return typeof value === 'string' && (PLATFORM_STATUSES as readonly string[]).includes(value);
}
function countOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}
function makePlatformState(init: {
  status: LibrarySyncPlatformStatus;
  known: number;
  total: number | null;
  fetched: number;
  added: number;
  cursor: number | null;
  updatedAt: string | null;
  message?: string;
}): LibrarySyncPlatformState {
  const state: LibrarySyncPlatformState = {
    status: init.status,
    known: init.known,
    total: init.total,
    fetched: init.fetched,
    added: init.added,
    cursor: init.cursor,
    updatedAt: init.updatedAt
  };
  if (init.message !== undefined) state.message = init.message;
  return state;
}
function parsePlatformState(value: unknown): LibrarySyncPlatformState {
  const fields = object(value) ?? {};
  return makePlatformState({
    status: isPlatformStatus(fields.status) ? fields.status : 'idle',
    known: countOrZero(fields.known),
    total: nullableCount(fields.total),
    fetched: countOrZero(fields.fetched),
    added: countOrZero(fields.added),
    cursor: nullableCount(fields.cursor),
    updatedAt: typeof fields.updatedAt === 'string' ? fields.updatedAt : null,
    ...(typeof fields.message === 'string' ? { message: fields.message } : {})
  });
}
function emptyState(): LibrarySyncState {
  return { running: false, pauseRequested: false, mode: null, startedAt: null, finishedAt: null, platforms: {}, totalCount: 0 };
}
function parseState(value: unknown): LibrarySyncState {
  const fields = object(value) ?? {};
  const platforms: Record<string, LibrarySyncPlatformState> = {};
  const rawPlatforms = object(fields.platforms) ?? {};
  for (const id of Object.keys(rawPlatforms)) platforms[id] = parsePlatformState(rawPlatforms[id]);
  const mode: LibrarySyncMode | null = fields.mode === 'full' ? 'full' : fields.mode === 'incremental' ? 'incremental' : null;
  return {
    running: fields.running === true,
    pauseRequested: fields.pauseRequested === true,
    mode,
    startedAt: typeof fields.startedAt === 'string' ? fields.startedAt : null,
    finishedAt: typeof fields.finishedAt === 'string' ? fields.finishedAt : null,
    platforms,
    totalCount: countOrZero(fields.totalCount)
  };
}
function snapshotState(state: LibrarySyncState): LibrarySyncState {
  const platforms: Record<string, LibrarySyncPlatformState> = {};
  for (const id of Object.keys(state.platforms)) platforms[id] = makePlatformState(state.platforms[id]);
  return {
    running: state.running,
    pauseRequested: state.pauseRequested,
    mode: state.mode,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    platforms,
    totalCount: state.totalCount
  };
}
/** Failure messages are persisted; strip anything that looks like a credential or bearer token. */
function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown';
  const cleaned = raw
    .replace(/([?&](?:token|access_token|api_key|apikey|key|secret|password|authorization)=)[^&\s]*/gi, '$1***')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/\b(?:cookie|set-cookie)\s*:\s*[^\s]+/gi, 'cookie: ***')
    .trim();
  return (cleaned || 'unknown').slice(0, 300);
}
function shrinkMessage(before: number, total: number): string {
  return `总数减少，建议完整重建（本地 ${before} 行，上游 ${total} 行；可能已有题目下架，已保留本地记录）`;
}

interface PageResult {
  total: number;
  rows: RawProblem[];
  /** Next page number (1-based adapters) or next skip offset (0-based adapters). */
  next: number | null;
}
interface PageSource {
  /** Newest-first sources discover additions from the head, until a known page. */
  readonly incrementalFrom?: 'head';
  /** Rows per page, used only for cursor/overlap arithmetic. */
  readonly size: number;
  /** First cursor of this adapter. */
  readonly first: number;
  /** Page containing the last known row so the tail keeps one overlapping page. */
  startFor(before: number, total: number): number;
  /** Cursor of the last page that contains upstream rows. */
  lastFor(total: number): number;
  fetch(cursor: number): Promise<PageResult>;
}
interface AdapterBase {
  id: PlatformId;
  file: string;
}
interface PagedAdapter extends AdapterBase {
  page: PageSource;
  probe(): Promise<number>;
}
interface ListAdapter extends AdapterBase {
  page?: undefined;
  probe(): Promise<RawProblem[]>;
}
type Adapter = PagedAdapter | ListAdapter;
type ProgressFn = (phase: SyncProgress['phase'], extra?: Partial<SyncProgress>) => void;

interface CrawlOutcome {
  paused: boolean;
  failed: boolean;
  message?: string;
  runAdded: number;
}

export function createSync(options: LibrarySyncOptions): LibrarySyncController {
  const { directory, fs, path, fetcher } = options;
  const normalizer: Normalizer = createNormalizer(estimateLuoguDifficulty);
  const now = options.now ?? (() => Date.now());
  const isoNow = () => new Date(now()).toISOString();
  const requestedBatch = options.pageBatch;
  const pageBatch = typeof requestedBatch === 'number' && Number.isInteger(requestedBatch) && requestedBatch > 0 ? requestedBatch : DEFAULT_PAGE_BATCH;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const metaPath = path.join(directory, 'meta.json');
  const statePath = path.join(directory, 'sync-state.json');
  const readState = options.readState ?? ((): unknown => {
    try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return null; }
  });
  const writeState = options.writeState ?? ((value: unknown) => {
    fs.writeFileSync(statePath, JSON.stringify(value, null, 2));
  });

  let pauseRequested = false;
  let activeRun = false;
  let runState: LibrarySyncState | null = null;

  function persistState(): void {
    if (!runState) return;
    const value = snapshotState(runState);
    try { writeState(value); } catch { /* state persistence must not abort a crawl */ }
    try { options.onState?.(snapshotState(value)); } catch { /* UI callback must not abort a crawl */ }
  }
  function loadState(): LibrarySyncState {
    let value: unknown;
    try { value = readState(); } catch { return emptyState(); }
    return value === null || value === undefined ? emptyState() : parseState(value);
  }
  function readMeta(): Fields {
    try { return object(JSON.parse(fs.readFileSync(metaPath, 'utf8'))) ?? {}; } catch { return {}; }
  }
  function readShard(file: string): Map<string, LibraryRow> {
    const rows = new Map<string, LibraryRow>();
    let lines: string[] = [];
    try { lines = fs.readFileSync(path.join(directory, file), 'utf8').split('\n').filter(Boolean); } catch { return rows; }
    for (const line of lines) {
      let value: unknown;
      try { value = JSON.parse(line); } catch { continue; }
      const row = object(value);
      if (row && typeof row.id === 'string') rows.set(row.id, value as LibraryRow);
    }
    return rows;
  }
  function writeShard(file: string, rows: LibraryRow[]): number {
    const target = path.join(directory, file);
    const tmp = `${target}.tmp`;
    const body = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
    fs.writeFileSync(tmp, body);
    const written = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean).length;
    if (written !== rows.length) throw new Error(`${file} line count mismatch`);
    fs.renameSync(tmp, target);
    return fs.statSync(target).size;
  }
  /** Full rebuilds keep exactly one previous copy next to the shard. */
  function backupShard(file: string): void {
    const target = path.join(directory, file);
    let body: string;
    try { body = fs.readFileSync(target, 'utf8'); } catch { return; }
    if (!body) return;
    fs.writeFileSync(`${target}.bak`, body);
  }
  function mergeRows(target: Map<string, LibraryRow>, rows: readonly RawProblem[]): { fetched: number; added: number } {
    let fetched = 0;
    let added = 0;
    for (const raw of rows) {
      const row = normalizer.record(raw);
      if (!row) continue;
      fetched += 1;
      if (!target.has(row.id)) added += 1;
      target.set(row.id, row);
    }
    return { fetched, added };
  }

  // ---- adapters ------------------------------------------------------------
  const lgPage = 50;
  async function getText(url: string): Promise<string> {
    const response = await fetcher(url, { headers: { accept: 'application/json, text/html', ...(new URL(url).hostname === 'www.luogu.com.cn' ? { 'x-lentille-request': 'content-only' } : {}) }, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }
  async function getJson(url: string): Promise<unknown> {
    const response = await fetcher(url, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }
  const luoguUrl = (page: number) => `https://www.luogu.com.cn/problem/list?type=P&page=${page}&_contentOnly=1`;
  const lgLastPage = 400;
  const lgSource: PageSource = {
    size: lgPage,
    first: 1,
    startFor(before) { return Math.max(1, Math.floor((before - 1) / lgPage) + 1); },
    lastFor(total) { return Math.max(1, Math.ceil(total / lgPage)); },
    async fetch(cursor) {
      const parsed = parseLuoguProblemList(await getText(luoguUrl(cursor)));
      const rows = parsed.problems as unknown as RawProblem[];
      const more = rows.length > 0 && cursor * lgPage < parsed.count;
      return { total: parsed.count, rows, next: more && cursor < lgLastPage ? cursor + 1 : null };
    }
  };

  const ncPage = 50;
  const ncLastPage = 400;
  const nowcoderUrl = (page: number) => `https://ac.nowcoder.com/acm/problem/list?pageSize=${ncPage}&page=${page}`;
  function parseNowcoderList(html: string): { total: number; rows: RawProblem[] } {
    const total = Number((/\u5171\s*([\d,]+)\s*\u6761/.exec(html)?.[1] || '').replace(/,/g, '')) || 0;
    const rows: RawProblem[] = [];
    for (const match of html.matchAll(/<tr data-problemId="(\d+)">([\s\S]*?)<\/tr>/g)) {
      const id = match[1], body = match[2];
      const title = (raw => raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' '))(
        (/class="title"[^>]*>([\s\S]*?)<\/a>/.exec(body)?.[1] || '').replace(/<[^>]*>/g, '').trim());
      if (!title) continue;
      const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cell[1].replace(/<[^>]*>/g, '').trim());
      const difficulty = Number(cells[2]);
      // The ACM listing uses native numeric scores (e.g. 300/1700), not the
      // practice-topic API's 1–5 tiers and not an established CF equivalent.
      const nativeDifficulty = typeof cells[2] === 'string' && cells[2] !== '' && Number.isFinite(difficulty) && difficulty >= 0 ? difficulty : null;
      rows.push({ id: `NC:${id}`, source: 'NC', title, url: `https://ac.nowcoder.com/acm/problem/${id}`, rating: null, estimatedCfRating: null, communityDifficulty: nativeDifficulty, officialDifficulty: nativeDifficulty !== null && nativeDifficulty > 0 ? String(nativeDifficulty) : null, officialTags: [], ratingEstimateReason: nativeDifficulty === null ? undefined : `牛客竞赛题库原生难度 ${nativeDifficulty}，非 CF 等价；与练习专题的 1–5 档难度不同`, tags: [], tagsKnown: false });
    }
    return { total, rows };
  }
  const ncSource: PageSource = {
    incrementalFrom: 'head',
    size: ncPage,
    first: 1,
    startFor(before) { return Math.max(1, Math.floor((before - 1) / ncPage) + 1); },
    lastFor(total) { return Math.max(1, Math.ceil(total / ncPage)); },
    async fetch(cursor) {
      const parsed = parseNowcoderList(await getText(nowcoderUrl(cursor)));
      const more = parsed.rows.length > 0 && cursor * ncPage < parsed.total;
      return { total: parsed.total, rows: parsed.rows, next: more && cursor < ncLastPage ? cursor + 1 : null };
    }
  };

  const lojPage = 100;
  const lojLastPage = 200;
  const lojSource: PageSource = {
    size: lojPage,
    first: 0,
    startFor(before) { return Math.max(0, Math.floor((before - 1) / lojPage) * lojPage); },
    lastFor(total) { return Math.max(0, Math.floor((total - 1) / lojPage) * lojPage); },
    async fetch(cursor) {
      const payload = await requestLibreOJ('queryProblemSet', { locale: 'zh_CN', skipCount: cursor, takeCount: lojPage }, fetcher, 19000);
      const parsed = parseLibreOJProblems(payload);
      const rows = parsed.problems as unknown as RawProblem[];
      const more = rows.length >= lojPage && cursor + lojPage < parsed.count;
      return { total: parsed.count, rows, next: more && cursor / lojPage + 1 < lojLastPage ? cursor + lojPage : null };
    }
  };

  const lcQuery = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data { acRate difficulty paidOnly: isPaidOnly frontendQuestionId: questionFrontendId title titleSlug topicTags { name slug } }
  }
}`;
  const lcPageSize = 1000;
  const lcLastPage = 200;
  async function lcPage(skip: number): Promise<{ total: number; returned: number; rows: RawProblem[] }> {
    const response = await fetcher('https://leetcode.com/graphql/', {
      method: 'POST', headers: { 'content-type': 'application/json', referer: 'https://leetcode.com/problemset/' },
      body: JSON.stringify({ query: lcQuery, variables: { categorySlug: '', limit: lcPageSize, skip, filters: { premiumOnly: false } } }),
      signal: AbortSignal.timeout(20000), redirect: 'error', credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as unknown;
    const listing = object(object(object(payload)?.data)?.problemsetQuestionList);
    if (typeof listing?.total !== 'number' || !Number.isSafeInteger(listing.total) || listing.total < 0) throw new Error('Invalid LeetCode total count');
    const questions = Array.isArray(listing.questions) ? listing.questions : [];
    const parsed = require('./daily-problems.cjs').parseLeetCode(payload) as DailyDrawProblem[];
    return { total: listing.total, returned: questions.length, rows: parsed as unknown as RawProblem[] };
  }

  // Community Elo ratings (zerotrac dataset): precise per-problem values, but
  // they are a community estimate and not an official or CF-equivalent rating.
  const lcRatingUrl = 'https://zerotrac.github.io/leetcode_problem_rating/data.json';
  async function leetcodeRatingMap(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    try {
      const payload = await getJson(lcRatingUrl);
      if (!Array.isArray(payload)) return map;
      for (const value of payload) {
        const row = object(value);
        if (!row) continue;
        const id = typeof row.ID === 'number' || typeof row.ID === 'string' ? String(row.ID) : '';
        const rating = typeof row.Rating === 'number' && Number.isFinite(row.Rating) ? Math.round(row.Rating) : null;
        if (/^\d+$/.test(id) && rating && rating > 0) map.set(id, rating);
      }
    } catch { return map; }
    return map;
  }
  // Fetch the community dataset at most once per sync run, even across checkpoints.
  let leetcodeRatings: Promise<Map<string, number>> | null = null;
  function leetcodeRatingCache(): Promise<Map<string, number>> {
    leetcodeRatings ??= leetcodeRatingMap();
    return leetcodeRatings;
  }
  async function applyLeetCodeRatings(rows: RawProblem[]): Promise<RawProblem[]> {
    const ratings = await leetcodeRatingCache();
    if (!ratings.size) return rows;
    for (const row of rows) {
      const id = String(row.id ?? '').replace(/^LC:/, '');
      const rating = ratings.get(id);
      if (!rating) continue;
      row.estimatedCfRating = rating;
      row.ratingEstimateReason = `LeetCode 竞赛 rating ${rating}（社区估算，非官方，非 CF 等价）`;
    }
    return rows;
  }
  const lcSource: PageSource = {
    size: lcPageSize,
    first: 0,
    startFor(before) { return Math.max(0, Math.floor((before - 1) / lcPageSize) * lcPageSize); },
    lastFor(total) { return Math.max(0, Math.floor((total - 1) / lcPageSize) * lcPageSize); },
    async fetch(cursor) {
      const page = await lcPage(cursor);
      if (page.returned === 0 && cursor < page.total) throw new Error(`LeetCode 分页提前为空（偏移 ${cursor}，共 ${page.total} 条），索引尚未完整`);
      const more = cursor + page.returned < page.total;
      if (more && cursor / lcPageSize + 1 >= lcLastPage) throw new Error('LeetCode 分页超过安全上限，索引尚未完整');
      const rows = await applyLeetCodeRatings(page.rows);
      return { total: page.total, rows, next: more ? cursor + page.returned : null };
    }
  };

  const adapters: Adapter[] = [
    {
      id: 'CF', file: 'cf.ndjson',
      async probe() { return parseCodeforces(await getJson('https://codeforces.com/api/problemset.problems')) as unknown as RawProblem[]; }
    },
    {
      id: 'AT', file: 'at.ndjson',
      async probe() {
        const directoryPayload = await getJson('https://kenkoooo.com/atcoder/resources/problems.json');
        let models: Fields = {};
        try { models = object(await getJson('https://kenkoooo.com/atcoder/resources/problem-models.json')) ?? {}; } catch { models = {}; }
        if (!Array.isArray(directoryPayload)) throw new Error('AtCoder Problems 题库格式错误');
        const { estimateCfRating } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
        return directoryPayload.flatMap((value: unknown): RawProblem[] => {
          const row = object(value);
          if (!row || typeof row.id !== 'string' || typeof row.contest_id !== 'string' || typeof row.title !== 'string') return [];
          const model = object(models[row.id]);
          const difficulty = typeof model?.difficulty === 'number' ? model.difficulty : null;
          return [{ id: `AT:${row.id.toUpperCase()}`, source: 'AT', title: row.title, url: `https://atcoder.jp/contests/${row.contest_id}/tasks/${row.id}`, rating: null, estimatedCfRating: estimateCfRating(difficulty), communityDifficulty: difficulty, tags: [], officialTags: [], officialDifficulty: null }];
        });
      }
    },
    {
      id: 'LC', file: 'lc.ndjson',
      async probe() { return (await lcPage(0)).total; },
      page: lcSource
    },
    {
      id: 'LOJ', file: 'loj.ndjson',
      async probe() {
        const payload = await requestLibreOJ('queryProblemSet', { locale: 'zh_CN', skipCount: 0, takeCount: lojPage }, fetcher, 19000);
        return parseLibreOJProblems(payload).count;
      },
      page: lojSource
    },
    {
      id: 'NC', file: 'nc.ndjson',
      async probe() { return parseNowcoderList(await getText(nowcoderUrl(1))).total; },
      page: ncSource
    },
    {
      id: 'LG', file: 'lg.ndjson',
      async probe() { return parseLuoguProblemList(await getText(luoguUrl(1))).count; },
      page: lgSource
    }
  ];

  function pauseWanted(): boolean {
    return pauseRequested || options.shouldPause?.() === true;
  }

  /**
   * Last trusted upstream total from a cleanly completed run. A shard can hold
   * fewer rows than the upstream total (LeetCode paid-only questions are counted
   * but filtered after parsing), so incremental decisions compare the new total
   * against this baseline instead of the local row count whenever one is known.
   */
  function upstreamBaseline(prior: LibrarySyncPlatformState | undefined, before: number): number {
    const completed = prior !== undefined && prior.cursor === null && (prior.status === 'done' || prior.status === 'skipped');
    return completed && prior.total !== null ? prior.total : before;
  }

  async function runPlatform(adapter: Adapter, full: boolean, previous: LibrarySyncState, sync: LibrarySyncState): Promise<PlatformResult> {
    const existing = readShard(adapter.file);
    const before = existing.size;
    const prior = previous.platforms[adapter.id];
    const baseline = upstreamBaseline(prior, before);
    // A checkpointed crawl resumes from its cursor. An incremental request may also
    // finish a paused full crawl (its shard only contains that crawl's rows), but a
    // full rebuild never continues an incremental crawl because it must clear stale rows.
    const resume = prior !== undefined && prior.cursor !== null
      && (prior.status === 'paused' || prior.status === 'failed')
      && !(full && previous.mode !== 'full');
    const target = new Map(existing);
    const progress: ProgressFn = (phase, extra = {}) => options.onProgress?.({ platform: adapter.id, phase, ...extra });
    const initial = resume && prior !== undefined
      ? makePlatformState({ status: 'fetching', known: before, total: prior.total, fetched: prior.fetched, added: prior.added, cursor: prior.cursor, updatedAt: isoNow() })
      : makePlatformState({ status: 'probing', known: before, total: null, fetched: 0, added: 0, cursor: null, updatedAt: isoNow() });
    sync.platforms[adapter.id] = initial;
    persistState();
    try {
      if (adapter.page) return await runPaged(adapter, full, previous, sync, existing, target, initial, resume, baseline, progress);
      return await runList(adapter, full, before, baseline, target, initial, progress);
    } catch (error) {
      const message = safeMessage(error);
      const failed = makePlatformState({ status: 'failed', known: before, total: initial.total, fetched: initial.fetched, added: initial.added, cursor: initial.cursor, updatedAt: isoNow(), message });
      sync.platforms[adapter.id] = failed;
      persistState();
      return { status: 'failed', before, after: target.size, added: 0, message };
    }
  }

  async function runList(adapter: ListAdapter, full: boolean, before: number, baseline: number, target: Map<string, LibraryRow>, state: LibrarySyncPlatformState, progress: ProgressFn): Promise<PlatformResult> {
    progress('probe');
    const rows = await adapter.probe();
    const total = rows.length;
    state.total = total;
    state.updatedAt = isoNow();
    persistState();
    if (!full && total === baseline) {
      state.status = 'skipped';
      state.cursor = null;
      state.fetched = 0;
      state.added = 0;
      state.updatedAt = isoNow();
      persistState();
      progress('done', { fetched: target.size });
      return { status: 'skipped', before, after: before, added: 0 };
    }
    progress('fetch', { total });
    if (full) {
      backupShard(adapter.file);
      target.clear();
    }
    const merged = mergeRows(target, rows);
    writeShard(adapter.file, [...target.values()]);
    const after = target.size;
    state.status = 'done';
    state.total = total;
    state.fetched = merged.fetched;
    state.added = merged.added;
    state.cursor = null;
    state.updatedAt = isoNow();
    persistState();
    progress('done', { fetched: after });
    const result: PlatformResult = { status: full || before === 0 ? 'rebuilt' : 'updated', before, after, added: merged.added };
    if (!full && total < baseline) result.message = shrinkMessage(baseline, total);
    return result;
  }

  async function runPaged(adapter: PagedAdapter, full: boolean, previous: LibrarySyncState, sync: LibrarySyncState, existing: Map<string, LibraryRow>, target: Map<string, LibraryRow>, state: LibrarySyncPlatformState, resume: boolean, baseline: number, progress: ProgressFn): Promise<PlatformResult> {
    const before = existing.size;
    const prior = previous.platforms[adapter.id];
    const source = adapter.page;
    let total: number | null;
    if (resume && prior !== undefined) {
      total = prior.total;
    } else {
      progress('probe');
      total = await adapter.probe();
      state.total = total;
      state.updatedAt = isoNow();
      persistState();
    }
    let start: number;
    let message: string | undefined;
    if (resume) {
      start = state.cursor ?? source.first;
    } else if (full) {
      backupShard(adapter.file);
      writeShard(adapter.file, []);
      target.clear();
      start = source.first;
    } else if (total !== null && total === baseline) {
      // The upstream count matches the last completed run. A shard with fewer rows
      // is expected when the parser filters rows the upstream total still counts
      // (LeetCode paid-only questions), so this is a clean skip, not a gap.
      state.status = 'skipped';
      state.total = total;
      state.fetched = 0;
      state.added = 0;
      state.cursor = null;
      state.updatedAt = isoNow();
      persistState();
      progress('done', { fetched: existing.size });
      return { status: 'skipped', before, after: before, added: 0 };
    } else if (total !== null && total < baseline) {
      // A shrink may mean delisted problems: keep local rows and refresh the
      // source's incremental region (newest-first head, otherwise overlapping tail).
      start = source.incrementalFrom === 'head' ? source.first : Math.min(source.startFor(before, total), source.lastFor(total));
      message = shrinkMessage(baseline, total);
    } else if (total !== null) {
      start = source.incrementalFrom === 'head' ? source.first : Math.min(source.startFor(before, total), source.lastFor(total));
    } else {
      // Defensive: no probed count means only the cursor can guide the crawl.
      start = source.first;
    }
    progress('fetch', { total: total ?? undefined });
    state.status = 'fetching';
    state.cursor = start;
    state.updatedAt = isoNow();
    persistState();
    const headMinimumAdditions = source.incrementalFrom === 'head' && before > 0 && !full && !(resume && previous.mode === 'full')
      ? Math.max(0, (total ?? before) - before) : undefined;
    const crawl = await crawlPaged(adapter, source, start, target, state, !resume, progress, headMinimumAdditions);
    if (crawl.failed) {
      const failed = makePlatformState({ status: 'failed', known: before, total: state.total, fetched: state.fetched, added: state.added, cursor: state.cursor, updatedAt: isoNow(), message: crawl.message ?? 'unknown' });
      sync.platforms[adapter.id] = failed;
      persistState();
      return { status: 'failed', before, after: target.size, added: crawl.runAdded, message: crawl.message ?? 'unknown' };
    }
    if (crawl.paused) {
      const paused = makePlatformState({ status: 'paused', known: before, total: state.total, fetched: state.fetched, added: state.added, cursor: state.cursor, updatedAt: isoNow(), message: '已暂停，检查点已保存' });
      sync.platforms[adapter.id] = paused;
      persistState();
      return { status: 'paused', before, after: target.size, added: crawl.runAdded };
    }
    const after = target.size;
    const done = makePlatformState({ status: 'done', known: before, total: state.total, fetched: state.fetched, added: state.added, cursor: null, updatedAt: isoNow() });
    sync.platforms[adapter.id] = done;
    persistState();
    progress('done', { fetched: after });
    const result: PlatformResult = { status: full || before === 0 ? 'rebuilt' : 'updated', before, after, added: crawl.runAdded };
    if (message) result.message = message;
    return result;
  }

  /**
   * Sequential page crawl with a merge checkpoint every `pageBatch` pages.
   * `priorRequest` is true when the probe already issued a page request, so the
   * first fetch is throttled as well.
   */
  async function crawlPaged(adapter: PagedAdapter, source: PageSource, start: number, target: Map<string, LibraryRow>, state: LibrarySyncPlatformState, priorRequest: boolean, progress: ProgressFn, headMinimumAdditions?: number): Promise<CrawlOutcome> {
    const knownIds = headMinimumAdditions === undefined ? null : new Set(target.keys());
    const discoveredIds = new Set<string>();
    let pending: RawProblem[] = [];
    let pagesInBatch = 0;
    let batchStart: number | null = null;
    let cursor: number | null = start;
    let requests = priorRequest ? 1 : 0;
    let total = state.total;
    const baseFetched = state.fetched;
    const baseAdded = state.added;
    let mergedThisRun = 0;
    let runAdded = 0;

    const mergePending = (): void => {
      if (!pending.length) { pagesInBatch = 0; return; }
      const rows = pending;
      const merged = mergeRows(target, rows);
      writeShard(adapter.file, [...target.values()]);
      pending = [];
      pagesInBatch = 0;
      mergedThisRun += merged.fetched;
      runAdded += merged.added;
      state.fetched = baseFetched + mergedThisRun;
      state.added = baseAdded + runAdded;
    };
    const fail = (error: unknown): CrawlOutcome => {
      const message = safeMessage(error);
      let restart = cursor;
      try { mergePending(); } catch { restart = batchStart ?? cursor; }
      state.status = 'failed';
      state.message = message;
      state.cursor = restart;
      state.updatedAt = isoNow();
      persistState();
      return { paused: false, failed: true, message, runAdded };
    };
    const pause = (): CrawlOutcome => {
      try { mergePending(); } catch { /* keep the previous checkpoint level */ }
      state.status = 'paused';
      state.cursor = cursor;
      state.updatedAt = isoNow();
      if (runState) runState.pauseRequested = true;
      persistState();
      return { paused: true, failed: false, runAdded };
    };

    for (let guard = 0; guard < MAX_CRAWL_PAGES; guard += 1) {
      if (cursor === null) break;
      const pageCursor = cursor;
      if (requests > 0) await sleep(PAGE_DELAY_MS);
      let page: PageResult;
      try {
        page = await source.fetch(pageCursor);
      } catch (error) {
        return fail(error);
      }
      requests += 1;
      if (pagesInBatch === 0) batchStart = pageCursor;
      total = page.total;
      state.total = total;
      pending.push(...page.rows);
      pagesInBatch += 1;
      cursor = page.next;
      if (knownIds !== null) {
        const ids = page.rows.map(row => normalizer.record(row)?.id);
        for (const id of ids) if (id !== undefined && !knownIds.has(id)) discoveredIds.add(id);
        // One known row is insufficient: a page can interleave old and new rows.
        // Also require the observed growth, so a known page before unseen additions
        // cannot establish a false completed upstream baseline.
        const knownPage = ids.length > 0 && ids.every(id => id !== undefined && knownIds.has(id));
        const required = Math.max(headMinimumAdditions ?? 0, page.total - knownIds.size);
        if (knownPage && discoveredIds.size >= required) cursor = null;
        else if (cursor === null && discoveredIds.size < required) {
          cursor = source.first;
          return fail(new Error('牛客新增题目数量不足，索引尚未完整，将从首页重试'));
        }
      }
      if (pagesInBatch >= pageBatch || cursor === null) {
        try {
          mergePending();
        } catch (error) {
          return fail(error);
        }
        state.cursor = cursor;
        state.status = 'fetching';
        state.updatedAt = isoNow();
        persistState();
        progress('merge', { fetched: state.fetched, total });
      }
      if (cursor === null) break;
      if (pauseWanted()) return pause();
    }
    if (cursor !== null) return fail(new Error('分页数量超过安全上限'));
    state.fetched = baseFetched + mergedThisRun;
    state.added = baseAdded + runAdded;
    state.cursor = null;
    state.status = 'done';
    state.updatedAt = isoNow();
    return { paused: false, failed: false, runAdded };
  }

  return {
    pause(): void {
      pauseRequested = true;
      if (activeRun && runState) {
        runState.pauseRequested = true;
        persistState();
      }
    },
    async run(): Promise<LibrarySyncReport> {
      const started = now();
      fs.mkdirSync(directory, { recursive: true });
      const meta = readMeta();
      const full = options.full === true;
      const selected = options.platforms ?? adapters.map(adapter => adapter.id);
      const previous = loadState();
      // An incremental entry point may be asked to finish a paused/failed full
      // rebuild. Such a run *is* a full rebuild for state, meta and UI purposes.
      const resumableFull = (id: PlatformId): LibrarySyncPlatformState | undefined => {
        const prior = previous.platforms[id];
        if (previous.mode !== 'full' || prior === undefined || prior.cursor === null) return undefined;
        return prior.status === 'paused' || prior.status === 'failed' ? prior : undefined;
      };
      const resumedFull = !full && adapters.some(adapter => selected.includes(adapter.id) && resumableFull(adapter.id) !== undefined);
      const mode: LibrarySyncMode = full || resumedFull ? 'full' : 'incremental';
      // A platform finished during the interrupted full run keeps that run's fresh
      // shard; platforms that were never reached must still be rebuilt from scratch.
      const completedDuringPausedRun = (prior: LibrarySyncPlatformState | undefined): boolean =>
        prior !== undefined && prior.cursor === null && (prior.status === 'done' || prior.status === 'skipped')
          && previous.startedAt !== null && prior.updatedAt !== null && prior.updatedAt >= previous.startedAt;
      pauseRequested = false;
      activeRun = true;
      const sync: LibrarySyncState = {
        running: true,
        pauseRequested: false,
        mode,
        startedAt: new Date(started).toISOString(),
        finishedAt: null,
        platforms: { ...previous.platforms },
        totalCount: previous.totalCount
      };
      runState = sync;
      persistState();
      const platforms: Record<string, PlatformResult> = {};
      let pauseStopped = false;
      try {
        for (const adapter of adapters) {
          if (!selected.includes(adapter.id)) continue;
          if (pauseWanted()) { pauseStopped = true; break; }
          const prior = previous.platforms[adapter.id];
          const resuming = resumableFull(adapter.id) !== undefined;
          const platformFull = full || (resumedFull && !resuming && !completedDuringPausedRun(prior));
          const result = await runPlatform(adapter, platformFull, previous, sync);
          platforms[adapter.id] = result;
          if (result.status === 'paused') { pauseStopped = true; break; }
        }
        const shards = fs.readdirSync(directory).filter((name: string) => name.endsWith('.ndjson'));
        const summary: Record<string, Fields> = {};
        let totalCount = 0, totalBytes = 0;
        for (const file of shards) {
          const id = file.replace('.ndjson', '').toUpperCase();
          const bytes = fs.statSync(path.join(directory, file)).size;
          const count = readShard(file).size;
          const previousPlatform = object(object(meta.platforms)?.[id]);
          const changed = platforms[id] !== undefined && platforms[id].status !== 'skipped' && platforms[id].status !== 'failed';
          const updatedAt = changed ? isoNow() : typeof previousPlatform?.updatedAt === 'string' ? previousPlatform.updatedAt : undefined;
          summary[id] = { ...(previousPlatform ?? {}), file, count, bytes, ...(updatedAt === undefined ? {} : { updatedAt }) };
          totalCount += count;
          totalBytes += bytes;
        }
        const failure = Object.keys(platforms).map(id => platforms[id]).find(result => result.status === 'failed');
        const attemptedAll = selected.every(id => platforms[id] !== undefined);
        const cleanFinish = !pauseStopped && attemptedAll && Object.keys(platforms).every(id => platforms[id].status !== 'failed' && platforms[id].status !== 'paused');
        const lastFullSync = (full || resumedFull) && cleanFinish ? isoNow() : typeof meta.lastFullSync === 'string' ? meta.lastFullSync : undefined;
        const nextMeta: Fields = {
          ...meta,
          schema: 1,
          builtAt: isoNow(),
          lastFullSync,
          platforms: summary,
          totalCount,
          totalBytes,
          estimatedMemoryBytes: Math.round(totalCount * 450),
          tagVocabulary: normalizer.tagVocabularySize(),
          lastSyncMode: mode,
          lastSyncAt: isoNow()
        };
        if (failure) nextMeta.lastError = failure.message ?? 'unknown';
        else delete nextMeta.lastError;
        fs.writeFileSync(metaPath, JSON.stringify(nextMeta, null, 2));
        sync.totalCount = totalCount;
        return { full: full || resumedFull, total: totalCount, durationMs: Math.max(0, now() - started), platforms };
      } finally {
        activeRun = false;
        sync.running = false;
        sync.finishedAt = isoNow();
        sync.pauseRequested = pauseStopped;
        persistState();
      }
    }
  };
}
