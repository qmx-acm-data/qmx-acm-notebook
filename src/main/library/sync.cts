/** Incremental index sync: probe counts, fetch only new pages, merge by id. */
import type { DailyDrawProblem } from '../../shared/models/daily-problem.js';
import type { LibraryRow, Normalizer, RawProblem } from './normalize.cts';

const { createNormalizer } = require('./library-normalize.cjs') as typeof import('./normalize.cts');

const { parseCodeforces } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
const { parseLuoguProblemList } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
const { estimateLuoguDifficulty } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
const { requestLibreOJ, parseLibreOJProblems } = require('./libreoj-daily.cjs') as typeof import('../contests/libreoj-daily.cjs');

export type PlatformId = 'CF' | 'AT' | 'LG' | 'NC' | 'LC' | 'LOJ';
export interface PlatformResult {
  status: 'skipped' | 'updated' | 'rebuilt' | 'failed';
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
  now?: () => number;
}
export interface LibrarySyncReport {
  full: boolean;
  total: number;
  durationMs: number;
  platforms: Record<string, PlatformResult>;
}

type Fields = Record<string, unknown>;
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}

interface Adapter {
  id: PlatformId;
  file: string;
  probe(): Promise<number>;
  fetchAll(): Promise<RawProblem[]>;
  fetchSince?(oldCount: number, newCount: number): Promise<RawProblem[]>;
}

export function createSync(options: LibrarySyncOptions) {
  const { directory, fs, path, fetcher } = options;
  const normalizer: Normalizer = createNormalizer(estimateLuoguDifficulty);
  const now = options.now ?? (() => Date.now());
  const metaPath = path.join(directory, 'meta.json');

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

  // ---- adapters ------------------------------------------------------------
  const lgPage = 50;
  async function getText(url: string): Promise<string> {
    const response = await fetcher(url, { headers: { accept: 'text/html' }, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }
  async function getJson(url: string): Promise<unknown> {
    const response = await fetcher(url, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }
  const luoguUrl = (page: number) => `https://www.luogu.com.cn/problem/list?type=P&page=${page}&_contentOnly=1`;
  async function fetchLuoguPages(pages: number[]): Promise<RawProblem[]> {
    const rows: RawProblem[] = [];
    for (const page of pages) {
      const parsed = parseLuoguProblemList(await getText(luoguUrl(page)));
      rows.push(...parsed.problems as unknown as RawProblem[]);
    }
    return rows;
  }

  const ncPage = 50;
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
      rows.push({ id: `NC:${id}`, source: 'NC', title, url: `https://ac.nowcoder.com/acm/problem/${id}`, rating: Number.isFinite(difficulty) && difficulty > 0 ? difficulty : null, tags: [], tagsKnown: false });
    }
    return { total, rows };
  }
  async function fetchNowcoderPages(pages: number[]): Promise<RawProblem[]> {
    const rows: RawProblem[] = [];
    for (const page of pages) rows.push(...parseNowcoderList(await getText(nowcoderUrl(page))).rows);
    return rows;
  }

  const lojPage = 100;
  async function lojPageRows(skip: number): Promise<{ count: number; rows: RawProblem[] }> {
    const payload = await requestLibreOJ('queryProblemSet', { locale: 'zh_CN', skipCount: skip, takeCount: lojPage }, fetcher, 19000);
    const parsed = parseLibreOJProblems(payload);
    return { count: parsed.count, rows: parsed.problems as unknown as RawProblem[] };
  }

  const lcQuery = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data { acRate difficulty paidOnly: isPaidOnly frontendQuestionId: questionFrontendId title titleSlug topicTags { name slug } }
  }
}`;
  async function lcPage(skip: number): Promise<{ total: number; returned: number; rows: RawProblem[] }> {
    const response = await fetcher('https://leetcode.com/graphql/', {
      method: 'POST', headers: { 'content-type': 'application/json', referer: 'https://leetcode.com/problemset/' },
      body: JSON.stringify({ query: lcQuery, variables: { categorySlug: '', limit: 1000, skip, filters: { premiumOnly: false } } }),
      signal: AbortSignal.timeout(20000), redirect: 'error', credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as unknown;
    const listing = object(object(object(payload)?.data)?.problemsetQuestionList);
    if (typeof listing?.total !== 'number') throw new Error('missing total');
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
  async function applyLeetCodeRatings(rows: RawProblem[]): Promise<RawProblem[]> {
    const ratings = await leetcodeRatingMap();
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

  const adapters: Adapter[] = [
    {
      id: 'CF', file: 'cf.ndjson',
      async probe() { return (await this.fetchAll()).length; },
      async fetchAll() { return parseCodeforces(await getJson('https://codeforces.com/api/problemset.problems')) as unknown as RawProblem[]; }
    },
    {
      id: 'AT', file: 'at.ndjson',
      async probe() { return (await this.fetchAll()).length; },
      async fetchAll() {
        const directory = await getJson('https://kenkoooo.com/atcoder/resources/problems.json');
        let models: Fields = {};
        try { models = object(await getJson('https://kenkoooo.com/atcoder/resources/problem-models.json')) ?? {}; } catch { models = {}; }
        if (!Array.isArray(directory)) throw new Error('AtCoder Problems 题库格式错误');
        const { estimateCfRating } = require('./daily-problems.cjs') as typeof import('../contests/daily-problems.cjs');
        return directory.flatMap((value: unknown): RawProblem[] => {
          const row = object(value);
          if (!row || typeof row.id !== 'string' || typeof row.contest_id !== 'string' || typeof row.title !== 'string') return [];
          const model = object(models[row.id]);
          const difficulty = typeof model?.difficulty === 'number' ? model.difficulty : null;
          return [{ id: `AT:${row.id.toUpperCase()}`, source: 'AT', title: row.title, url: `https://atcoder.jp/contests/${row.contest_id}/tasks/${row.id}`, rating: null, estimatedCfRating: estimateCfRating(difficulty), communityDifficulty: difficulty, tags: [] }];
        });
      }
    },
    {
      id: 'LC', file: 'lc.ndjson',
      async probe() { return (await lcPage(0)).total; },
      async fetchAll() {
        const rows: RawProblem[] = [];
        let skip = 0, total = 0;
        for (let page = 0; page < 200; page += 1) {
          const result = await lcPage(skip);
          total = result.total;
          rows.push(...result.rows);
          if (!result.returned) break;
          skip += result.returned;
          if (skip >= total) break;
        }
        return applyLeetCodeRatings(rows);
      },
      async fetchSince(oldCount: number) {
        const rows: RawProblem[] = [];
        let skip = Math.max(0, oldCount - 100), total = 0;
        for (let page = 0; page < 200; page += 1) {
          const result = await lcPage(skip);
          total = result.total;
          rows.push(...result.rows);
          if (!result.returned) break;
          skip += result.returned;
          if (skip >= total) break;
        }
        return applyLeetCodeRatings(rows);
      }
    },
    {
      id: 'LOJ', file: 'loj.ndjson',
      async probe() { return (await lojPageRows(0)).count; },
      async fetchAll() {
        const rows: RawProblem[] = [];
        let count = 0;
        for (let page = 0; page < 200; page += 1) {
          const result = await lojPageRows(page * lojPage);
          count = result.count;
          rows.push(...result.rows);
          if (result.rows.length < lojPage || (page + 1) * lojPage >= count) break;
        }
        return rows;
      },
      async fetchSince(oldCount: number) {
        const rows: RawProblem[] = [];
        let count = 0;
        let page = Math.max(0, Math.floor((oldCount - lojPage) / lojPage));
        for (; page < 200; page += 1) {
          const result = await lojPageRows(page * lojPage);
          count = result.count;
          rows.push(...result.rows);
          if (result.rows.length < lojPage || (page + 1) * lojPage >= count) break;
        }
        return rows;
      }
    },
    {
      id: 'NC', file: 'nc.ndjson',
      async probe() { return parseNowcoderList(await getText(nowcoderUrl(1))).total; },
      async fetchAll() {
        const rows: RawProblem[] = [];
        let total = 0;
        for (let page = 1; page <= 400; page += 1) {
          const parsed = parseNowcoderList(await getText(nowcoderUrl(page)));
          total = parsed.total;
          rows.push(...parsed.rows);
          if (!parsed.rows.length || page * ncPage >= total) break;
        }
        return rows;
      },
      async fetchSince(oldCount: number, newCount: number) {
        const first = Math.max(1, Math.floor(oldCount / ncPage));
        const last = Math.ceil(newCount / ncPage);
        const pages = Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
        return fetchNowcoderPages(pages);
      }
    },
    {
      id: 'LG', file: 'lg.ndjson',
      async probe() { return parseLuoguProblemList(await getText(luoguUrl(1))).count; },
      async fetchAll() {
        const rows: RawProblem[] = [];
        let total = 0;
        for (let page = 1; page <= 400; page += 1) {
          const parsed = parseLuoguProblemList(await getText(luoguUrl(page)));
          total = parsed.count;
          rows.push(...parsed.problems as unknown as RawProblem[]);
          if (page * lgPage >= total) break;
        }
        return rows;
      },
      async fetchSince(oldCount: number, newCount: number) {
        const first = Math.max(1, Math.floor(oldCount / lgPage));
        const last = Math.ceil(newCount / lgPage);
        const pages = Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
        return fetchLuoguPages(pages);
      }
    }
  ];

  async function runPlatform(adapter: Adapter, full: boolean): Promise<PlatformResult> {
    const existing = readShard(adapter.file);
    const before = existing.size;
    const progress = (phase: SyncProgress['phase'], extra: Partial<SyncProgress> = {}) => options.onProgress?.({ platform: adapter.id, phase, ...extra });
    try {
      progress('probe');
      const total = await adapter.probe();
      if (!full && total <= before) return { status: 'skipped', before, after: before, added: 0 };
      progress('fetch', { total });
      const rows = !full && adapter.fetchSince && before > 0
        ? await adapter.fetchSince(before, total)
        : await adapter.fetchAll();
      progress('merge', { fetched: rows.length });
      const merged = full ? new Map<string, LibraryRow>() : new Map(existing);
      let added = 0;
      for (const raw of rows) {
        const row = normalizer.record(raw);
        if (!row) continue;
        if (!merged.has(row.id)) added += 1;
        merged.set(row.id, row);
      }
      const list = [...merged.values()];
      writeShard(adapter.file, list);
      progress('done', { fetched: list.length });
      return { status: full || before === 0 ? 'rebuilt' : 'updated', before, after: list.length, added };
    } catch (error) {
      return { status: 'failed', before, after: before, added: 0, message: error instanceof Error ? error.message : 'unknown' };
    }
  }

  return {
    async run(): Promise<LibrarySyncReport> {
      const started = now();
      fs.mkdirSync(directory, { recursive: true });
      const meta = readMeta();
      const full = options.full === true;
      const selected = options.platforms ?? adapters.map(adapter => adapter.id);
      const platforms: Record<string, PlatformResult> = {};
      for (const adapter of adapters) {
        if (!selected.includes(adapter.id)) continue;
        platforms[adapter.id] = await runPlatform(adapter, full);
      }
      const shards = fs.readdirSync(directory).filter((name: string) => name.endsWith('.ndjson'));
      const summary: Record<string, { file: string; count: number; bytes: number; updatedAt?: string }> = {};
      let totalCount = 0, totalBytes = 0;
      for (const file of shards) {
        const id = file.replace('.ndjson', '').toUpperCase();
        const bytes = fs.statSync(path.join(directory, file)).size;
        const count = readShard(file).size;
        const previous = object(object(meta.platforms)?.[id]);
        summary[id] = {
          file, count, bytes,
          updatedAt: platforms[id] && platforms[id].status !== 'skipped' && platforms[id].status !== 'failed'
            ? new Date(now()).toISOString()
            : typeof previous?.updatedAt === 'string' ? previous.updatedAt : undefined
        };
        totalCount += count;
        totalBytes += bytes;
      }
      const nextMeta = {
        schema: 1,
        builtAt: new Date(now()).toISOString(),
        lastFullSync: full ? new Date(now()).toISOString() : typeof meta.lastFullSync === 'string' ? meta.lastFullSync : undefined,
        platforms: summary,
        totalCount,
        totalBytes,
        estimatedMemoryBytes: Math.round(totalCount * 450),
        tagVocabulary: normalizer.tagVocabularySize()
      };
      fs.writeFileSync(metaPath, JSON.stringify(nextMeta, null, 2));
      return { full, total: totalCount, durationMs: Math.max(0, now() - started), platforms };
    }
  };
}
