import type { DailyDrawFilters, DailyDrawProblem, DailyDrawResult } from '../../shared/models/daily-problem.js';
import type { ClistPageResult } from '../clist/service.cts';
import type { DailyLibrary } from '../library/index.cts';
const { luoguDifficultyRank } = require('./luogu-difficulty.js') as typeof import('../../shared/luogu-difficulty.js');

export interface DailyClistService {
  fetchProblems(filter?: { resource?: string; minRating?: number; maxRating?: number }): Promise<ClistPageResult>;
  lookupRating?(url: string): Promise<{ rating: number | null; resource: string; error?: string; cached?: boolean; stale?: boolean; queriedAt?: string }>;
}
/** Independent daily-problem data layer. */
export interface DailyProblem {
  id: string;
  source: 'codeforces';
  title: string;
  url: string;
  rating: number | null;
  difficulty: number | null;
  tags: string[];
}
export interface ProblemFilter {
  minDifficulty?: number;
  maxDifficulty?: number;
  tags?: readonly string[];
  excludedIds?: readonly string[];
  sourceWeights?: Readonly<Record<string, number>>;
}
export interface ProblemResult {
  problems: DailyProblem[];
  errors: { source: string; message: string }[];
}
type Fields = Record<string, unknown>;
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
/** Approximate rating bands, not an official cross-platform equivalence. */
export function codeforcesDifficulty(rating: unknown): number | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) return null;
  if (rating < 1200) return 1;
  if (rating < 1600) return 2;
  if (rating < 2000) return 3;
  if (rating < 2400) return 4;
  return 5;
}
export function parseCodeforces(payload: unknown): DailyProblem[] {
  const root = object(payload);
  const result = object(root?.result);
  if (root?.status !== 'OK' || !Array.isArray(result?.problems)) throw new Error('Invalid Codeforces API response');
  return result.problems.flatMap((value: unknown): DailyProblem[] => {
    const p = object(value);
    if (!p || typeof p.contestId !== 'number' || !Number.isSafeInteger(p.contestId) || p.contestId <= 0 || typeof p.index !== 'string' || !/^[A-Za-z0-9]+$/.test(p.index) || typeof p.name !== 'string' || !p.name.trim()) return [];
    const rating = typeof p.rating === 'number' && Number.isFinite(p.rating) && p.rating > 0 ? p.rating : null;
    const tags = Array.isArray(p.tags) ? [...new Set(p.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag: string) => tag.trim().toLowerCase()))] : [];
    const id = `${p.contestId}${p.index}`;
    return [{ id: `codeforces:${id}`, source: 'codeforces', title: p.name.trim(), url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`, rating, difficulty: codeforcesDifficulty(rating), tags }];
  });
}
/** A source failure is returned explicitly; no problems are fabricated. */
export async function fetchDailyProblems(fetcher: typeof fetch = fetch, timeoutMs = 15000): Promise<ProblemResult> {
  try {
    const response = await fetcher('https://codeforces.com/api/problemset.problems', {
      signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return { problems: parseCodeforces(payload), errors: [] };
  } catch (error: unknown) {
    return { problems: [], errors: [{ source: 'codeforces', message: error instanceof Error ? error.message : 'Unknown source error' }] };
  }
}
/** Uncalibrated heuristic for cross-platform filtering, not an official equivalence. */
export function estimateCfRating(communityDifficulty: number | null): number | null {
  if (communityDifficulty === null || !Number.isFinite(communityDifficulty)) return null;
  return Math.max(800, Math.min(3500, Math.round((communityDifficulty + 800) / 100) * 100));
}
const luoguDifficultyNames: Readonly<Record<number, string>> = {
  0: '暂无评定', 1: '入门', 2: '普及−', 3: '普及/提高−', 4: '普及+/提高',
  5: '提高+/省选−', 6: '省选/NOI−', 7: 'NOI/NOI+/CTSC'
};
// Types come from Luogu's own taxonomy: Algorithm only, never Origin/Time/
// Region/SpecialProblem/Others even when a non-algorithm label looks technical.
const luoguTagCatalog = require('../ui/luogu-tags.json') as { tags: { id: number; name: string; type: number }[]; types: { id: number; type: string }[] };
const luoguAlgorithmType = luoguTagCatalog.types.find(type => type.type === 'Algorithm')?.id;
const luoguTagNames: Readonly<Record<number, string>> = Object.fromEntries(
  luoguTagCatalog.tags.filter(tag => tag.type === luoguAlgorithmType).map(tag => [tag.id, tag.name.replace(/^\uFEFF/, '').trim()])
);
const luoguPageSize = 50;
const luoguMaxPages = 3;
// Luogu answers the listing with a same-URL redirect challenge for this client,
// so a successful snapshot is reused instead of retrying through the protection.
interface LuoguSnapshot { at: number; count: number; problems: DailyDrawProblem[] }
let luoguSnapshot: LuoguSnapshot | null = null;
const luoguSnapshotMaxAgeMs = 60 * 60_000;
export function resetLuoguSnapshot(): void { luoguSnapshot = null; }

// Representative CF ratings are heuristic, not official equivalents.
const luoguCfRatings: Readonly<Record<string, number>> = {
  '入门': 900, '普及-': 1100, '普及': 1300, '普及/提高-': 1300,
  '普及+/提高': 1600, '普及+/提高-': 1600, '提高': 1800,
  '提高+/省选-': 2100, '省选/NOI-': 2400, 'NOI/NOI+/CTSC': 2800, 'NOI/NOI+/CTS': 2800
};
function luoguLevelKey(value: string): string { return value.trim().replace(/−/g, '-'); }
function estimateLuoguCfRating(level: string): number | null { return luoguCfRatings[luoguLevelKey(level)] ?? null; }

export function parseLuoguProblemList(text: unknown): { problems: DailyDrawProblem[]; count: number } {
  if (typeof text !== 'string') throw new Error('洛谷题库响应不是文本');
  const content = text.replace(/^\uFEFF/, '').trim();
  const match = /<script\s+id=["']lentille-context["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/i.exec(content);
  if (!match && !content.startsWith('{')) throw new Error('洛谷题库缺少公开数据');
  let payload: unknown;
  try { payload = JSON.parse(match ? match[1] : content); } catch { throw new Error('洛谷题库 JSON 格式错误'); }
  const data = object(object(object(payload)?.data)?.problems);
  if (!data || !Array.isArray(data.result) || typeof data.count !== 'number' || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error('洛谷题库格式错误');
  const problems = data.result.flatMap((value: unknown): DailyDrawProblem[] => {
    const row = object(value);
    if (!row || typeof row.pid !== 'string' || !/^[A-Z][A-Z0-9]*$/.test(row.pid) || typeof row.name !== 'string' || !row.name.trim()) return [];
    const level = typeof row.difficulty === 'number' && Number.isInteger(row.difficulty) ? luoguDifficultyNames[row.difficulty] : undefined;
    const tagIds = Array.isArray(row.tags) ? row.tags.filter((tag: unknown): tag is number => typeof tag === 'number' && Number.isSafeInteger(tag)) : [];
    const tags = [...new Set(tagIds.flatMap(id => luoguTagNames[id] ? [luoguTagNames[id]] : []))];
    return [{ id: `LG:${row.pid}`, title: row.name.trim(), source: 'LG', origin: 'public', estimatedCfRating: level ? estimateLuoguCfRating(level) : null, estimatedLuoguDifficulty: null, url: `https://www.luogu.com.cn/problem/${row.pid}`, rating: null, luoguDifficulty: level ?? '', officialTags: tags, officialDifficulty: row.difficulty === 0 ? null : level ?? null, tags }];
  });
  return { problems, count: data.count };
}

export async function fetchLuoguProblems(fetcher: typeof fetch = fetch, timeoutMs = 15000, random: () => number = Math.random): Promise<{ problems: DailyDrawProblem[]; errors: string[] }> {
  try {
    const problems: DailyDrawProblem[] = [];
    const pageErrors: string[] = [];
    let count = 0;
    const pages = [1];
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      try {
        const response = await fetcher(`https://www.luogu.com.cn/problem/list?type=P&page=${page}&_contentOnly=1`, {
          headers: { accept: 'application/json, text/html', 'x-lentille-request': 'content-only' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parseLuoguProblemList(await response.text());
        count = parsed.count;
        problems.push(...parsed.problems);
      } catch (error: unknown) {
        const cause = error instanceof Error ? error.cause : undefined;
        const redirected = (error instanceof Error && /Attempted to redirect, but redirect policy was 'error'/.test(error.message))
          || (cause instanceof Error && cause.message === 'unexpected redirect');
        const detail = redirected ? '公开页面返回 HTTP 重定向，匿名请求未跟随' : error instanceof Error ? error.message : '未知获取错误';
        pageErrors.push(`第 ${page} 页获取失败（${detail}）`);
        continue;
      }
      if (index === 0) {
        const available = Math.max(0, Math.ceil(count / luoguPageSize) - 1);
        const chosen = new Set<number>();
        for (let i = 0; i < Math.min(luoguMaxPages - 1, available); i += 1) {
          const value = random();
          if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must return a value in [0, 1)');
          let selected = Math.floor(value * (available - i)) + 2;
          for (const previous of [...chosen].sort((a, b) => a - b)) if (selected >= previous) selected += 1;
          chosen.add(selected);
          pages.push(selected);
        }
      }
    }
    if (count > problems.length && problems.length > 0) pageErrors.push(`洛谷题库抽样 ${problems.length} 题（共 ${count} 题），筛选和随机范围受分页上限限制`);
    if (problems.length === 0 && pageErrors.length > 0 && luoguSnapshot && Date.now() - luoguSnapshot.at <= luoguSnapshotMaxAgeMs) {
      const ageSeconds = Math.max(0, Math.round((Date.now() - luoguSnapshot.at) / 1000));
      return { problems: luoguSnapshot.problems, errors: [`洛谷公开页面暂时不可用（${pageErrors[0]}），使用约 ${ageSeconds} 秒前的题库快照`] };
    }
    if (problems.length === 0 && pageErrors.length === 0) pageErrors.push('洛谷题库没有返回可用题目');
    if (problems.length > 0) luoguSnapshot = { at: Date.now(), count, problems: [...problems] };
    return { problems, errors: pageErrors };
  } catch (error: unknown) {
    return { problems: [], errors: [error instanceof Error ? error.message : 'Unknown source error'] };
  }
}

const leetcodeQuery = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data { acRate difficulty paidOnly: isPaidOnly frontendQuestionId: questionFrontendId title titleSlug topicTags { name slug } }
  }
}`;

export function estimateLeetCodeRating(difficulty: unknown): number | null {
  if (difficulty === 'Easy') return 1000;
  if (difficulty === 'Medium') return 1600;
  if (difficulty === 'Hard') return 2200;
  return null;
}

export function parseLeetCode(payload: unknown): DailyDrawProblem[] {
  const root = object(payload);
  const data = object(root?.data);
  const listing = object(data?.problemsetQuestionList);
  if (!Array.isArray(listing?.questions)) throw new Error('Invalid LeetCode problem list response');
  return listing.questions.flatMap((value: unknown): DailyDrawProblem[] => {
    const row = object(value);
    if (!row || row.paidOnly !== false || typeof row.frontendQuestionId !== 'string' || !/^[0-9]+$/.test(row.frontendQuestionId) || typeof row.title !== 'string' || !row.title.trim() || typeof row.titleSlug !== 'string' || !/^[a-z0-9-]+$/.test(row.titleSlug)) return [];
    const rating = estimateLeetCodeRating(row.difficulty);
    const tags = Array.isArray(row.topicTags) ? row.topicTags.flatMap((item: unknown): string[] => {
      const tag = object(item);
      return typeof tag?.name === 'string' && tag.name.trim() ? [tag.name.trim()] : [];
    }) : [];
    return [{ id: `LC:${row.frontendQuestionId}`, title: row.title.trim(), source: 'LC', origin: 'leetcode', estimatedCfRating: rating, ratingEstimateReason: rating === null ? undefined : `低置信度估算，依据力扣原生难度 ${String(row.difficulty)}，映射为 CF 评分 ${rating}`, estimatedLuoguDifficulty: estimateLuoguDifficulty(rating), url: `https://leetcode.com/problems/${row.titleSlug}/`, rating: null, luoguDifficulty: '', officialTags: tags, officialDifficulty: ['Easy', 'Medium', 'Hard'].includes(String(row.difficulty)) ? String(row.difficulty) : null, tags }];
  });
}

export async function fetchLeetCodeProblems(fetcher: typeof fetch = fetch, timeoutMs = 15000): Promise<{ problems: DailyDrawProblem[]; errors: string[] }> {
  const problems: DailyDrawProblem[] = [];
  try {
    let total = 0;
    let skip = 0;
    for (let page = 0; skip < total || skip === 0; page += 1) {
      if (page >= 10000) throw new Error('LeetCode 分页超过安全上限，题库尚未完整');
      const response = await fetcher('https://leetcode.com/graphql/', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: leetcodeQuery, variables: { categorySlug: '', limit: 1000, skip, filters: { premiumOnly: false } } }),
        signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const listing = object(object(object(payload)?.data)?.problemsetQuestionList);
      if (typeof listing?.total !== 'number' || !Number.isSafeInteger(listing.total) || listing.total < 0) throw new Error('Invalid LeetCode total count');
      total = listing.total;
      const questions = Array.isArray(listing.questions) ? listing.questions : [];
      problems.push(...parseLeetCode(payload));
      if (questions.length === 0 && skip < total) throw new Error(`LeetCode 分页提前为空（偏移 ${skip}，共 ${total} 条），题库尚未完整`);
      skip += questions.length;
      if (skip >= total) break;
    }
    return { problems, errors: [] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown source error';
    return { problems, errors: [problems.length ? `LeetCode 已保留 ${problems.length} 道已获取题目；${message}` : message] };
  }
}

export async function fetchAtCoderProblems(fetcher: typeof fetch = fetch, timeoutMs = 15000): Promise<{ problems: DailyDrawProblem[]; errors: string[] }> {
  const load = async (url: string): Promise<unknown> => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  const [directory, models] = await Promise.allSettled([
    load('https://kenkoooo.com/atcoder/resources/problems.json'),
    load('https://kenkoooo.com/atcoder/resources/problem-models.json')
  ]);
  const errors: string[] = [];
  if (directory.status === 'rejected') return { problems: [], errors: [`AtCoder Problems 题库获取失败：${directory.reason instanceof Error ? directory.reason.message : '未知错误'}`] };
  if (!Array.isArray(directory.value)) return { problems: [], errors: ['AtCoder Problems 题库格式错误'] };
  let modelMap: Fields = {};
  if (models.status === 'rejected') errors.push('AtCoder Problems 社区难度获取失败，难度未知');
  else if (!object(models.value)) errors.push('AtCoder Problems 社区难度格式错误，难度未知');
  else modelMap = object(models.value) ?? {};
  const problems = directory.value.flatMap((value: unknown): DailyDrawProblem[] => {
    const row = object(value);
    if (!row || typeof row.id !== 'string' || !/^[a-z0-9_-]+$/i.test(row.id) || typeof row.contest_id !== 'string' || !/^[a-z0-9_-]+$/i.test(row.contest_id) || typeof row.title !== 'string' || !row.title.trim()) return [];
    const model = object(modelMap[row.id]);
    const difficulty = typeof model?.difficulty === 'number' && Number.isFinite(model.difficulty) ? model.difficulty : null;
    const estimatedCfRating = estimateCfRating(difficulty);
    return [{ id: `AT:${row.id.toUpperCase()}`, title: row.title.trim(), source: 'AT', origin: 'atcoder-problems', url: `https://atcoder.jp/contests/${row.contest_id}/tasks/${row.id}`, rating: null, estimatedCfRating, communityDifficulty: difficulty, estimatedLuoguDifficulty: estimateLuoguDifficulty(estimatedCfRating), luoguDifficulty: '', tags: [] }];
  });
  return { problems, errors };
}
/** All requested tags must match; unrated problems are excluded only when difficulty is bounded. */
export function filterProblems(problems: readonly DailyProblem[], filter: ProblemFilter = {}): DailyProblem[] {
  const excluded = new Set(filter.excludedIds ?? []);
  const tags = (filter.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  return problems.filter(problem => {
    if (excluded.has(problem.id) || seen.has(problem.id)) return false;
    if ((filter.minDifficulty !== undefined || filter.maxDifficulty !== undefined) && problem.difficulty === null) return false;
    if (problem.difficulty !== null && ((filter.minDifficulty !== undefined && problem.difficulty < filter.minDifficulty) || (filter.maxDifficulty !== undefined && problem.difficulty > filter.maxDifficulty))) return false;
    if (!tags.every(tag => problem.tags.some(value => value.toLowerCase() === tag))) return false;
    seen.add(problem.id);
    return true;
  });
}
/** Each candidate's weight is its source weight. A seeded random function may be injected. */
export function selectProblem(problems: readonly DailyProblem[], filter: ProblemFilter = {}, random: () => number = Math.random): DailyProblem | null {
  const weighted = filterProblems(problems, filter).map(problem => {
    const weight = filter.sourceWeights?.[problem.source] ?? 1;
    return { problem, weight: Number.isFinite(weight) && weight > 0 ? weight : 0 };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must return a value in [0, 1)');
  let target = value * total;
  for (const item of weighted) {
    if (target < item.weight) return item.problem;
    target -= item.weight;
  }
  return weighted.filter(item => item.weight > 0).at(-1)?.problem ?? null;
}

const tagGroups = [
  ['动态规划', '动态规划 dp', 'dp'], ['图论', 'graphs'], ['数据结构', 'data structures'], ['数学', 'math'],
  ['字符串', 'strings'], ['贪心', 'greedy'], ['二分', 'binary search'], ['搜索', 'dfs and similar'],
  ['树', 'trees'], ['构造', 'constructive algorithms']
] as const;
function normalizedTag(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, ' '); }
const tagAliases: ReadonlyMap<string, ReadonlySet<string>> = new Map(tagGroups.flatMap(group => {
  const normalized = new Set(group.map(normalizedTag));
  return [...normalized].map(tag => [tag, normalized] as const);
}));
function tagsMatch(problemTags: readonly string[], requestedTag: string): boolean {
  const { normalizeAlgorithmTag } = require('./library-normalize.cjs') as typeof import('../library/normalize.cjs');
  const canonicalRequested = normalizeAlgorithmTag(requestedTag);
  const requested = normalizedTag(requestedTag);
  const aliases = tagAliases.get(requested);
  return problemTags.some(value => {
    const candidate = normalizedTag(value);
    return candidate === requested || aliases?.has(candidate) === true || (canonicalRequested !== null && normalizeAlgorithmTag(value) === canonicalRequested);
  });
}
export function estimateLuoguDifficulty(rating: number | null): string | null {
  if (rating === null || !Number.isFinite(rating) || rating < 0) return null;
  if (rating < 1000) return '入门';
  if (rating < 1200) return '普及-';
  if (rating < 1400) return '普及';
  if (rating < 1600) return '普及+/提高-';
  if (rating < 1900) return '提高';
  if (rating < 2200) return '提高+/省选-';
  if (rating < 2600) return '省选/NOI-';
  return 'NOI/NOI+/CTS';
}
function normalizeRecord(value: unknown): DailyDrawProblem | null {
  const row = object(value);
  if (!row || typeof row.title !== 'string' || !row.title.trim() || typeof row.platform !== 'string') return null;
  const source = row.platform.toUpperCase();
  if (!['CF', 'LG', 'AT', 'NC', 'LC', 'LOJ'].includes(source)) return null;
  const rawUrl = typeof row.problemUrl === 'string' && row.problemUrl ? row.problemUrl : row.url;
  if (typeof rawUrl !== 'string') return null;
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  url.hash = '';
  const id = typeof row.pid === 'string' && row.pid.trim() ? `${source}:${row.pid.trim().replace(/^CF/i, '').toUpperCase()}` : url.href;
  const rating = typeof row.rating === 'number' && Number.isFinite(row.rating) && row.rating > 0 ? row.rating : null;
  const tags = Array.isArray(row.tags) ? row.tags.filter((tag: unknown): tag is string => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean) : [];
  const luoguDifficulty = typeof row.luoguDifficulty === 'string' ? row.luoguDifficulty : source === 'LG' && typeof row.difficulty === 'string' ? row.difficulty : '';
  const origin = row.kind === 'local' ? 'local' : 'public';
  const communityDifficulty = typeof row.communityDifficulty === 'number' && Number.isFinite(row.communityDifficulty) ? row.communityDifficulty : null;
  const storedEstimatedCfRating = typeof row.estimatedCfRating === 'number' && Number.isFinite(row.estimatedCfRating) && row.estimatedCfRating > 0 ? row.estimatedCfRating : null;
  const storedEstimatedLuoguDifficulty = typeof row.estimatedLuoguDifficulty === 'string' && row.estimatedLuoguDifficulty.trim() ? row.estimatedLuoguDifficulty.trim() : null;
  const storedRatingEstimateReason = typeof row.ratingEstimateReason === 'string' && row.ratingEstimateReason.trim() ? row.ratingEstimateReason.trim() : undefined;
  let estimatedCfRating = source === 'LG' ? estimateLuoguCfRating(luoguDifficulty) ?? storedEstimatedCfRating : storedEstimatedCfRating;
  if (source === 'AT') estimatedCfRating = estimateCfRating(communityDifficulty) ?? storedEstimatedCfRating;
  if (source === 'NC' && communityDifficulty !== null && Number.isInteger(communityDifficulty) && communityDifficulty >= 1 && communityDifficulty <= 5) estimatedCfRating = [800, 1200, 1600, 2000, 2400][communityDifficulty - 1];
  else if (source === 'NC') estimatedCfRating = storedEstimatedCfRating;
  if (source === 'LC') estimatedCfRating = estimateLeetCodeRating(row.difficulty) ?? storedEstimatedCfRating;
  const estimatedLuoguDifficulty = source === 'LG' && (luoguDifficultyRank(luoguDifficulty) ?? 0) > 0
    ? null
    : storedEstimatedLuoguDifficulty ?? estimateLuoguDifficulty(rating ?? estimatedCfRating);
  const { normalizeOfficialMetadata } = require('./library-normalize.cjs') as typeof import('../library/normalize.cjs');
  const official = normalizeOfficialMetadata({ ...row, luoguDifficulty, officialDifficulty: typeof row.officialDifficulty === 'string' || row.officialDifficulty === null ? row.officialDifficulty : typeof row.difficulty === 'string' && row.difficulty.trim() ? row.difficulty : undefined }, source, tags);
  return { id, title: row.title.trim(), source, origin, communityDifficulty, estimatedCfRating, estimatedLuoguDifficulty, ratingEstimateReason: storedRatingEstimateReason, url: url.href, rating, luoguDifficulty, tags, ...official };
}
interface DailySourceResult { problems: DailyDrawProblem[]; errors: string[] }
interface DailySourceSnapshot { at: number; result?: DailySourceResult; pending?: Promise<DailySourceResult> }
const dailySourceSnapshots = new WeakMap<typeof fetch, Map<string, DailySourceSnapshot>>();
const dailySourceMaxAgeMs = 5 * 60_000;
function copySourceResult(result: DailySourceResult): DailySourceResult {
  return { problems: result.problems.map(problem => ({ ...problem, tags: [...problem.tags] })), errors: [...result.errors] };
}
/** Repeated draws share public source data, never account-scoped records. */
async function loadDailySource(fetcher: typeof fetch, source: string, load: () => Promise<DailySourceResult>): Promise<DailySourceResult> {
  let snapshots = dailySourceSnapshots.get(fetcher);
  if (!snapshots) { snapshots = new Map(); dailySourceSnapshots.set(fetcher, snapshots); }
  const previous = snapshots.get(source);
  if (previous?.pending) return copySourceResult(await previous.pending);
  if (previous?.result && Date.now() - previous.at >= 0 && Date.now() - previous.at < dailySourceMaxAgeMs) return copySourceResult(previous.result);
  const pending = load();
  const snapshot: DailySourceSnapshot = { at: 0, pending };
  snapshots.set(source, snapshot);
  try {
    const result = await pending;
    // A failed or incomplete fetch must remain retryable on the next draw.
    if (result.problems.length > 0 && result.errors.length === 0) { snapshot.at = Date.now(); snapshot.result = copySourceResult(result); }
    return copySourceResult(result);
  } finally {
    snapshot.pending = undefined;
    if (!snapshot.result) snapshots.delete(source);
  }
}

/** CLIST ratings are resource-specific, not standardized. This explicitly named
 * heuristic is a reference assumption, never a fitted cross-site calibration.
 * Native CF and native Luogu values always take precedence. */
export function applyClistDifficultyReference(problem: DailyDrawProblem): DailyDrawProblem {
  const raw = problem.clistRating;
  if (raw === 0) {
    const zeroEstimate = problem.difficultyReference?.basis === 'clist' || problem.estimatedCfRating === 0;
    return { ...problem, clistRating: null, clistRatingStatus: 'no-data',
      ...(zeroEstimate && !problem.supplementInfo?.difficulty ? { estimatedCfRating: null, estimatedLuoguDifficulty: null, difficultyReference: undefined, ratingEstimateReason: undefined } : {}) };
  }
  if (problem.supplementInfo?.difficulty) return problem;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return problem;
  const reference = Math.max(0, Math.min(3500, Math.round(raw / 100) * 100));
  const nativeCf = problem.source === 'CF' && problem.rating !== null;
  return {
    ...problem,
    clistRatingStatus: 'available',
    estimatedCfRating: nativeCf ? null : reference,
    estimatedLuoguDifficulty: problem.source === 'LG' && (luoguDifficultyRank(problem.luoguDifficulty) ?? 0) > 0 ? null : estimateLuoguDifficulty(nativeCf ? problem.rating : reference),
    difficultyReference: { method: 'clist-elo-reference-v2', basis: 'clist', confidence: 'low', calibrated: false, resource: problem.source, rawRating: raw },
    ratingEstimateReason: `CLIST 原始评分 ${raw}（${problem.source} 站内标尺）。CF 参考 ${nativeCf ? problem.rating : reference}，洛谷参考采用本项目分档；这是未跨平台校准的低置信参考，不是官方等价${raw > 3500 ? '；CF 参考显示上限为 3500' : ''}。CLIST 作者明确说明各站评分未标准化。`
  };
}

/** Records must already be restricted to the current repository and visible account. */
export async function dailyDraw(input: unknown, records: readonly unknown[], fetcher: typeof fetch = fetch, random: () => number = Math.random, clist?: DailyClistService, library?: DailyLibrary, supplement?: (problem: DailyDrawProblem) => DailyDrawProblem): Promise<DailyDrawResult> {
  const startedAt = performance.now();
  const filter = object(input);
  if (!filter) throw new Error('抽题筛选格式不正确');
  let source = filter.source ?? 'all';
  let platform = filter.platform ?? '';
  // Compatibility with the original widget, where source meant platform.
  if (typeof source === 'string' && ['CF', 'LG', 'AT', 'NC', 'LC', 'LOJ'].includes(source)) { platform = source; source = 'all'; }
  if (source === '') source = 'all';
  if (typeof source !== 'string' || !['all', 'local', 'public'].includes(source)) throw new Error('题库来源不支持');
  if (typeof platform !== 'string' || !['', 'CF', 'LG', 'AT', 'NC', 'LC', 'LOJ'].includes(platform)) throw new Error('题目平台不支持');
  const bound = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000) throw new Error('评分范围不正确');
    return value;
  };
  const min = bound(filter.ratingMin), max = bound(filter.ratingMax);
  const communityBound = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10000) throw new Error('社区难度范围不正确');
    return value;
  };
  const communityMin = communityBound(filter.communityDifficultyMin), communityMax = communityBound(filter.communityDifficultyMax);
  if (communityMin !== undefined && communityMax !== undefined && communityMin > communityMax) throw new Error('社区难度范围不正确');
  if (min !== undefined && max !== undefined && min > max) throw new Error('最低评分不能大于最高评分');
  const level = filter.luoguDifficulty ?? filter.difficulty ?? '';
  if (typeof level !== 'string' || level.length > 100) throw new Error('难度格式不正确');
  const normalizedLevel = level.trim();
  const exactLevelRank = normalizedLevel ? luoguDifficultyRank(normalizedLevel) : null;
  if (normalizedLevel && exactLevelRank === null) throw new Error('洛谷难度不支持');
  const luoguBound = (value: unknown, label: string): number | undefined => {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') throw new Error(`${label}洛谷难度格式不正确`);
    const rank = luoguDifficultyRank(value);
    if (rank === null || rank < 1 || rank > 8) throw new Error(`${label}洛谷难度不支持，请选择入门至 NOI/NOI+/CTS，不能使用暂无评定`);
    return rank;
  };
  const luoguMin = luoguBound(filter.luoguDifficultyMin, '最低');
  const luoguMax = luoguBound(filter.luoguDifficultyMax, '最高');
  if (luoguMin !== undefined && luoguMax !== undefined && luoguMin > luoguMax) throw new Error('最低洛谷难度不能高于最高洛谷难度');
  if (filter.tags !== undefined && (!Array.isArray(filter.tags) || filter.tags.length > 30 || filter.tags.some(tag => typeof tag !== 'string' || tag.length > 100))) throw new Error('标签格式不正确');
  const tags = (Array.isArray(filter.tags) ? filter.tags as string[] : []).map(tag => tag.trim().toLowerCase()).filter(Boolean);
  const excludedInput = filter.excludedIds;
  if (excludedInput !== undefined && (!Array.isArray(excludedInput) || excludedInput.length > 100 || excludedInput.some(id => typeof id !== 'string' || !id.trim() || id.length > 2048))) throw new Error('排除题目格式不正确');
  const excluded = new Set<string>(Array.isArray(excludedInput) ? excludedInput.map((id: string) => id.trim()) : []);
  const candidates = records.map(normalizeRecord).filter((p): p is DailyDrawProblem => p !== null);
  const errors: string[] = [];
  const libraryRecords = Array.isArray(library?.records) ? library.records : [];
  // Each indexed platform stays offline; missing shards can still use public sources.
  const indexedPlatforms = new Set(libraryRecords.map(problem => problem.source));
  if (source === 'all') candidates.push(...libraryRecords.map(problem => ({ ...problem })));
  const needsRemote = (target: string): boolean => source === 'all' && (!platform || platform === target) && !indexedPlatforms.has(target);
  const clistSource = (needsRemote('LG') || needsRemote('NC')) && tags.length === 0 && clist;
  if (clistSource) {
    const clistResources = ['LG', 'NC'].filter(needsRemote);
    for (const target of clistResources) {
      const clistFilter = { resource: target === 'LG' ? 'luogu.com.cn' : 'ac.nowcoder.com' };
      try {
        const remote = await clist.fetchProblems(clistFilter);
        candidates.push(...remote.problems.map(problem => ({
          id: `${problem.platform === 'luogu' ? 'LG' : 'NC'}:${problem.id}`,
          title: problem.name,
          source: problem.platform === 'luogu' ? 'LG' as const : 'NC' as const,
          origin: (problem.platform === 'luogu' ? 'clist-luogu' : 'clist-nowcoder') as 'clist-luogu' | 'clist-nowcoder',
          estimatedCfRating: null,
          estimatedLuoguDifficulty: null,
          url: problem.url,
          rating: null,
          clistRating: problem.rating,
          luoguDifficulty: '',
          tags: problem.tags
        })));
        errors.push(...remote.report.errors.map(error => `CLIST 获取提示：${error}`));
      } catch (error: unknown) {
        errors.push(`CLIST 获取失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  }
  if (needsRemote('CF')) {
    const remote = await loadDailySource(fetcher, 'CF', async () => {
      const result = await fetchDailyProblems(fetcher);
      return {
        problems: result.problems.map(p => ({ id: `CF:${p.id.slice('codeforces:'.length).toUpperCase()}`, title: p.title, source: 'CF', origin: 'codeforces' as const, estimatedLuoguDifficulty: estimateLuoguDifficulty(p.rating), url: p.url, rating: p.rating, luoguDifficulty: '', tags: p.tags })),
        errors: result.errors.map(error => error.message)
      };
    });
    if (remote.errors[0]) errors.push(`Codeforces 获取失败：${remote.errors[0]}`);
    candidates.push(...remote.problems);
  }
  if (needsRemote('AT')) {
    const remote = await loadDailySource(fetcher, 'AT', () => fetchAtCoderProblems(fetcher));
    candidates.push(...remote.problems);
    errors.push(...remote.errors);
  }
  if (needsRemote('LG')) {
    const remote = await fetchLuoguProblems(fetcher);
    candidates.push(...remote.problems);
    errors.push(...remote.errors.map(error => `洛谷获取提示：${error}`));
  }
  if (needsRemote('LC')) {
    const remote = await loadDailySource(fetcher, 'LC', () => fetchLeetCodeProblems(fetcher));
    candidates.push(...remote.problems);
    errors.push(...remote.errors.map(error => `力扣获取失败：${error}`));
  }
  if (needsRemote('NC')) {
    const remote = await loadDailySource(fetcher, 'NC', async () => {
      const { fetchNowcoderProblems, estimateNowcoderCfRating } = await import('./nowcoder-daily.cjs');
      const result = await fetchNowcoderProblems(fetcher);
      return {
        problems: result.problems.map(problem => ({
          id: problem.id,
          title: problem.title,
          source: 'NC' as const,
          origin: 'nowcoder' as const,
          communityDifficulty: problem.difficulty,
          estimatedCfRating: estimateNowcoderCfRating(problem.difficulty),
          estimatedLuoguDifficulty: estimateLuoguDifficulty(estimateNowcoderCfRating(problem.difficulty)),
          url: problem.url,
          rating: null,
          luoguDifficulty: '',
          tags: problem.tags
        })),
        errors: result.errors.map(error => `牛客专题 ${error.topicId} 获取失败：${error.message}`)
      };
    });
    candidates.push(...remote.problems);
    errors.push(...remote.errors);
  }
  if (needsRemote('LOJ')) {
    const remote = await loadDailySource(fetcher, 'LOJ', async () => {
      const { fetchLibreOJProblems } = await import('./libreoj-daily.cjs');
      return fetchLibreOJProblems(fetcher);
    });
    candidates.push(...remote.problems);
    errors.push(...remote.errors.map(error => `LibreOJ 获取提示：${error}`));
  }
  for (let i = 0; i < candidates.length; i += 1) candidates[i] = applyClistDifficultyReference(candidates[i]);
  for (const candidate of candidates) {
    if (candidate.ratingEstimateReason) continue;
    if (candidate.rating == null && candidate.estimatedCfRating != null) {
      const basis = candidate.source === 'LG' ? `洛谷原生难度 ${candidate.luoguDifficulty}`
        : candidate.source === 'AT' ? `AtCoder Problems 社区难度 ${candidate.communityDifficulty}`
        : candidate.source === 'NC' ? `牛客原生难度 ${candidate.communityDifficulty}/5`
        : candidate.source === 'LC' ? '力扣原生难度' : '来源难度';
      candidate.ratingEstimateReason = `低置信度估算，依据${basis}映射为 CF 评分 ${candidate.estimatedCfRating}，非官方等价`;
    } else if (candidate.estimatedLuoguDifficulty && candidate.rating != null) {
      candidate.ratingEstimateReason = `低置信度估算，依据来源评分 ${candidate.rating} 映射为洛谷等级 ${candidate.estimatedLuoguDifficulty}，非官方等价`;
    }
  }
  if (supplement) for (let index = 0; index < candidates.length; index += 1) candidates[index] = supplement(candidates[index]);
  const problemUrlKey = (value: string): string => {
    try {
      const url = new URL(value);
      url.hash = '';
      url.pathname = url.pathname.replace(/\/+$/, '') || '/';
      return url.href;
    } catch { return value; }
  };
  // A redraw excludes every copy, including URL-only records and CLIST IDs.
  const excludedUrls = new Set([...excluded].map(problemUrlKey));
  for (const candidate of candidates) if (excluded.has(candidate.id)) excludedUrls.add(problemUrlKey(candidate.url));
  const seen = new Set<string>();
  const seenUrls = new Set<string>();
  const eligible = candidates.filter(p => {
    const comparableRating = p.rating ?? p.estimatedCfRating ?? null;
    const nativeLevelRank = p.source === 'LG' && p.origin !== 'clist-luogu' ? luoguDifficultyRank(p.luoguDifficulty) : null;
    const hasNativeLuoguLevel = nativeLevelRank !== null && nativeLevelRank >= 1;
    const actualLevelRank = hasNativeLuoguLevel ? nativeLevelRank : luoguDifficultyRank(p.estimatedLuoguDifficulty ?? '');
    const levelMatches = exactLevelRank === 0 ? nativeLevelRank === 0 || actualLevelRank === 0 : actualLevelRank === exactLevelRank;
    if (source === 'local' && p.origin !== 'local' || source === 'public' && p.origin !== 'local' && p.origin !== 'public' || platform && p.source !== platform || min !== undefined && (comparableRating === null || comparableRating < min) || max !== undefined && (comparableRating === null || comparableRating > max) || normalizedLevel && !levelMatches) return false;
    if ((luoguMin !== undefined || luoguMax !== undefined) && (actualLevelRank === null || actualLevelRank < 1 || luoguMin !== undefined && actualLevelRank < luoguMin || luoguMax !== undefined && actualLevelRank > luoguMax)) return false;
    if ((communityMin !== undefined || communityMax !== undefined) && (p.communityDifficulty == null || communityMin !== undefined && p.communityDifficulty < communityMin || communityMax !== undefined && p.communityDifficulty > communityMax)) return false;
    if (!tags.every(tag => tagsMatch(p.tags, tag))) return false;
    const url = problemUrlKey(p.url);
    const sourceUrl = `${p.source}:${url}`;
    if (excluded.has(p.id) || excludedUrls.has(url) || seen.has(p.id) || seenUrls.has(sourceUrl)) return false;
    seen.add(p.id);
    seenUrls.add(sourceUrl);
    return true;
  });
  if (!eligible.length) {
    const unsupported = source === 'all' && platform && platform !== 'CF' && platform !== 'AT' && platform !== 'LC' && platform !== 'LG' && platform !== 'NC' && platform !== 'LOJ' ? `；${platform} 暂不支持直接获取公开题库，仅可使用本地和当前仓库缓存` : '';
    const message = excluded.size ? '没有其他符合条件的题目，请调整筛选条件后重试' : '没有符合条件的题目';
    throw new Error(`${message}${unsupported}${errors.length ? `；${errors.join('；')}` : ''}`);
  }
  // Two-stage draw: pick a platform uniformly among platforms that still have
  // eligible candidates, then pick one problem uniformly inside that platform.
  // Platform sizes therefore no longer skew which platform is drawn.
  const buckets = new Map<string, DailyDrawProblem[]>();
  for (const candidate of eligible) {
    const bucket = buckets.get(candidate.source);
    if (bucket) bucket.push(candidate); else buckets.set(candidate.source, [candidate]);
  }
  const platforms = [...buckets.keys()];
  const platformValue = random();
  if (!Number.isFinite(platformValue) || platformValue < 0 || platformValue >= 1) throw new RangeError('random must return a value in [0, 1)');
  const chosenPlatform = platforms[Math.min(platforms.length - 1, Math.floor(platformValue * platforms.length))];
  const bucket = buckets.get(chosenPlatform) as DailyDrawProblem[];
  const pickValue = random();
  if (!Number.isFinite(pickValue) || pickValue < 0 || pickValue >= 1) throw new RangeError('random must return a value in [0, 1)');
  let problem = bucket[Math.min(bucket.length - 1, Math.floor(pickValue * bucket.length))];
  const notes = [...errors];
  // Drawing stays offline and fast: cached CLIST scores are already applied by the
  // caller, and missing ones are filled by the explicit refresh button or the
  // difficulty backfill queue. A rate-limited lookup here would delay every draw.
  if (problem.clistRating == null && problem.clistRatingStatus !== 'no-data' && problem.clistRatingStatus !== 'not-found') problem = { ...problem, clistRatingStatus: source !== 'all' ? 'not-requested' : clist ? 'not-obtained' : 'not-configured' };
  if (source === 'all' && !clist && problem.clistRating == null) notes.push('CLIST 未配置 API Key：本次使用原生或来源启发式难度，并非 CLIST 评级；配置后可用“刷新评分”或难度补全');
  const platformCoverage: Record<string, { count: number; tagged: number }> = {};
  for (const candidate of candidates) {
    const entry = platformCoverage[candidate.source] ??= { count: 0, tagged: 0 };
    entry.count += 1; if (candidate.tags.length) entry.tagged += 1;
  }
  const { normalizeSourceAlgorithmTags } = require('./library-normalize.cjs') as typeof import('../library/normalize.cjs');
  problem = { ...problem, tags: normalizeSourceAlgorithmTags(problem.tags, problem.supplementInfo?.tags ? 'CF' : problem.source) };
  const diagnostics = {
    durationMs: Math.max(0, performance.now() - startedAt), candidateCount: eligible.length, platforms: platformCoverage,
    dataMode: source !== 'all' ? 'scoped' as const : libraryRecords.length ? [...new Set(candidates.map(p => p.source))].some(code => !indexedPlatforms.has(code)) ? 'mixed' as const : 'index' as const : 'online' as const
  };
  if (source === 'all' && libraryRecords.length) notes.push(`本地题库索引 ${libraryRecords.length} 题${library?.builtAt ? `（更新于 ${library.builtAt.slice(0, 10)}）` : ''}`);
  if (problem.origin === 'clist-luogu') notes.push('候选来源：CLIST 洛谷题库');
  if (problem.origin === 'clist-nowcoder') notes.push('候选来源：CLIST 牛客题库');
  if (problem.origin === 'libreoj' && problem.estimatedCfRating == null) notes.push('LibreOJ 未提供官方难度，提交统计不足以生成估算');
  if (problem.source === 'LG' && problem.clistRating == null && problem.rating == null && problem.estimatedCfRating != null) notes.push(`洛谷难度 ${problem.luoguDifficulty || problem.estimatedLuoguDifficulty || ''} 对应 CF 评分约 ${problem.estimatedCfRating}（启发式估算，非官方等价）`);
  if (problem.origin === 'atcoder-problems' && problem.clistRating == null) notes.push(problem.communityDifficulty == null ? 'AtCoder Problems 社区难度未知，无法估算 CF 评分' : `AtCoder Problems 社区估算难度：${problem.communityDifficulty}；CF 评分约 ${problem.estimatedCfRating}（启发式：社区难度加 800，取整到百位并限制在 800–3500，非官方等价）`);
  if (problem.origin === 'leetcode' && problem.clistRating == null) notes.push(`力扣 ${problem.id.slice(3)} 题目难度映射为 CF 评分约 ${problem.estimatedCfRating}（启发式 Easy=1000、Medium=1600、Hard=2200，非官方等价）`);
  if (problem.origin === 'nowcoder' && problem.clistRating == null) notes.push(problem.communityDifficulty == null ? '牛客原生难度未知，无法估算 CF 评分' : `牛客原生难度 ${problem.communityDifficulty}/5；CF 评分约 ${problem.estimatedCfRating}（启发式 1=800、2=1200、3=1600、4=2000、5=2400，非官方等价）`);
  return notes.length ? { problem, note: notes.join('；'), diagnostics } : { problem, diagnostics };
}
