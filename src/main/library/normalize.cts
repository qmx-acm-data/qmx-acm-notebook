/** Normalises platform payloads into the on-disk index row shape. */
import type { DailyDrawProblem } from '../../shared/models/daily-problem.js';

export interface LibraryRow {
  id: string;
  platform: string;
  title: string;
  url: string;
  rating: number | null;
  estimatedCfRating: number | null;
  luoguDifficulty: string | null;
  estimatedLuoguDifficulty: string | null;
  communityDifficulty: number | null;
  tags: string[];
  rawTags: string[];
  tagsKnown: boolean;
  tagsMapped: boolean;
  estimateReason: string | null;
}

export interface RawProblem {
  id?: unknown;
  source?: unknown;
  title?: unknown;
  url?: unknown;
  rating?: unknown;
  estimatedCfRating?: unknown;
  luoguDifficulty?: unknown;
  estimatedLuoguDifficulty?: unknown;
  communityDifficulty?: unknown;
  tags?: unknown;
  tagsKnown?: unknown;
  ratingEstimateReason?: unknown;
}

export interface Normalizer {
  record(row: RawProblem): LibraryRow | null;
  tagVocabularySize(): number;
}

type Fields = Record<string, unknown>;
const presets = require('../ui/tag-presets.js') as unknown as { categories?: { tags?: { name?: unknown }[] }[] };

const canonical = new Map<string, string>();
for (const category of presets.categories ?? []) {
  for (const tag of category.tags ?? []) {
    if (typeof tag.name === 'string' && tag.name.trim()) canonical.set(tag.name.trim().toLowerCase(), tag.name.trim());
  }
}
// Project-maintained heuristic for Codeforces/LeetCode English wording.
const englishAliases: Readonly<Record<string, string>> = {
  'dp': '动态规划', 'dynamic programming': '动态规划',
  'graphs': '图论', 'graph': '图论', 'shortest paths': '图论',
  'data structures': '数据结构', 'trees': '树',
  'math': '数学', 'number theory': '数学', 'combinatorics': '组合数学',
  'strings': '字符串', 'string': '字符串',
  'greedy': '贪心', 'binary search': '二分',
  'dfs and similar': '搜索', 'brute force': '搜索',
  'constructive algorithms': '构造', 'implementation': '模拟',
  'sortings': '排序', 'two pointers': '双指针',
  'bitmasks': '状压 DP', 'geometry': '计算几何',
  'probabilities': '概率与期望', 'games': '博弈论',
  'divide and conquer': '分治', 'hashing': '哈希', 'matrices': '矩阵'
};
const platformAliases: Readonly<Record<string, string>> = {
  codeforces: 'CF', 'atcoder-problems': 'AT', atcoder: 'AT',
  leetcode: 'LC', libreoj: 'LOJ', nowcoder: 'NC', luogu: 'LG'
};
const supported = new Set(['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ']);

function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
function platformOf(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const mapped = platformAliases[raw.toLowerCase()] ?? raw.toUpperCase();
  return supported.has(mapped) ? mapped : null;
}
function normalizeTag(value: string): string | null {
  const key = value.trim().toLowerCase();
  return englishAliases[key] ?? canonical.get(key) ?? null;
}
function normalizeTags(values: unknown): { tags: string[]; rawTags: string[] } {
  const tags = new Set<string>();
  const raw = new Set<string>();
  if (!Array.isArray(values)) return { tags: [], rawTags: [] };
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue;
    raw.add(value.trim());
    const tag = normalizeTag(value);
    if (tag) tags.add(tag);
  }
  return { tags: [...tags], rawTags: [...raw] };
}

export function createNormalizer(estimateLuoguDifficulty: (rating: number | null) => string | null): Normalizer {
  return {
    tagVocabularySize: () => canonical.size,
    record(row: RawProblem): LibraryRow | null {
      const platform = platformOf(row.source);
      const id = text(row.id), title = text(row.title), url = text(row.url);
      if (!platform || !id || !title || !url) return null;
      let parsed: URL;
      try { parsed = new URL(url); } catch { return null; }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      const normalizedId = /^codeforces:/i.test(id) ? `CF:${id.slice('codeforces:'.length)}` : id;
      const rating = positive(row.rating);
      const estimatedCfRating = positive(row.estimatedCfRating) ?? rating;
      const nativeLevel = text(row.luoguDifficulty);
      const storedLevel = text(row.estimatedLuoguDifficulty);
      const { tags, rawTags } = normalizeTags(row.tags);
      return {
        id: normalizedId,
        platform,
        title,
        url: parsed.href,
        rating,
        estimatedCfRating,
        luoguDifficulty: nativeLevel,
        estimatedLuoguDifficulty: storedLevel ?? (platform === 'LG' && nativeLevel ? null : estimateLuoguDifficulty(estimatedCfRating)),
        communityDifficulty: typeof row.communityDifficulty === 'number' && Number.isFinite(row.communityDifficulty) ? row.communityDifficulty : null,
        tags,
        rawTags,
        tagsKnown: row.tagsKnown === false ? false : platform !== 'AT',
        tagsMapped: tags.length > 0,
        estimateReason: text(row.ratingEstimateReason)
      };
    }
  };
}

/** Converts an index row back to the draw-time problem shape. */
export function toDrawProblem(row: LibraryRow): DailyDrawProblem | null {
  return {
    id: row.id, title: row.title, source: row.platform, origin: 'library',
    rating: row.rating, estimatedCfRating: row.estimatedCfRating,
    luoguDifficulty: row.luoguDifficulty ?? '',
    estimatedLuoguDifficulty: row.estimatedLuoguDifficulty,
    communityDifficulty: row.communityDifficulty,
    ratingEstimateReason: row.estimateReason ?? undefined,
    url: row.url, tags: row.tags
  };
}
