export type ClistFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface ClistCredentials {
  account: string;
  key: string;
}

export interface ClistProblem {
  id: string;
  name: string;
  url: string;
  platform: 'luogu' | 'nowcoder' | 'unknown';
  rating: number | null;
  tags: string[];
  tagsKnown: boolean;
  raw?: unknown;
}

export interface ClistFilter {
  tag?: string;
  minRating?: number;
  maxRating?: number;
  platform?: ClistProblem['platform'];
  /** CLIST v4 resource filter, passed through to the server. */
  resource?: string;
}

export interface ClistReport {
  requested: number;
  accepted: number;
  rejected: number;
  rejectionCategories: Record<string, number>;
  pages: number[];
  errors: string[];
  durationMs: number;
}

export interface ClistPageResult {
  problems: ClistProblem[];
  report: ClistReport;
}

export interface ClistServiceOptions {
  credentials: ClistCredentials;
  fetcher?: ClistFetcher;
  now?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  endpoint?: string;
  pageSize?: number;
  rateLimitMs?: number;
  timeoutMs?: number;
}

type Fields = Record<string, unknown>;
const DEFAULT_ENDPOINT = 'https://clist.by/api/v4/problem/';
const ALLOWED_HOSTS = new Set(['clist.by', 'www.clist.by', 'www.luogu.com.cn', 'luogu.com.cn', 'ac.nowcoder.com', 'www.nowcoder.com']);
const DEFAULT_TIMEOUT = 15_000;

function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function safeUrl(value: unknown, allowedHosts = ALLOWED_HOSTS): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
function finiteRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap(item => {
    if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
    const row = object(item);
    const label = nonEmpty(row?.name) ?? nonEmpty(row?.title) ?? nonEmpty(row?.slug);
    return label ? [label] : [];
  }))];
}
function platformFor(url: string): ClistProblem['platform'] {
  const host = new URL(url).hostname.toLowerCase();
  if (host === 'luogu.com.cn' || host === 'www.luogu.com.cn') return 'luogu';
  if (host === 'ac.nowcoder.com' || host === 'www.nowcoder.com') return 'nowcoder';
  return 'unknown';
}
function problemUrl(row: Fields): unknown {
  const direct = row.url ?? row.problem_url ?? row.problemUrl ?? row.href;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const linked = object(row.problem);
  return linked?.url ?? linked?.href ?? linked?.problem_url ?? (typeof row.problem === 'string' ? row.problem : undefined);
}
function absoluteProblemUrl(value: unknown, row: Fields): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value, resourceOrigin(row)).href;
  } catch { return null; }
}
function resourceOrigin(row: Fields): string | undefined {
  const resource = object(row.resource);
  const resourceName = nonEmpty(row.resource) ?? nonEmpty(resource?.name) ?? nonEmpty(resource?.short) ?? nonEmpty(resource?.url);
  const rawPlatform = nonEmpty(row.platform)?.toLowerCase();
  const hint = rawPlatform ?? (resourceName && /luogu/i.test(resourceName) ? 'luogu' : resourceName && /nowcoder/i.test(resourceName) ? 'nowcoder' : undefined);
  if (hint === 'luogu') return 'https://www.luogu.com.cn';
  if (hint === 'nowcoder') return 'https://ac.nowcoder.com';
  return undefined;
}
function rejectionCategory(value: unknown): string {
  const row = object(value);
  if (!row) return 'row_not_object';
  const candidate = absoluteProblemUrl(problemUrl(row), row);
  if (!candidate) return problemUrl(row) ? 'url_invalid' : 'url_missing_or_not_string';
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { return 'url_invalid'; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return 'url_unsafe';
  const resource = object(row.resource);
  const resourceName = nonEmpty(row.resource) ?? nonEmpty(resource?.name) ?? nonEmpty(resource?.short) ?? nonEmpty(resource?.url);
  const rawPlatform = nonEmpty(row.platform)?.toLowerCase();
  const hinted = rawPlatform ?? (resourceName && /luogu/i.test(resourceName) ? 'luogu' : resourceName && /nowcoder/i.test(resourceName) ? 'nowcoder' : undefined);
  const platform = hinted === 'luogu' || hinted === 'nowcoder' ? hinted : platformFor(parsed.href);
  if (platform === 'unknown') return 'unsupported_platform_domain';
  if (!validatePlatformUrl(parsed.href, platform)) return 'platform_url_pattern_mismatch';
  if (!(nonEmpty(row.name) ?? nonEmpty(row.title) ?? nonEmpty(row.problem_name))) return 'name_missing_or_not_string';
  return 'other_normalization_reject';
}
function validatePlatformUrl(value: unknown, platform: ClistProblem['platform']): string | null {
  const url = safeUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  if (platform === 'luogu' && !/^(?:www\.)?luogu\.com\.cn$/i.test(parsed.hostname)) return null;
  if (platform === 'nowcoder' && !/^(?:www\.)?nowcoder\.com$/i.test(parsed.hostname) && parsed.hostname.toLowerCase() !== 'ac.nowcoder.com') return null;
  if (platform === 'luogu' && !/^\/problem\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)) return null;
  if (platform === 'nowcoder' && !(/^(?:\/acm\/problem\/[1-9]\d*|\/acm\/contest\/[1-9]\d*\/[A-Za-z][A-Za-z0-9_-]*)\/?$/i.test(parsed.pathname))) return null;
  return url;
}

export function normalizeClistProblem(value: unknown): ClistProblem | null {
  const row = object(value);
  if (!row) return null;
  const candidateUrl = problemUrl(row);
  const resource = object(row.resource);
  const rawPlatform = nonEmpty(row.platform)?.toLowerCase();
  const resourceName = nonEmpty(row.resource) ?? nonEmpty(resource?.name) ?? nonEmpty(resource?.short) ?? nonEmpty(resource?.url);
  const platformHint = rawPlatform ?? (resourceName && /luogu/i.test(resourceName) ? 'luogu' : resourceName && /nowcoder/i.test(resourceName) ? 'nowcoder' : undefined);
  const hinted = platformHint === 'luogu' || platformHint === 'nowcoder' ? platformHint : undefined;
  const rawUrl = safeUrl(absoluteProblemUrl(candidateUrl, row));
  if (!rawUrl) return null;
  const platform = hinted ?? platformFor(rawUrl);
  if (platform === 'unknown') return null;
  const url = validatePlatformUrl(rawUrl, platform);
  if (!url) return null;
  const name = nonEmpty(row.name) ?? nonEmpty(row.title) ?? nonEmpty(row.problem_name);
  if (!name) return null;
  const rating = finiteRating(row.rating ?? row.difficulty ?? row.points);
  const hasTagField = Array.isArray(row.tags) || Array.isArray(row.tag) || Array.isArray(row.categories);
  const tags = strings(row.tags ?? row.tag ?? row.categories);
  return { id: nonEmpty(row.id) ?? url, name, url, platform, rating, tags, tagsKnown: hasTagField, raw: value };
}

export function filterClistProblems(problems: readonly ClistProblem[], filter: ClistFilter = {}): ClistProblem[] {
  if (filter.minRating !== undefined && (!Number.isFinite(filter.minRating) || filter.minRating < 0)) throw new Error('最低 rating 无效');
  if (filter.maxRating !== undefined && (!Number.isFinite(filter.maxRating) || filter.maxRating < 0)) throw new Error('最高 rating 无效');
  if (filter.minRating !== undefined && filter.maxRating !== undefined && filter.minRating > filter.maxRating) throw new Error('rating 范围无效');
  const tag = filter.tag?.trim();
  return problems.filter(problem => {
    if (filter.platform && problem.platform !== filter.platform) return false;
    if (filter.minRating !== undefined && (problem.rating === null || problem.rating < filter.minRating)) return false;
    if (filter.maxRating !== undefined && (problem.rating === null || problem.rating > filter.maxRating)) return false;
    // Missing/unknown tags are deliberately never a match for tag filtering.
    if (tag && (!problem.tagsKnown || !problem.tags.includes(tag))) return false;
    return true;
  });
}

function authHeader(credentials: ClistCredentials): string {
  if (!credentials || typeof credentials.account !== 'string' || typeof credentials.key !== 'string' || !credentials.account || !credentials.key) throw new Error('CLIST 账号与 key 必须由调用方注入');
  return `ApiKey ${credentials.account}:${credentials.key}`;
}
function randomOffset(totalCount: number, limit: number, random: () => number): number {
  const maxOffset = Math.max(0, totalCount - limit);
  const sample = random();
  const normalized = Number.isFinite(sample) && sample >= 0 && sample < 1 ? sample : 0;
  return Math.floor(normalized * (maxOffset + 1));
}

export function createClistService(options: ClistServiceOptions) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const rateLimitMs = options.rateLimitMs ?? 6_000;
  const pageSize = options.pageSize ?? 50;
  let serial: Promise<unknown> = Promise.resolve();
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  let nextAllowedAt = 0;
  // A failed CLIST request must not stall every later draw, so a successful
  // page is kept per filter and reused while the endpoint is unhealthy.
  let lastGood: { at: number; key: string; result: ClistPageResult } | null = null;
  let cooldownUntil = 0;
  const COOLDOWN_MS = 120_000;

  function endpointUrl(): URL {
    const safe = safeUrl(endpoint, new Set(['clist.by', 'www.clist.by']));
    if (!safe) throw new Error('CLIST endpoint 必须使用 HTTPS 且属于 allowlist');
    return new URL(safe);
  }
  async function waitRateLimit(): Promise<void> {
    const delay = Math.max(0, nextAllowedAt - now());
    if (delay) await sleep(delay);
    nextAllowedAt = Math.max(now(), nextAllowedAt) + rateLimitMs;
  }
  async function request(offset: number, filter: ClistFilter): Promise<{ rows: unknown[]; totalCount: number }> {
    await waitRateLimit();
    const url = endpointUrl();
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('total_count', 'true');
    if (filter.resource) url.searchParams.set('resource', filter.resource);
    if (filter.minRating !== undefined) url.searchParams.set('rating__gte', String(filter.minRating));
    if (filter.maxRating !== undefined) url.searchParams.set('rating__lte', String(filter.maxRating));
    const response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', authorization: authHeader(options.credentials) }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`CLIST HTTP ${response.status}`);
    const body = object(await response.json() as unknown);
    if (!body) throw new Error('CLIST 响应格式无效');
    const rows = Array.isArray(body.objects) ? body.objects : Array.isArray(body.results) ? body.results : null;
    if (!rows) throw new Error('CLIST 响应缺少题目列表');
    const count = typeof body.total_count === 'number' ? body.total_count : rows.length;
    return { rows, totalCount: Math.max(0, count) };
  }
  async function fetchProblemsInternal(filter: ClistFilter = {}): Promise<ClistPageResult> {
    const started = now();
    const key = `${filter.resource ?? ''}|${filter.minRating ?? ''}|${filter.maxRating ?? ''}`;
    const cached = lastGood && lastGood.key === key ? lastGood : null;
    if (cached && now() < cooldownUntil) {
      return { problems: cached.result.problems, report: { ...cached.result.report, errors: [], durationMs: 0 } };
    }
    const pages: number[] = [];
    const errors: string[] = [];
    let rows: unknown[] = [];
    try {
      const resource = filter.resource ?? (filter.platform === 'luogu' ? 'luogu.com.cn' : filter.platform === 'nowcoder' ? 'ac.nowcoder.com' : undefined);
      const requestFilter = resource === filter.resource ? filter : { ...filter, resource };
      const first = await request(0, requestFilter);
      pages.push(0);
      const selected = randomOffset(first.totalCount, pageSize, random);
      if (selected === 0) rows = first.rows;
      else { const page = await request(selected, requestFilter); pages.push(selected); rows = page.rows; }
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : 'CLIST 请求失败');
    }
    const normalized = rows.flatMap(value => { const item = normalizeClistProblem(value); return item ? [item] : []; });
    const rejectionCategories: Record<string, number> = {};
    for (const value of rows) if (!normalizeClistProblem(value)) {
      const category = rejectionCategory(value);
      rejectionCategories[category] = (rejectionCategories[category] ?? 0) + 1;
    }
    const filtered = filterClistProblems(normalized, filter);
    if (errors.length && cached) {
      cooldownUntil = now() + COOLDOWN_MS;
      const ageSeconds = Math.max(0, Math.round((now() - cached.at) / 1000));
      return { problems: cached.result.problems, report: { ...cached.result.report, errors: [`CLIST 暂时不可用，使用约 ${ageSeconds} 秒前缓存；${errors[0]}`], durationMs: Math.max(0, now() - started) } };
    }
    if (!errors.length && filtered.length > 0) {
      lastGood = { at: now(), key, result: { problems: filtered, report: { requested: rows.length, accepted: filtered.length, rejected: rows.length - normalized.length, rejectionCategories, pages, errors: [], durationMs: Math.max(0, now() - started) } } };
      cooldownUntil = 0;
    }
    return { problems: filtered, report: { requested: rows.length, accepted: filtered.length, rejected: rows.length - normalized.length, rejectionCategories, pages, errors, durationMs: Math.max(0, now() - started) } };
  }
  function fetchProblems(filter: ClistFilter = {}): Promise<ClistPageResult> {
    const run = serial.then(() => fetchProblemsInternal(filter));
    serial = run.then(() => undefined, () => undefined);
    return run;
  }
  return Object.freeze({ fetchProblems });
}
