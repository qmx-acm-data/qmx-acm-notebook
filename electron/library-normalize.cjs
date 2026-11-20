// Generated from src/main/library/normalize.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNormalizer = createNormalizer;
exports.toDrawProblem = toDrawProblem;
const presets = require('../ui/tag-presets.js');
const canonical = new Map();
for (const category of presets.categories ?? []) {
    for (const tag of category.tags ?? []) {
        if (typeof tag.name === 'string' && tag.name.trim())
            canonical.set(tag.name.trim().toLowerCase(), tag.name.trim());
    }
}
// Project-maintained heuristic for Codeforces/LeetCode English wording.
const englishAliases = {
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
const platformAliases = {
    codeforces: 'CF', 'atcoder-problems': 'AT', atcoder: 'AT',
    leetcode: 'LC', libreoj: 'LOJ', nowcoder: 'NC', luogu: 'LG'
};
const supported = new Set(['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ']);
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function positive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
function platformOf(value) {
    const raw = text(value);
    if (!raw)
        return null;
    const mapped = platformAliases[raw.toLowerCase()] ?? raw.toUpperCase();
    return supported.has(mapped) ? mapped : null;
}
function normalizeTag(value) {
    const key = value.trim().toLowerCase();
    return englishAliases[key] ?? canonical.get(key) ?? null;
}
function normalizeTags(values) {
    const tags = new Set();
    const raw = new Set();
    if (!Array.isArray(values))
        return { tags: [], rawTags: [] };
    for (const value of values) {
        if (typeof value !== 'string' || !value.trim())
            continue;
        raw.add(value.trim());
        const tag = normalizeTag(value);
        if (tag)
            tags.add(tag);
    }
    return { tags: [...tags], rawTags: [...raw] };
}
function createNormalizer(estimateLuoguDifficulty) {
    return {
        tagVocabularySize: () => canonical.size,
        record(row) {
            const platform = platformOf(row.source);
            const id = text(row.id), title = text(row.title), url = text(row.url);
            if (!platform || !id || !title || !url)
                return null;
            let parsed;
            try {
                parsed = new URL(url);
            }
            catch {
                return null;
            }
            if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
                return null;
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
function toDrawProblem(row) {
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
