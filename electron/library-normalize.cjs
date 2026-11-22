// Generated from src/main/library/normalize.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAlgorithmTag = normalizeAlgorithmTag;
exports.normalizeSourceAlgorithmTags = normalizeSourceAlgorithmTags;
exports.normalizeOfficialMetadata = normalizeOfficialMetadata;
exports.createNormalizer = createNormalizer;
exports.toDrawProblem = toDrawProblem;
const presets = require('../ui/tag-presets.js');
const canonical = new Map();
for (const category of presets.categories ?? []) {
    for (const tag of category.tags ?? []) {
        if (typeof tag.name === 'string' && tag.name.trim())
            canonical.set(tag.name.trim().replace(/\s+/g, ' ').toLowerCase(), tag.name.trim());
    }
}
// Project-maintained heuristic for Codeforces/LeetCode English wording.
const englishAliases = {
    'dp': '动态规划', 'dynamic programming': '动态规划',
    'graphs': '图论', 'graph': '图论', 'shortest paths': '最短路', 'shortest path': '最短路',
    'data structures': '数据结构', 'trees': '树论', 'tree': '树论',
    'math': '数学', 'number theory': '数论', 'combinatorics': '组合数学',
    'strings': '字符串', 'string': '字符串', 'string matching': '字符串匹配',
    'greedy': '贪心', 'binary search': '二分',
    'dfs and similar': '搜索', 'brute force': '搜索',
    'constructive algorithms': '构造', 'implementation': '模拟', 'simulation': '模拟',
    'sortings': '排序', 'sorting': '排序', 'two pointers': '双指针',
    'bitmasks': '位运算', 'bit manipulation': '位运算', 'geometry': '计算几何',
    'probabilities': '概率论', 'probability and statistics': '概率论', 'games': '博弈论', 'game theory': '博弈论',
    'divide and conquer': '分治', 'hashing': '哈希', 'matrices': '矩阵', 'matrix': '矩阵',
    'array': '数组', 'hash table': '哈希表', 'linked list': '链表',
    'stack': '栈', 'queue': '队列', 'heap (priority queue)': '优先队列', 'heap': '堆',
    'depth-first search': '深度优先搜索 DFS', 'breadth-first search': '广度优先搜索 BFS',
    'backtracking': '回溯', 'prefix sum': '前缀和', 'sliding window': '滑动窗口',
    'union find': '并查集', 'trie': '字典树 Trie', 'segment tree': '线段树',
    'binary indexed tree': '树状数组', 'topological sort': '拓扑排序',
    'monotonic stack': '单调栈', 'monotonic queue': '单调队列',
    'memoization': '记忆化搜索', 'recursion': '递归', 'enumeration': '枚举',
    'binary tree': '二叉树', 'binary search tree': '二叉搜索树',
    'minimum spanning tree': '生成树', 'biconnected component': '双连通分量',
    'strongly connected component': '强连通分量', 'eulerian circuit': '欧拉回路',
    'counting': '计数', 'counting sort': '计数排序', 'bucket sort': '桶排序',
    'radix sort': '基数排序', 'quickselect': '快速选择', 'merge sort': '归并排序',
    'ordered set': '有序集合', 'design': '设计', 'database': '数据库',
    'bitmask': '位运算', 'meet-in-the-middle': '折半搜索 meet in the middle',
    'randomized': '随机化', 'randomization': '随机化', 'rolling hash': '滚动哈希',
    'fft': '快速傅里叶变换 FFT', 'flows': '网络流', 'dsu': '并查集',
    'chinese remainder theorem': '中国剩余定理 CRT', 'ternary search': '三分',
    'graph matchings': '图匹配', 'string suffix structures': '后缀数据结构',
    'expression parsing': '表达式解析', 'schedules': '调度',
    'interactive': '', 'output only': ''
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
const projectAliases = {
    '动态规划': '动态规划 DP', '树': '树论', '哈希': '哈希 hashing',
    '矩阵': '矩阵运算', '双指针': '双指针 two-pointer', '概率与期望': '概率论',
    'bfs': '广度优先搜索 BFS', '广度优先搜索': '广度优先搜索 BFS', '广度优先搜索(bfs)': '广度优先搜索 BFS',
    'dfs': '深度优先搜索 DFS', '深度优先搜索': '深度优先搜索 DFS', '深度优先搜索(dfs)': '深度优先搜索 DFS',
    '基础数学': '数学', '整数二分': '二分', '实数二分': '二分',
    'hash': '哈希 hashing', 'hash 表': '哈希表', 'hash表': '哈希表',
    'kmp': 'KMP 算法', 'lca': '最近公共祖先 LCA', '最近公共祖先': '最近公共祖先 LCA',
    '后缀数组': '后缀数组 SA', '后缀自动机': '后缀自动机 SAM',
    '中国剩余定理': '中国剩余定理 CRT', '乘法逆元': '逆元',
    'fwt': '快速沃尔什变换 FWT', 'link-cut tree': '动态树 LCT',
    'manacher': 'Manacher 算法', '生成函数 / 母函数': '生成函数',
    'berlekamp-massey 算法': 'Berlekamp-Massey(BM) 算法'
};
function cleanTag(value) {
    return value.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ');
}
const luoguCatalog = require('../ui/luogu-tags.json');
const officialAlgorithmNames = new Set(luoguCatalog.tags.filter(tag => tag.type === 2).map(tag => cleanTag(tag.name).toLowerCase()));
const luoguNonAlgorithmNames = new Set(luoguCatalog.tags.filter(tag => tag.type !== 2).map(tag => cleanTag(tag.name).toLowerCase()));
// Region, origin, year and special-problem labels are metadata on every source.
// Luogu's legacy Others also contains actual algorithms (e.g. Treap), so those
// names are only excluded by Luogu's strict official-type check below.
const metadataNames = new Set(luoguCatalog.tags.filter(tag => [1, 3, 4, 5].includes(tag.type)).map(tag => cleanTag(tag.name).toLowerCase()));
const nonAlgorithmLabels = new Set([
    'interactive', 'output only', 'output-only', 'special', 'special judge', 'special problem',
    'communication', '题型', '交互', '交互题', '通信题', '提交答案', '提交答案题', '特殊题目',
    '传统题', '传统型', '传统型试题', '答案提交', '题目来源', '来源', '年份', '时间', '地区',
    '算法', 'o2优化', 'o2 优化', '未知', 'unknown', 'none', 'null', 'undefined'
]);
/** Resolve known algorithm labels and curated synonyms; unknown names return null. */
function normalizeAlgorithmTag(value) {
    const key = cleanTag(value).toLowerCase();
    const aliasKey = key.replace(/（/g, '(').replace(/）/g, ')').replace(/\s*\(\s*(bfs|dfs)\s*\)/g, '($1)');
    const alias = Object.hasOwn(englishAliases, aliasKey) ? englishAliases[aliasKey] : Object.hasOwn(projectAliases, aliasKey) ? projectAliases[aliasKey] : undefined;
    return alias ? canonical.get((projectAliases[alias] ?? alias).toLowerCase()) ?? alias : canonical.get(key) ?? null;
}
function safeSourceTag(value) {
    const key = value.toLowerCase();
    return value.length <= 100 && /[\p{L}]/u.test(value)
        && !/[\u0000-\u001f\u007f<>={}\\]|https?:|www\./iu.test(value)
        && !/^[*#]|^(?:洛谷)?标签\s*#?\d+$/iu.test(value)
        && !/^(?:\d{2,4}|[〇零一二三四五六七八九十]{2,8})\s*(?:年(?:份|度)?)?$/u.test(value)
        && !nonAlgorithmLabels.has(key) && !metadataNames.has(key);
}
const lojMetadataNames = new Set([
    '系统测试', '文件 io', '文件 i/o', '子任务', '模板', '原创',
    'system test', 'system tests', 'file io', 'file i/o', 'subtask', 'subtasks', 'template', 'original'
]);
function sourceMetadataTag(value, source) {
    if (source !== 'LOJ')
        return false;
    // LOJ returns judge modes, problem provenance and contests alongside topics.
    // Match those known metadata shapes, rather than dropping unknown algorithms.
    return lojMetadataNames.has(value.toLowerCase())
        || /^(?:libreoj|loj)(?:\s|[-:：]).*\b(?:round|contest|challenge)\b/iu.test(value)
        || /^(?:libreoj|loj)\s*(?:比赛|竞赛|挑战赛|测试|题库)/iu.test(value)
        || /^(?:19|20)\d{2}(?:\s*(?:年|年度))?(?:\s*[-/–]\s*\d{1,4})?$/u.test(value)
        || /^(?:noip|noi|ioi|apio|ctsc|wc|csp-[js]|icpc|ccpc|usaco|poi|bzoj|uoj|loj)\s*[-/ ]?\s*(?:19|20)\d{2}(?:\s|[-/#]|$)/iu.test(value);
}
/** Keep real source topics without requiring every platform to share Luogu's vocabulary. */
function normalizeSourceAlgorithmTags(values, platform) {
    if (!Array.isArray(values))
        return [];
    const tags = new Map();
    const source = platformOf(platform);
    const strictLuogu = source === 'LG';
    for (const value of values) {
        if (typeof value !== 'string')
            continue;
        const raw = cleanTag(value);
        if (!raw || !safeSourceTag(raw) || sourceMetadataTag(raw, source))
            continue;
        if (strictLuogu && luoguNonAlgorithmNames.has(raw.toLowerCase()))
            continue;
        const tag = normalizeAlgorithmTag(raw) ?? (strictLuogu ? null : raw);
        if (!tag || (strictLuogu && !officialAlgorithmNames.has(cleanTag(tag).toLowerCase())))
            continue;
        const key = tag.toLowerCase();
        if (!tags.has(key))
            tags.set(key, tag);
    }
    return [...tags.values()];
}
function normalizeTags(values, platform) {
    const rawTags = Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0).map(value => value.trim()))] : [];
    return { tags: normalizeSourceAlgorithmTags(rawTags, platform), rawTags };
}
/** Recover only source-native metadata; estimates and supplements never establish official fields. */
function normalizeOfficialMetadata(row, platform, tags) {
    const officialTags = Array.isArray(row.officialTags)
        ? normalizeSourceAlgorithmTags(row.officialTags, platform)
        : row.tagsKnown === false || platform === 'AT' ? [] : [...tags];
    let officialDifficulty;
    if (row.officialDifficulty === null || typeof row.officialDifficulty === 'string') {
        officialDifficulty = text(row.officialDifficulty);
    }
    else if (platform === 'CF') {
        const rating = positive(row.rating);
        officialDifficulty = rating === null ? null : String(rating);
    }
    else if (platform === 'LG') {
        const level = text(row.luoguDifficulty);
        officialDifficulty = level && level !== '暂无评定' ? level : null;
    }
    else if (platform === 'NC') {
        const difficulty = positive(row.communityDifficulty);
        officialDifficulty = difficulty === null ? null : String(difficulty);
    }
    else {
        // Legacy LC shards dropped Easy/Medium/Hard. Until refreshed, do not allow
        // a manual difficulty to overwrite the native tier merely because it was lost.
        officialDifficulty = platform === 'LC' ? '平台原生难度待同步' : null;
    }
    return { officialTags, officialDifficulty };
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
            const { tags, rawTags } = normalizeTags(row.tags, platform);
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
                clistRating: typeof row.clistRating === 'number' && Number.isFinite(row.clistRating) && row.clistRating >= 0 ? row.clistRating : null,
                tags,
                rawTags,
                tagsKnown: row.tagsKnown === false ? false : platform !== 'AT',
                ...normalizeOfficialMetadata(row, platform, tags),
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
        communityDifficulty: row.communityDifficulty, clistRating: row.clistRating,
        ratingEstimateReason: row.estimateReason ?? undefined,
        url: row.url, tags: row.tags,
        ...normalizeOfficialMetadata(row, row.platform, row.tags)
    };
}
