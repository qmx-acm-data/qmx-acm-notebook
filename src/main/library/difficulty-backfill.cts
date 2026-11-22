/** Resumable queue that fills the CLIST rating cache for supported local problems. */
import type {
  DifficultyBackfillPlatformState,
  DifficultyBackfillState,
  DifficultyBackfillStatus
} from '../../shared/models/difficulty-backfill.js';

export interface BackfillRecord {
  id: string;
  url: string;
  source: string;
  officialDifficulty?: string | null;
  rating?: number | null;
  luoguDifficulty?: string | null;
  /** Parent's persistent CLIST cache/shard value; null/zero confirms no valid cached rating. */
  clistRating?: number | null;
}
export interface BackfillLookupResult {
  rating: number | null;
  resource: string;
  error?: string;
  cached?: boolean;
  queriedAt?: string;
  noData?: boolean;
}
export interface BackfillDeps {
  /** Local library snapshot and authoritative CLIST cache values supplied by the parent. */
  records: readonly BackfillRecord[];
  /** Parent-owned CLIST lookup (credentials, rate limits and the rating cache stay there). */
  lookup(url: string): Promise<BackfillLookupResult>;
  readLedger(): unknown;
  writeLedger(value: unknown): void;
  readState(): unknown;
  writeState(value: unknown): void;
  now?: () => number;
  batchSize?: number;
  sleep?: (ms: number) => Promise<void>;
  shouldPause?: () => boolean;
}
export interface DifficultyBackfill {
  run(): Promise<DifficultyBackfillState>;
  state(): DifficultyBackfillState;
}

type Fields = Record<string, unknown>;
type Platform = 'AT' | 'CF' | 'LOJ' | 'LC' | 'NC' | 'LG';
type AttemptResult = 'found' | 'none' | 'error';
type AttemptReason = 'not-found' | 'no-rating' | 'request-error';
type LookupOutcome = 'found' | AttemptReason;
interface LedgerEntry { at: string; result: AttemptResult; reason?: AttemptReason }
export interface LedgerOutcomeCounts {
  found: number;
  notFound: number;
  noRating: number;
  failed: number;
  /** Legacy `none` rows have no evidence distinguishing missing records from missing ratings. */
  unclassified: number;
}
interface Ledger { root: Fields; attempts: Record<string, LedgerEntry> }
interface Candidate {
  key: string;
  url: string;
  platform: Platform;
  id: string;
  order: number;
  missingDifficulty: boolean;
  cachedRating: boolean;
  cacheKnown: boolean;
}

/** Fixed platform priority: AtCoder has no native score, so it is filled first. */
const PLATFORM_ORDER: readonly Platform[] = ['AT', 'CF', 'LOJ', 'LC', 'NC', 'LG'];
const PRIORITY: Readonly<Record<Platform, number>> = { AT: 0, CF: 1, LOJ: 2, LC: 3, NC: 4, LG: 5 };
const DEFAULT_BATCH_SIZE = 50;
/** A `none` row is re-queried after 30 days; a transient `error` after one day. */
const NONE_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const ERROR_RETRY_MS = 24 * 60 * 60 * 1000;
const STATUSES: readonly DifficultyBackfillStatus[] = ['idle', 'running', 'pausing', 'paused', 'done', 'failed'];
const INVALID_LEDGER = '难度补齐台账损坏或版本不支持，拒绝覆盖原文件';
const READ_LEDGER_FAILED = '难度补齐台账读取失败，原文件已保留';
const FAILED_MESSAGE = '难度补齐运行失败，请稍后重试';
const MISSING_MESSAGE = '本地题库没有需要补全 CLIST 缓存的题目';
const SKIPPED_MESSAGE = '没有需要补全 CLIST 缓存的题目';

function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
function countOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
function dateOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
}
function validAttemptTime(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40
    && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function isPlatform(value: string): value is Platform {
  return (PLATFORM_ORDER as readonly string[]).includes(value);
}

/**
 * Canonical problem URL (the ledger key). It mirrors the identity rules of the
 * existing library/enrichment module so aliases share one attempt record.
 */
function canonicalProblem(value: unknown): { url: string; platform: Platform } | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048 || /[\s\\]/.test(raw)) return null;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
  const host = parsed.hostname.toLowerCase();
  const route = parsed.pathname.replace(/\/$/, '');
  let match: RegExpExecArray | null;
  if (host === 'codeforces.com' || host === 'www.codeforces.com' || host === 'contest.codeforces.com') {
    match = /^\/(?:problemset\/problem\/(\d+)\/([A-Za-z0-9]+)|contest\/(\d+)\/problem\/([A-Za-z0-9]+)|gym\/(\d+)\/problem\/([A-Za-z0-9]+))$/.exec(route);
    if (!match) return null;
    if (match[5] !== undefined) return { url: `https://codeforces.com/gym/${match[5]}/problem/${match[6].toUpperCase()}`, platform: 'CF' };
    return { url: `https://codeforces.com/problemset/problem/${match[1] ?? match[3]}/${(match[2] ?? match[4]).toUpperCase()}`, platform: 'CF' };
  }
  if (host === 'atcoder.jp' || host === 'www.atcoder.jp') {
    match = /^\/contests\/([a-zA-Z0-9_-]+)\/tasks\/([a-zA-Z0-9_-]+)$/.exec(route);
    return match ? { url: `https://atcoder.jp/contests/${match[1]}/tasks/${match[2]}`, platform: 'AT' } : null;
  }
  if (host === 'luogu.com.cn' || host === 'www.luogu.com.cn' || host === 'luogu.com' || host === 'www.luogu.com') {
    match = /^\/problem\/([A-Za-z0-9_-]+)$/.exec(route);
    return match ? { url: `https://www.luogu.com.cn/problem/${match[1].toUpperCase()}`, platform: 'LG' } : null;
  }
  if (host === 'leetcode.com' || host === 'www.leetcode.com' || host === 'leetcode.cn' || host === 'www.leetcode.cn') {
    match = /^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(?:description|solutions|submissions|discuss))?$/.exec(route);
    return match ? { url: `https://leetcode.com/problems/${match[1]}/`, platform: 'LC' } : null;
  }
  if (host === 'ac.nowcoder.com' || host === 'www.nowcoder.com' || host === 'nowcoder.com') {
    match = /^\/practice\/([a-fA-F0-9]{32})$/.exec(route);
    if (match) return { url: `https://www.nowcoder.com/practice/${match[1].toLowerCase()}`, platform: 'NC' };
    match = /^\/acm\/(problem\/\d+|contest\/\d+\/[A-Za-z][A-Za-z0-9_-]*)$/.exec(route);
    return match ? { url: `https://ac.nowcoder.com/acm/${match[1]}`, platform: 'NC' } : null;
  }
  if (host === 'loj.ac' || host === 'www.loj.ac') {
    match = /^\/(?:p|problem)\/(\d+)$/.exec(route);
    return match ? { url: `https://loj.ac/p/${match[1]}`, platform: 'LOJ' } : null;
  }
  return null;
}

function emptyPlatforms(): Record<string, DifficultyBackfillPlatformState> {
  const platforms: Record<string, DifficultyBackfillPlatformState> = {};
  for (const key of PLATFORM_ORDER) platforms[key] = { missing: 0, attempted: 0, found: 0, notFound: 0, noRating: 0, failed: 0 };
  return platforms;
}
function defaultState(batchSize: number): DifficultyBackfillState {
  return {
    status: 'idle',
    running: false,
    pauseRequested: false,
    batchSize,
    processed: 0,
    found: 0,
    notFound: 0,
    noRating: 0,
    skipped: 0,
    failed: 0,
    startedAt: null,
    finishedAt: null,
    platforms: emptyPlatforms()
  };
}
function parsePlatformState(value: unknown): DifficultyBackfillPlatformState {
  const row = object(value) ?? {};
  const state: DifficultyBackfillPlatformState = {
    missing: countOrZero(row.missing), attempted: countOrZero(row.attempted), found: countOrZero(row.found)
  };
  // Absence means old, unclassified display data; never invent an outcome source.
  if (Object.hasOwn(row, 'notFound')) state.notFound = countOrZero(row.notFound);
  if (Object.hasOwn(row, 'noRating')) state.noRating = countOrZero(row.noRating);
  if (Object.hasOwn(row, 'failed')) state.failed = countOrZero(row.failed);
  return state;
}
/** Display state is tolerant: a damaged file falls back to defaults instead of blocking work. */
function parseState(value: unknown): DifficultyBackfillState | null {
  if (value === undefined || value === null) return null;
  const row = object(value);
  if (!row) return null;
  const status = typeof row.status === 'string' && (STATUSES as readonly string[]).includes(row.status)
    ? row.status as DifficultyBackfillStatus : 'idle';
  const platforms: Record<string, DifficultyBackfillPlatformState> = {};
  const rawPlatforms = object(row.platforms);
  if (rawPlatforms) for (const key of Object.keys(rawPlatforms)) platforms[key] = parsePlatformState(rawPlatforms[key]);
  const batchSize = countOrZero(row.batchSize);
  const state: DifficultyBackfillState = {
    status,
    running: row.running === true,
    pauseRequested: row.pauseRequested === true,
    batchSize: batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE,
    processed: countOrZero(row.processed),
    found: countOrZero(row.found),
    skipped: countOrZero(row.skipped),
    failed: countOrZero(row.failed),
    startedAt: dateOrNull(row.startedAt),
    finishedAt: dateOrNull(row.finishedAt),
    platforms
  };
  if (Object.hasOwn(row, 'notFound')) state.notFound = countOrZero(row.notFound);
  if (Object.hasOwn(row, 'noRating')) state.noRating = countOrZero(row.noRating);
  if (typeof row.message === 'string' && row.message) state.message = row.message.slice(0, 500);
  return state;
}
function snapshot(state: DifficultyBackfillState): DifficultyBackfillState {
  const platforms: Record<string, DifficultyBackfillPlatformState> = {};
  for (const key of Object.keys(state.platforms)) {
    const entry = state.platforms[key];
    platforms[key] = { ...entry };
  }
  const value: DifficultyBackfillState = {
    status: state.status,
    running: state.running,
    pauseRequested: state.pauseRequested,
    batchSize: state.batchSize,
    processed: state.processed,
    found: state.found,
    skipped: state.skipped,
    failed: state.failed,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    platforms
  };
  if (state.notFound !== undefined) value.notFound = state.notFound;
  if (state.noRating !== undefined) value.noRating = state.noRating;
  if (state.message !== undefined) value.message = state.message;
  return value;
}

/** Recover persisted display state without starting a worker or rewriting storage. */
export function readDifficultyBackfillState(value: unknown, batchSize = 100): DifficultyBackfillState {
  return snapshot(parseState(value) ?? defaultState(batchSize));
}

/** One linear pass keeps the 60k-row library snapshot filter O(n). */
function candidatesFrom(records: readonly BackfillRecord[]): Candidate[] {
  const seen = new Set<string>();
  const selected: Candidate[] = [];
  for (let order = 0; order < records.length; order += 1) {
    const record: unknown = records[order];
    const row = object(record);
    if (!row) continue;
    const source = row.source, id = row.id;
    if (typeof source !== 'string' || typeof id !== 'string' || !id || !isPlatform(source)) continue;
    const canonical = canonicalProblem(row.url);
    if (!canonical || canonical.platform !== source) continue;
    if (seen.has(canonical.url)) continue;
    seen.add(canonical.url);
    selected.push({
      key: canonical.url, url: canonical.url, platform: canonical.platform, id, order,
      missingDifficulty: row.officialDifficulty === null || row.officialDifficulty === undefined,
      cachedRating: typeof row.clistRating === 'number' && Number.isFinite(row.clistRating) && row.clistRating > 0,
      cacheKnown: row.clistRating !== undefined
    });
  }
  selected.sort((left, right) => PRIORITY[left.platform] - PRIORITY[right.platform]
    || Number(right.missingDifficulty) - Number(left.missingDifficulty)
    || compareText(left.id, right.id) || left.order - right.order);
  return selected;
}

/** Strict validation: one malformed attempt must block every write, keeping the file intact. */
function readLedger(read: () => unknown): Ledger {
  let value: unknown;
  try { value = read(); } catch { throw new Error(READ_LEDGER_FAILED); }
  if (value === undefined) return { root: {}, attempts: {} };
  const row = object(value);
  const rawAttempts = object(row?.attempts);
  if (!row || row.schema !== 1 || !rawAttempts) throw new Error(INVALID_LEDGER);
  const attempts: Record<string, LedgerEntry> = {};
  for (const [key, rawEntry] of Object.entries(rawAttempts)) {
    const canonical = canonicalProblem(key), entry = object(rawEntry);
    if (!canonical || canonical.url !== key || !entry) throw new Error(INVALID_LEDGER);
    if (!Object.hasOwn(entry, 'at') || !Object.hasOwn(entry, 'result')
      || Object.keys(entry).some(field => field !== 'at' && field !== 'result' && field !== 'reason')) throw new Error(INVALID_LEDGER);
    const at = entry.at, result = entry.result;
    if (!validAttemptTime(at) || (result !== 'found' && result !== 'none' && result !== 'error')) throw new Error(INVALID_LEDGER);
    const reason = entry.reason;
    if (Object.hasOwn(entry, 'reason')) {
      if (!((result === 'none' && (reason === 'not-found' || reason === 'no-rating'))
        || (result === 'error' && reason === 'request-error'))) throw new Error(INVALID_LEDGER);
      attempts[key] = { at, result, reason };
    } else attempts[key] = { at, result };
  }
  const root: Fields = { ...row };
  delete root.schema;
  delete root.attempts;
  return { root, attempts };
}
function attemptDue(entry: LedgerEntry, nowMs: number): boolean {
  if (entry.result === 'found') return false;
  const age = nowMs - Date.parse(entry.at);
  return age >= (entry.result === 'none' ? NONE_RETRY_MS : ERROR_RETRY_MS);
}
/** Build one validated lookup for explicit negative results; legacy none is unknown. */
export function createBackfillOutcomeReader(value: unknown): (url: string) => 'not-found' | 'no-rating' | null {
  const ledger = readLedger(() => value);
  return url => {
    const key = canonicalProblem(url)?.url;
    const entry = key ? ledger.attempts[key] : undefined;
    return entry?.result === 'none' && (entry.reason === 'not-found' || entry.reason === 'no-rating') ? entry.reason : null;
  };
}

/** Read-only audit of schema-1 outcomes. Invalid ledgers are rejected just as on run(). */
export function ledgerOutcomeCounts(value: unknown): LedgerOutcomeCounts {
  const ledger = readLedger(() => value);
  const counts: LedgerOutcomeCounts = { found: 0, notFound: 0, noRating: 0, failed: 0, unclassified: 0 };
  for (const entry of Object.values(ledger.attempts)) {
    if (entry.result === 'found') counts.found += 1;
    else if (entry.result === 'error') counts.failed += 1;
    else if (entry.reason === 'not-found') counts.notFound += 1;
    else if (entry.reason === 'no-rating') counts.noRating += 1;
    else counts.unclassified += 1;
  }
  return counts;
}
function classify(value: unknown): LookupOutcome {
  if (value === null || value === undefined) return 'no-rating';
  const row = object(value);
  if (!row) return 'request-error';
  if (row.noData === true || row.rating === 0) return 'no-rating';
  if (row.rating !== null && row.rating !== undefined) {
    return typeof row.rating === 'number' && Number.isFinite(row.rating) && row.rating > 0 ? 'found' : 'request-error';
  }
  const error = typeof row.error === 'string' ? row.error.trim() : '';
  if (!error || error === 'CLIST 暂无评分数据' || error === 'CLIST 题目评分未知' || error === '题目评分未知') return 'no-rating';
  if (error === 'CLIST 未收录该题') return 'not-found';
  return 'request-error';
}

export function createDifficultyBackfill(deps: BackfillDeps): DifficultyBackfill {
  const now = deps.now ?? (() => Date.now());
  const isoNow = (): string => new Date(now()).toISOString();
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const requestedBatch = deps.batchSize;
  const batchSize = typeof requestedBatch === 'number' && Number.isInteger(requestedBatch) && requestedBatch > 0
    ? requestedBatch : DEFAULT_BATCH_SIZE;
  const pauseWanted = (): boolean => deps.shouldPause?.() === true;

  function loadState(): DifficultyBackfillState | null {
    try { return parseState(deps.readState()); } catch { return null; }
  }
  function persistState(state: DifficultyBackfillState): void {
    // The parent owns atomic writes; a display-only failure must not abort the batch.
    try { deps.writeState(snapshot(state)); } catch { /* keep working */ }
  }

  async function look(candidate: Candidate): Promise<LookupOutcome> {
    try { return classify(await deps.lookup(candidate.url)); }
    catch { return 'request-error'; }
  }

  return {
    state(): DifficultyBackfillState {
      return loadState() ?? defaultState(batchSize);
    },
    async run(): Promise<DifficultyBackfillState> {
      // The ledger is read before anything is persisted: a damaged file is never overwritten.
      const ledger = readLedger(deps.readLedger);
      const candidates = candidatesFrom(deps.records);
      const platforms = emptyPlatforms();
      for (const candidate of candidates) platforms[candidate.platform].missing += 1;

      const startedMs = now();
      const state: DifficultyBackfillState = {
        status: 'running',
        running: true,
        pauseRequested: false,
        batchSize,
        // Every invocation is a new batch; only the ledger carries continuation.
        processed: 0,
        found: 0,
        notFound: 0,
        noRating: 0,
        skipped: 0,
        failed: 0,
        startedAt: new Date(startedMs).toISOString(),
        finishedAt: null,
        platforms
      };
      const attempts = ledger.attempts;
      const pending: Candidate[] = [];
      // Cache hits and ledger skips belong to this run; historical outcomes are never re-counted.
      let skipped = 0;
      for (const candidate of candidates) {
        if (candidate.cachedRating) { skipped += 1; continue; }
        const entry = Object.hasOwn(attempts, candidate.key) ? attempts[candidate.key] : undefined;
        // A found ledger row cannot hide a lost cache entry. Legacy callers that omit
        // clistRating retain their original permanent-found skip behavior.
        if (entry && !(entry.result === 'found' && candidate.cacheKnown) && !attemptDue(entry, startedMs)) {
          skipped += 1;
          continue;
        }
        pending.push(candidate);
      }
      state.skipped = skipped;
      persistState(state);

      let paused = false;
      let attempted = 0;
      try {
        if (!candidates.length) {
          state.status = 'done';
          state.message = MISSING_MESSAGE;
        } else if (!pending.length) {
          state.status = 'done';
          state.message = SKIPPED_MESSAGE;
        } else {
          for (const candidate of pending) {
            if (pauseWanted()) {
              paused = true;
              state.status = 'paused';
              state.pauseRequested = true;
              break;
            }
            if (attempted >= batchSize) {
              state.status = 'done';
              break;
            }
            // Yield once per lookup so a cached batch cannot starve the IPC pause signal.
            await sleep(0);
            const outcome = await look(candidate);
            attempts[candidate.key] = outcome === 'found'
              ? { at: isoNow(), result: 'found' }
              : { at: isoNow(), result: outcome === 'request-error' ? 'error' : 'none', reason: outcome };
            deps.writeLedger({ ...ledger.root, schema: 1, attempts: { ...attempts } });
            const platform = platforms[candidate.platform];
            state.processed += 1;
            platform.attempted += 1;
            if (outcome === 'found') {
              state.found += 1;
              platform.found += 1;
            } else if (outcome === 'not-found') {
              state.notFound = (state.notFound ?? 0) + 1;
              platform.notFound = (platform.notFound ?? 0) + 1;
            } else if (outcome === 'no-rating') {
              state.noRating = (state.noRating ?? 0) + 1;
              platform.noRating = (platform.noRating ?? 0) + 1;
            } else {
              state.failed += 1;
              platform.failed = (platform.failed ?? 0) + 1;
            }
            attempted += 1;
            persistState(state);
          }
          const remaining = pending.length - attempted;
          if (paused) state.message = `已暂停，剩余 ${remaining} 题待补齐`;
          else {
            state.status = 'done';
            state.message = `本批次已完成，剩余 ${remaining} 题待补齐`;
          }
        }
      } catch (error: unknown) {
        state.status = 'failed';
        state.message = FAILED_MESSAGE;
        throw error;
      } finally {
        state.running = false;
        state.finishedAt = isoNow();
        persistState(state);
      }
      return snapshot(state);
    }
  };
}
